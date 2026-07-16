"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ─── types ─────────────────────────────────────────── */
interface PondRow {
  pondId: string;
  pondName: string;
  pondCode: string | null;
  areaDunam: number | null;
  cycleId: string;
  cycleCode: string;
  priorityCycleCode: string | null;
  openedAt: string;
  growthDays: number;
  fishStrainId: string;
  fishStrainName: string;
  populationStage: string | null;
  fishCount: number;
  avgWeightGrams: number | null;
  lastWeighingDate: string | null;
  biomassKg: number | null;
  densityPerDunam: number | null;
  loadKgPerDunam: number | null;
}

interface FishStrain { id: string; latinName: string; englishName: string | null; }

const ALL_COLS = [
  { key: "pondName",          label: "בריכה",             always: true  },
  { key: "areaDunam",         label: 'ד’',            always: true  },
  { key: "fishStrainName",    label: "סוג דג",             always: true  },
  { key: "fishCount",         label: "מספר דגים",          always: true  },
  { key: "avgWeightGrams",    label: "ממוצע (גרם)",        always: false },
  { key: "biomassKg",         label: 'ביומסה (ק"ג)',       always: false },
  { key: "populationStage",   label: "שלב",                always: false },
  { key: "priorityCycleCode", label: "מחזור פריוריטי",     always: false },
  { key: "openedAt",          label: "תאריך אכלוס ראשון",  always: false },
  { key: "growthDays",        label: "ימי גידול",          always: false },
  { key: "lastWeighingDate",  label: "תאריך שקילה",        always: false },
  { key: "densityPerDunam",   label: 'צפיפות/ד’',    always: false },
  { key: "loadKgPerDunam",    label: 'עומס ק"ג/ד’',  always: false },
] as const;

type ColKey = (typeof ALL_COLS)[number]["key"];

const DEFAULT_VISIBLE: ColKey[] = [
  "pondName","areaDunam","fishStrainName","fishCount",
  "avgWeightGrams","biomassKg","populationStage","growthDays","lastWeighingDate",
  "densityPerDunam","loadKgPerDunam",
];

/* ─── helpers ────────────────────────────────────────── */
function fmt(n: number | null, dec = 0): string {
  if (n == null) return "—";
  return n.toLocaleString("he-IL", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function todayStr(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

/* ─── component ──────────────────────────────────────── */
export default function PondStatusClient() {
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState<PondRow[]>([]);
  const [strains, setStrains] = useState<FishStrain[]>([]);
  const [filterFish, setFilterFish] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [loading, setLoading] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(new Set(DEFAULT_VISIBLE));
  const [showColPicker, setShowColPicker] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  /* fetch strains for filter dropdown */
  useEffect(() => {
    fetch("/api/fish-strains")
      .then((r) => r.ok ? r.json() : [])
      .then(setStrains)
      .catch(() => {});
  }, []);

  /* fetch pond-status data */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date });
      if (filterFish) params.set("fishStrainId", filterFish);
      const res = await fetch(`/api/pond-status?${params}`);
      if (res.ok) setRows(await res.json());
    } finally {
      setLoading(false);
    }
  }, [date, filterFish]);

  useEffect(() => { load(); }, [load]);

  /* close col picker on outside click */
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setShowColPicker(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* filter rows client-side by stage */
  const filtered = rows.filter((r) => {
    if (filterStage && r.populationStage !== filterStage) return false;
    return true;
  });

  /* unique stages for dropdown */
  const stages = Array.from(new Set(rows.map((r) => r.populationStage).filter(Boolean))) as string[];

  /* col toggle */
  function toggleCol(key: ColKey) {
    const col = ALL_COLS.find((c) => c.key === key);
    if (col?.always) return;
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  /* export CSV */
  function exportCsv() {
    const cols = ALL_COLS.filter((c) => visibleCols.has(c.key));
    const header = cols.map((c) => c.label).join(",");
    const body = filtered.map((r) =>
      cols.map((c) => {
        const k = c.key as ColKey;
        let v: unknown = r[k as keyof PondRow];
        if (k === "openedAt" || k === "lastWeighingDate") v = fmtDate(v as string | null);
        if (typeof v === "number") v = fmt(v, 1).replace(",", "");
        if (v == null) v = "";
        return `"${String(v).replace(/"/g, "\"\"")}"`;
      }).join(",")
    ).join("\n");
    const blob = new Blob(["\uFEFF" + header + "\n" + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `pond-status-${date}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  /* totals */
  const totalFish = filtered.reduce((s, r) => s + r.fishCount, 0);
  const totalBiomass = filtered.reduce((s, r) => s + (r.biomassKg ?? 0), 0);
  const activePonds = new Set(filtered.map((r) => r.pondId)).size;

  /* ── styles ── */
  const bg = "#F2EDE3";
  const navBg = "#1B3A2B";
  const thStyle: React.CSSProperties = {
    padding: "10px 8px", textAlign: "right", fontWeight: 600,
    whiteSpace: "nowrap", fontSize: 12, color: "white",
  };
  const tdStyle: React.CSSProperties = {
    padding: "8px 8px", fontSize: 12, color: "#1a2744",
    borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap",
  };
  const filterInput: React.CSSProperties = {
    padding: "6px 8px", border: "1.5px solid #e5e7eb", borderRadius: 7,
    fontSize: 12, fontFamily: "inherit", flexShrink: 0,
  };

  const visibleColDefs = ALL_COLS.filter((c) => visibleCols.has(c.key));

  function cellValue(r: PondRow, key: ColKey): React.ReactNode {
    switch (key) {
      case "pondName":
        return (
          <span>
            {r.pondName}
            {r.pondCode ? <span style={{ color: "#9ca3af", marginRight: 4, fontSize: 11 }}>({r.pondCode})</span> : null}
          </span>
        );
      case "areaDunam":      return r.areaDunam != null ? fmt(r.areaDunam, 1) : "—";
      case "fishStrainName": return r.fishStrainName;
      case "fishCount":      return <strong>{r.fishCount.toLocaleString("he-IL")}</strong>;
      case "avgWeightGrams": return r.avgWeightGrams != null ? fmt(r.avgWeightGrams, 0) : "—";
      case "biomassKg":      return r.biomassKg != null ? fmt(r.biomassKg, 1) : "—";
      case "populationStage": return r.populationStage ?? "—";
      case "priorityCycleCode": return r.priorityCycleCode ?? "—";
      case "openedAt":       return fmtDate(r.openedAt);
      case "growthDays":     return r.growthDays > 0 ? `${r.growthDays} ימים` : "—";
      case "lastWeighingDate": return fmtDate(r.lastWeighingDate);
      case "densityPerDunam": return r.densityPerDunam != null ? fmt(r.densityPerDunam, 0) : "—";
      case "loadKgPerDunam":  return r.loadKgPerDunam != null ? fmt(r.loadKgPerDunam, 1) : "—";
      default: return "—";
    }
  }

  return (
    <div dir="rtl" style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 54px)", background: bg }}>

      {/* ── sticky nav ── */}
      <div style={{ background: navBg, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, position: "sticky", top: 54, zIndex: 200 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "white", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "none" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            חזרה
          </a>
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>דשבורד ›</span>
          <span style={{ color: "white", fontSize: 12, fontWeight: 600 }}>מצב נוכחי</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={exportCsv} style={{ background: "#d97706", color: "white", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            ייצוא CSV
          </button>
          <span style={{ color: "white", fontWeight: 700, fontSize: 15 }}>📡 מצב נוכחי</span>
        </div>
      </div>

      {/* ── sticky filter row ── */}
      <div style={{ background: "white", padding: "8px 14px", borderBottom: "1px solid #e5e7eb", flexShrink: 0, position: "sticky", top: 108, zIndex: 190, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", whiteSpace: "nowrap" }}>תאריך:</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...filterInput, width: 140 }} />

        <select value={filterFish} onChange={(e) => setFilterFish(e.target.value)} style={{ ...filterInput, maxWidth: 150 }}>
          <option value="">כל הדגים</option>
          {strains.map((s) => (
            <option key={s.id} value={s.id}>{s.latinName}</option>
          ))}
        </select>

        <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} style={{ ...filterInput, maxWidth: 140 }}>
          <option value="">כל השלבים</option>
          {stages.map((st) => <option key={st} value={st}>{st}</option>)}
        </select>

        <button onClick={() => { setFilterFish(""); setFilterStage(""); setDate(todayStr()); }} style={{ ...filterInput, cursor: "pointer", background: "#f3f4f6", fontWeight: 600 }}>
          נקה
        </button>

        {/* stats */}
        <div style={{ marginRight: "auto", display: "flex", gap: 14, fontSize: 12, flexShrink: 0 }}>
          <span style={{ color: "#059669", fontWeight: 700 }}>{activePonds} בריכות פעילות</span>
          <span style={{ color: "#1d4ed8", fontWeight: 700 }}>{totalFish.toLocaleString("he-IL")} דגים</span>
          {totalBiomass > 0 && <span style={{ color: "#6b7280", fontWeight: 700 }}>{fmt(totalBiomass, 1)} ק"ג ביומסה</span>}
        </div>

        {/* col picker */}
        <div ref={colPickerRef} style={{ position: "relative" }}>
          <button onClick={() => setShowColPicker((v) => !v)} style={{ ...filterInput, cursor: "pointer", background: "#eff6ff", color: "#1d4ed8", border: "1.5px solid #93c5fd", fontWeight: 700 }}>
            📋 עמודות
          </button>
          {showColPicker && (
            <div style={{ position: "absolute", left: 0, top: "calc(100% + 6px)", background: "white", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", zIndex: 300, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", minWidth: 180 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>בחר עמודות</div>
              {ALL_COLS.filter((c) => !c.always).map((c) => (
                <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#374151", marginBottom: 6, cursor: "pointer" }}>
                  <input type="checkbox" checked={visibleCols.has(c.key)} onChange={() => toggleCol(c.key)} />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── table ── */}
      <div style={{ flex: 1, overflow: "auto", padding: 0 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 14 }}>טוען נתונים...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
            אין נתונים להצגה לתאריך {fmtDate(date + "T00:00:00")}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#12243d", color: "white", position: "sticky", top: 0, zIndex: 10 }}>
                {visibleColDefs.map((c) => (
                  <th key={c.key} style={thStyle}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={`${r.pondId}-${r.fishStrainId}`} style={{ background: i % 2 === 0 ? "white" : "#fafafa" }}>
                  {visibleColDefs.map((c) => (
                    <td key={c.key} style={tdStyle}>{cellValue(r, c.key as ColKey)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
