import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { bestAccessForModule, meetsRequirement, AccessLevel } from "@/lib/permissions";
import DailySummaryContent from "./DailySummaryContent";

// סיכום יומי — spec v3 p.45-47 / prototype daily-summary-screen.
// Standalone page wrapper — auth + header. Content lives in DailySummaryContent
// so it can also be embedded in the dashboard as an inline tab.

function todayStr(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default async function DailySummaryPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const level = bestAccessForModule(user.permissions, "סיכום נתונים");
  if (!meetsRequirement(level, AccessLevel.VIEW_ONLY)) {
    return (
      <main className="p-6">
        <p className="text-red-600">אין לך הרשאה לצפות בעמוד זה.</p>
      </main>
    );
  }

  const dateStr = searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)
    ? searchParams.date
    : todayStr();

  return (
    <div style={{ background: "#F2EDE3", minHeight: "calc(100vh - 54px)" }} dir="rtl">
      <div style={{ flex: 1, padding: "20px 16px 0", maxWidth: "680px", margin: "0 auto", width: "100%" }}>
        {/* Header with back button + breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <Link
            href="/ops/management"
            style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "8px", padding: "7px 14px", cursor: "pointer", fontSize: "13px", fontWeight: 600, fontFamily: "inherit", color: "#1A2B1F", display: "flex", alignItems: "center", gap: "6px", textDecoration: "none", flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            חזרה
          </Link>
          <div style={{ fontSize: "12px", color: "#6B7A72", display: "flex", alignItems: "center", gap: "5px" }}>
            <span>ניהול תפעול</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            <span style={{ color: "#1A2B1F", fontWeight: 600 }}>יצירת סיכום יום</span>
          </div>
        </div>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "22px", fontWeight: 900, color: "#1A2B1F", letterSpacing: "-0.3px" }}>סיכום יומי</div>
        </div>
      </div>
      <DailySummaryContent dateStr={dateStr} />
    </div>
  );
}
