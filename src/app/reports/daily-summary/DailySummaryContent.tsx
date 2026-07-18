// Shared server component — renders daily summary data for a given date.
// Used by both /reports/daily-summary/page.tsx and /dashboard (tab embed).
import { prisma } from "@/lib/db";
import DateNav from "./DateNav";
import DailySummaryActions from "./DailySummaryActions";

const WEIGHABLE_TRANSFER_TYPES = ["דילול", "פירוק", "שיווק"];

function strainLabel(s: { englishName: string | null; latinName: string }) {
  return s.englishName ?? s.latinName;
}
function pondLabel(p: { code: string | null; name: string }) {
  return p.code ? `${p.name} (${p.code})` : p.name;
}
function formatTime(dt: Date): string {
  return `${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`;
}
function formatDateHe(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "white", borderRadius: "8px", overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.07)", marginBottom: "12px" }}>
      <div style={{ background: "#e8f5e9", color: "#1B3A2B", padding: "10px 14px", fontSize: "13px", fontWeight: 800, borderBottom: "2px solid #2C7A52", borderRadius: "8px 8px 0 0" }}>
        {title}
      </div>
      <div>{children}</div>
    </section>
  );
}
function EmptyState({ text }: { text: string }) {
  return <p style={{ padding: "12px 14px", color: "#9ca3af", fontSize: "12px", textAlign: "center", fontStyle: "italic", margin: 0 }}>{text}</p>;
}
function DsTable({ headers, rows, keys, centeredCols = [] }: { headers: string[]; rows: string[][]; keys: string[]; centeredCols?: number[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
        <thead>
          <tr>{headers.map((h, i) => (
            <th key={h} style={{ background: "#f1f5f9", color: "#1a2744", padding: "7px 10px", textAlign: centeredCols.includes(i) ? "center" : "right", fontWeight: 700, borderBottom: "2px solid #d1d5db", whiteSpace: "nowrap", fontSize: "11px" }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={keys[i]}>{row.map((cell, j) => (
              <td key={j} style={{ padding: "6px 10px", borderBottom: "1px solid #f8f9fa", whiteSpace: "nowrap", textAlign: centeredCols.includes(j) ? "center" : "right" }}>{cell}</td>
            ))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type TabSlug = "ops" | "treatments" | "tests";

const TABS: { slug: TabSlug; label: string; icon: string }[] = [
  { slug: "ops",        label: "תפעול",           icon: "🔄" },
  { slug: "treatments", label: "טיפולים ומים",    icon: "💊" },
  { slug: "tests",      label: "בדיקות",           icon: "🐟" },
];

function tabHref(basePath: string | undefined, dateStr: string, slug: TabSlug) {
  const base = basePath ?? "/reports/daily-summary";
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}date=${dateStr}&tab=${slug}`;
}

interface Props {
  dateStr: string;        // yyyy-mm-dd
  basePath?: string;      // passed to DateNav for routing — default "/reports/daily-summary"
  tab?: string;           // active tab slug, default "ops"
}

export default async function DailySummaryContent({ dateStr, basePath, tab }: Props) {
  const activeTab: TabSlug = (tab === "treatments" || tab === "tests") ? tab : "ops";
  const dayStart = new Date(`${dateStr}T00:00:00`);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [transfers, weighings, cyclesOpenedOrClosed] = await Promise.all([
    prisma.fishTransferHeader.findMany({
      where: { transferDate: { gte: dayStart, lt: dayEnd } },
      include: {
        sourcePond: { select: { name: true, code: true } },
        supplier: { select: { name: true } },
        details: { include: { fishStrain: { select: { englishName: true, latinName: true } }, destPond: { select: { name: true, code: true } } } },
      },
      orderBy: { transferDate: "asc" },
    }),
    prisma.fishWeighingHeader.findMany({
      where: { date: { gte: dayStart, lt: dayEnd } },
      include: {
        weightType: { select: { name: true } },
        pond: { select: { name: true, code: true } },
        transferDetail: { include: { fishStrain: { select: { englishName: true, latinName: true } } } },
        baskets: { select: { emptyWetWeight: true, weightWithFish: true, fishCount: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.growthCycle.findMany({
      where: { OR: [{ openedAt: { gte: dayStart, lt: dayEnd } }, { closedAt: { gte: dayStart, lt: dayEnd } }] },
      include: { pond: { select: { name: true, code: true } } },
    }),
  ]);

  const transferRows = transfers.flatMap((h) =>
    h.details.map((d) => {
      const isWeighable = WEIGHABLE_TRANSFER_TYPES.includes(h.transferType);
      let fishCount: number | null = d.fishCount ?? null;
      if (isWeighable && d.totalWeightKg != null && d.avgWeightGrams) {
        fishCount = Math.round((d.totalWeightKg * 1000) / d.avgWeightGrams);
      }
      return { id: d.id, transferType: h.transferType, fish: strainLabel(d.fishStrain), source: pondLabel(h.sourcePond), supplier: h.transferType === "קניה" ? (h.supplier?.name ?? "—") : "—", dest: pondLabel(d.destPond), fishCount, avgWeightGrams: d.avgWeightGrams ?? null, totalWeightKg: d.totalWeightKg ?? null };
    })
  );

  const weighingRows = weighings.map((w) => {
    const totalNetKg = w.baskets.reduce((sum, b) => sum + (b.weightWithFish - b.emptyWetWeight), 0);
    const totalFish = w.baskets.reduce((sum, b) => sum + b.fishCount, 0);
    const avgWeightGrams = totalFish > 0 ? (totalNetKg / totalFish) * 1000 : null;
    return { id: w.id, type: w.weightType.name, pond: pondLabel(w.pond), fish: w.transferDetail?.fishStrain ? strainLabel(w.transferDetail.fishStrain) : "—", fishCount: totalFish, avgWeightGrams, totalNetKg };
  });

  const cycleRows: { id: string; pond: string; action: string; cycle: string; time: string }[] = [];
  for (const c of cyclesOpenedOrClosed) {
    const pCode = c.pond.code ?? c.pond.name;
    const openDate = c.openedAt.toISOString().slice(0, 10).replaceAll("-", "");
    const cycleLabel = `${pCode}-${openDate}`;
    if (c.openedAt >= dayStart && c.openedAt < dayEnd) cycleRows.push({ id: `${c.id}-open`, pond: pondLabel(c.pond), action: "פתיחה", cycle: cycleLabel, time: formatTime(c.openedAt) });
    if (c.closedAt && c.closedAt >= dayStart && c.closedAt < dayEnd) cycleRows.push({ id: `${c.id}-close`, pond: pondLabel(c.pond), action: "סגירה", cycle: cycleLabel, time: formatTime(c.closedAt) });
  }

  const dateLabel = formatDateHe(dateStr);

  return (
    <div style={{ flex: 1, padding: "16px 16px 44px", maxWidth: "680px", margin: "0 auto", width: "100%" }} dir="rtl">
      {/* Date picker row */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
        <label htmlFor="summary-date" style={{ fontSize: "13px", fontWeight: 600, color: "#374151", margin: 0 }}>בחר תאריך:</label>
        <DateNav date={dateStr} basePath={basePath} />
        <div style={{ fontSize: "13px", color: "#6B7A72", fontWeight: 500, margin: 0 }}>סיכום ל-{dateLabel}</div>
      </div>

      {/* Tab navigation */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, borderBottom: "2px solid #e5e7eb", paddingBottom: 0 }}>
        {TABS.map((t) => {
          const isActive = t.slug === activeTab;
          return (
            <a
              key={t.slug}
              href={tabHref(basePath, dateStr, t.slug)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "8px 14px", fontSize: 13, fontWeight: isActive ? 700 : 500,
                color: isActive ? "#1B3A2B" : "#6b7280",
                background: isActive ? "white" : "transparent",
                borderRadius: "8px 8px 0 0",
                border: isActive ? "2px solid #e5e7eb" : "2px solid transparent",
                borderBottom: isActive ? "2px solid white" : "2px solid transparent",
                textDecoration: "none",
                marginBottom: isActive ? -2 : 0,
                cursor: "pointer",
              }}
            >
              <span>{t.icon}</span>{t.label}
            </a>
          );
        })}
      </div>

      {/* Tab: תפעול */}
      {activeTab === "ops" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          <SummarySection title="🔄 העברות">
            {transferRows.length === 0 ? <EmptyState text="אין פעולות העברות להיום" /> : (
              <DsTable headers={['פעולה', 'דג', 'מקור', 'ספק', 'יעד', "מס' דגים", "ממוצע (גר')", 'משקל (ק"ג)']}
                rows={transferRows.map((r) => [r.transferType, r.fish, r.source, r.supplier, r.dest, r.fishCount != null ? r.fishCount.toLocaleString("he-IL") : "—", r.avgWeightGrams != null ? Math.round(r.avgWeightGrams).toLocaleString("he-IL") : "—", r.totalWeightKg != null ? r.totalWeightKg.toFixed(1) : "—"])}
                keys={transferRows.map((r) => r.id)} centeredCols={[5, 6, 7]} />
            )}
          </SummarySection>
          <SummarySection title="⚖️ שקילות">
            {weighingRows.length === 0 ? <EmptyState text="אין פעולות שקילות להיום" /> : (
              <DsTable headers={['סוג', 'בריכה', 'דג', "מס' דגים", "ממוצע (גר')", 'משקל סה"כ (ק"ג)']}
                rows={weighingRows.map((r) => [r.type, r.pond, r.fish, r.fishCount.toLocaleString("he-IL"), r.avgWeightGrams != null ? Math.round(r.avgWeightGrams).toLocaleString("he-IL") : "—", r.totalNetKg.toFixed(1)])}
                keys={weighingRows.map((r) => r.id)} centeredCols={[3, 4, 5]} />
            )}
          </SummarySection>
          <SummarySection title="🏊 פתיחות וסגירות בריכות">
            {cycleRows.length === 0 ? <EmptyState text="אין פתיחות/סגירות בריכות להיום" /> : (
              <DsTable headers={["בריכה", "פעולה", "מחזור", "שעה"]} rows={cycleRows.map((r) => [r.pond, r.action, r.cycle, r.time])} keys={cycleRows.map((r) => r.id)} centeredCols={[3]} />
            )}
          </SummarySection>
          <DailySummaryActions dateLabel={dateLabel} transferRows={transferRows} weighingRows={weighingRows} cycleRows={cycleRows} />
        </div>
      )}

      {/* Tab: טיפולים ומים */}
      {activeTab === "treatments" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          <SummarySection title="💊 טיפולים"><EmptyState text="אין פעולות טיפוליות להיום" /></SummarySection>
          <SummarySection title="💧 בדיקות מים"><EmptyState text="אין בדיקות מים להיום" /></SummarySection>
          <div style={{ marginTop: 8 }}>
            <button disabled style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "none", fontSize: "15px", fontWeight: 700, color: "white", background: "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", cursor: "not-allowed", fontFamily: "inherit", opacity: 0.7 }}>
              <span>✅</span><span>אישור מנהל טיפולים — בפיתוח</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab: בדיקות */}
      {activeTab === "tests" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          <SummarySection title="🐟 בדיקות דגים"><EmptyState text="אין בדיקות דגים להיום" /></SummarySection>
          <SummarySection title="⚠️ נתונים חריגים"><EmptyState text="אין נתונים חריגים להיום" /></SummarySection>
          <div style={{ marginTop: 8 }}>
            <button disabled style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "none", fontSize: "15px", fontWeight: 700, color: "white", background: "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", cursor: "not-allowed", fontFamily: "inherit", opacity: 0.7 }}>
              <span>✅</span><span>אישור מנהל בדיקות — בפיתוח</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
