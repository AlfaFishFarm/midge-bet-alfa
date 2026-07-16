"use client";

import Link from "next/link";
import { useState, useMemo } from "react";

export interface TransferRow {
  detailId: string;
  headerId: string;
  date: string; // YYYY-MM-DD
  action: string; // transferType
  fishName: string;
  srcPool: string;
  srcPoolId: string;
  destPool: string;
  destPoolId: string;
  tank: string;
  basketCount: number | null;
  weight: number | null;
  count: number | null;
  avg: number | null;
  stage: string;
  staffName: string;
  notes: string;
}

interface Props {
  rows: TransferRow[];
  canCreate: boolean;
  allSrcPonds: { id: string; name: string }[];
  allDestPonds: { id: string; name: string }[];
  allFish: string[];
}

// Exact colors from prototype tf-badge-* classes
const TYPE_BADGE_BG: Record<string, string> = {
  "קניה":  "#3D9A6A",
  "דילול": "#3A8FD4",
  "פירוק": "#2BAEA6",
  "שיווק": "#F0983A",
  "תמותה": "#E8554A",
};

function fmtDate(iso: string): string {
  // iso = YYYY-MM-DD -> DD/MM/YYYY
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtNum(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("he-IL", { maximumFractionDigits: 2 });
}

function fmtInt(n: number | null): string {
  if (n == null) return "—";
  return Math.round(n).toLocaleString("he-IL");
}

export default function TransfersListClient({ rows, canCreate, allSrcPonds, allDestPonds, allFish }: Props) {
  const todayISO = new Date().toISOString().slice(0, 10);

  const [mode, setMode] = useState<"today" | "all" | "custom">("today");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [srcFilter, setSrcFilter] = useState("");
  const [destFilter, setDestFilter] = useState("");
  const [fishFilter, setFishFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const filtered = useMemo(() => {
    let data = rows;
    if (mode === "today") {
      data = data.filter((r) => r.date === todayISO);
    } else if (mode === "custom") {
      if (dateFrom) data = data.filter((r) => r.date >= dateFrom);
      if (dateTo)   data = data.filter((r) => r.date <= dateTo);
      if (srcFilter)  data = data.filter((r) => r.srcPoolId === srcFilter);
      if (destFilter) data = data.filter((r) => r.destPoolId === destFilter);
      if (fishFilter) data = data.filter((r) => r.fishName === fishFilter);
      if (typeFilter) data = data.filter((r) => r.action === typeFilter);
    }
    return data;
  }, [rows, mode, todayISO, dateFrom, dateTo, srcFilter, destFilter, fishFilter, typeFilter]);

  function handleCustomFilter() {
    setMode("custom");
  }

  return (
    <div
      dir="rtl"
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "calc(100vh - 54px)",
        background: "#F2EDE3",
      }}
    >
      {/* Fixed top nav bar — prototype: #ops-transfers-screen > fixed-top div */}
      <div style={{ background: "#1B3A2B", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/ops/transfers" className="tf-back-btn" style={{ textDecoration: "none" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            חזרה
          </Link>
          <span className="tf-breadcrumb">תפעול › העברות</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {canCreate && (
            <Link
              href="/transfers/new"
              style={{ background: "#059669", color: "white", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}
            >
              + העברה חדשה
            </Link>
          )}
          <span style={{ color: "white", fontWeight: 700, fontSize: 15 }}>🔄 העברות</span>
        </div>
      </div>

      {/* Filter bar — prototype: #rep-tf-filters */}
      <div id="rep-tf-filters" style={{ background: "white", padding: "8px 14px", borderBottom: "1px solid #e5e7eb", flexShrink: 0, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={() => setMode("today")}
          className="rep-filter-btn"
          style={{
            background: mode === "today" ? "#1B3A2B" : "white",
            color: mode === "today" ? "white" : "#374151",
            borderColor: mode === "today" ? "#1B3A2B" : "#e5e7eb",
          }}
        >
          היום
        </button>
        <button
          onClick={() => setMode("all")}
          className="rep-filter-btn"
          style={{
            background: mode === "all" ? "#1B3A2B" : "white",
            color: mode === "all" ? "white" : "#374151",
            borderColor: mode === "all" ? "#1B3A2B" : "#e5e7eb",
          }}
        >
          הכל
        </button>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); handleCustomFilter(); }}
          style={{ padding: "5px 8px", border: "1.5px solid #e5e7eb", borderRadius: 6, fontSize: 12, fontFamily: "inherit" }}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); handleCustomFilter(); }}
          style={{ padding: "5px 8px", border: "1.5px solid #e5e7eb", borderRadius: 6, fontSize: 12, fontFamily: "inherit" }}
        />
        <select
          value={srcFilter}
          onChange={(e) => { setSrcFilter(e.target.value); handleCustomFilter(); }}
          style={{ padding: "5px 8px", border: "1.5px solid #e5e7eb", borderRadius: 6, fontSize: 12, fontFamily: "inherit" }}
        >
          <option value="">בריכת שליה</option>
          {allSrcPonds.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={destFilter}
          onChange={(e) => { setDestFilter(e.target.value); handleCustomFilter(); }}
          style={{ padding: "5px 8px", border: "1.5px solid #e5e7eb", borderRadius: 6, fontSize: 12, fontFamily: "inherit" }}
        >
          <option value="">בריכת אכלוס</option>
          {allDestPonds.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={fishFilter}
          onChange={(e) => { setFishFilter(e.target.value); handleCustomFilter(); }}
          style={{ padding: "5px 8px", border: "1.5px solid #e5e7eb", borderRadius: 6, fontSize: 12, fontFamily: "inherit" }}
        >
          <option value="">כל הדגים</option>
          {allFish.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); handleCustomFilter(); }}
          style={{ padding: "5px 8px", border: "1.5px solid #e5e7eb", borderRadius: 6, fontSize: 12, fontFamily: "inherit" }}
        >
          <option value="">כל הפעולות</option>
          <option>פירוק</option>
          <option>דילול</option>
          <option>קניה</option>
          <option>שיווק</option>
          <option>תמותה</option>
        </select>
      </div>

      {/* Table — prototype: report-transfers-screen table */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <table className="tf-table" style={{ minWidth: 900 }}>
          <thead>
            <tr style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <th style={{ padding: "9px 8px", textAlign: "right", whiteSpace: "nowrap" }}>תאריך</th>
              <th style={{ padding: "9px 8px", whiteSpace: "nowrap" }}>פעולה</th>
              <th style={{ padding: "9px 8px", whiteSpace: "nowrap" }}>סוג דג</th>
              <th style={{ padding: "9px 8px", whiteSpace: "nowrap" }}>בריכת שליה</th>
              <th style={{ padding: "9px 8px", whiteSpace: "nowrap" }}>בריכת אכלוס</th>
              <th style={{ padding: "9px 8px", whiteSpace: "nowrap" }}>טנק</th>
              <th style={{ padding: "9px 8px", textAlign: "center", whiteSpace: "nowrap" }}>סל</th>
              <th style={{ padding: "9px 8px", textAlign: "center", whiteSpace: "nowrap" }}>משקל (ק&quot;ג)</th>
              <th style={{ padding: "9px 8px", textAlign: "center", whiteSpace: "nowrap" }}>כמות</th>
              <th style={{ padding: "9px 8px", textAlign: "center", whiteSpace: "nowrap" }}>ממוצע (גר&apos;)</th>
              <th style={{ padding: "9px 8px", whiteSpace: "nowrap" }}>שלב</th>
              <th style={{ padding: "9px 8px", whiteSpace: "nowrap" }}>שם נתון</th>
              <th style={{ padding: "9px 8px", whiteSpace: "nowrap" }}>הערות</th>
              <th style={{ padding: "9px 6px", textAlign: "center" }}>✎</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={14} style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>
                  אין נתונים לתצוגה
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.detailId}>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.date)}</td>
                  <td>
                    <span
                      className="tf-type-badge"
                      style={{ background: TYPE_BADGE_BG[r.action] ?? "#2BAEA6" }}
                    >
                      {r.action}
                    </span>
                  </td>
                  <td>{r.fishName || "—"}</td>
                  <td>{r.action === "קניה" ? "מחסן ראשי" : (r.srcPool || "—")}</td>
                  <td>{r.destPool || "—"}</td>
                  <td>{r.tank || "—"}</td>
                  <td className="center">{r.basketCount != null ? r.basketCount : "—"}</td>
                  <td className="center" style={{ fontWeight: 700 }}>{fmtNum(r.weight)}</td>
                  <td className="center">{fmtInt(r.count)}</td>
                  <td className="center">{fmtInt(r.avg)}</td>
                  <td>{r.stage || "—"}</td>
                  <td style={{ color: "#6b7280" }}>{r.staffName || "—"}</td>
                  <td style={{ color: "#9ca3af", fontSize: 11 }}>{r.notes || ""}</td>
                  <td className="center">
                    <Link
                      href={`/transfers/${r.headerId}`}
                      style={{ background: "none", border: "none", color: "#1d4ed8", cursor: "pointer", fontSize: 14, textDecoration: "none" }}
                      title="עריכה"
                    >
                      ✎
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
