"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import PondCombobox from "@/components/PondCombobox";

/* ─── Types ─────────────────────────────────────────────────── */
interface Basket {
  id: string;
  basketSeq: number;
  emptyWetWeight: number;
  weightWithFish: number;
  fishCount: number;
}

interface Weighing {
  id: string;
  date: string;
  staffName: string | null;
  notes: string | null;
  pond: { id: string; code: string | null; name: string };
  weightType: { id: string; name: string };
  cycle: { id: string; priorityCycleCode: string | null; openedAt: string } | null;
  baskets: Basket[];
}

interface WeightType { id: string; name: string; }

interface PondOption {
  id: string;
  code: string | null;
  name: string;
  hasActiveCycle: boolean;
  activeCycleCode: string | null;
}

interface Props {
  initialFieldWeighings: Weighing[];
  initialNetWeighings: Weighing[];
  weightTypes: WeightType[];
  ponds: PondOption[];
  canCreate: boolean;
}

/* ─── Staged basket (before confirm) ────────────────────────── */
interface StagedBasket {
  tmpId: string;
  time: string;
  weightWithFish: string;
  fishCount: string;
}

/* ─── Helpers ────────────────────────────────────────────────── */
function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function nowDatetimeLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function calcSummary(baskets: StagedBasket[]) {
  const count = baskets.length;
  const totalKg = baskets.reduce((s, b) => s + (parseFloat(b.weightWithFish) || 0), 0);
  const totalFish = baskets.reduce((s, b) => s + (parseInt(b.fishCount, 10) || 0), 0);
  const avgGrams = totalFish > 0 ? (totalKg / totalFish * 1000) : null;
  return { count, totalKg, totalFish, avgGrams };
}

function computeCycleCode(w: Weighing): string {
  if (!w.cycle) return "—";
  const pCode = w.pond.code ?? w.pond.name;
  const openDate = w.cycle.openedAt.slice(0, 10).replaceAll("-", "");
  return `${pCode}-${openDate}`;
}

let _tmpCounter = 0;
function nextTmpId() { return `tmp-${++_tmpCounter}`; }

/* ─── WeighingRow (list expand) ─────────────────────────────── */
function WeighingRow({ w }: { w: Weighing }) {
  const [open, setOpen] = useState(false);
  const cycleCode = computeCycleCode(w);
  const totalFish = w.baskets.reduce((s, b) => s + b.fishCount, 0);
  const totalKg   = w.baskets.reduce((s, b) => s + b.weightWithFish, 0);
  const avgKg     = totalFish > 0 ? (totalKg / totalFish).toFixed(3) : "—";

  return (
    <>
      <tr
        style={{ borderBottom: "1px solid #f0f4f8", cursor: "pointer" }}
        onClick={() => setOpen(v => !v)}
        onMouseEnter={e => (e.currentTarget.style.background = "#fafbfc")}
        onMouseLeave={e => (e.currentTarget.style.background = "")}
      >
        <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: "12px", color: "#374151", whiteSpace: "nowrap" }}>
          {new Date(w.date).toLocaleDateString("he-IL")}
        </td>
        <td style={{ padding: "8px 10px", fontSize: "13px", fontWeight: 600, color: "#1a2744" }}>{w.pond.name}</td>
        <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: "11px", color: "#6b7280" }}>{cycleCode}</td>
        <td style={{ padding: "8px 10px", fontSize: "12px", color: "#374151" }}>{w.staffName ?? "—"}</td>
        <td style={{ padding: "8px 10px", textAlign: "center", fontSize: "13px", fontWeight: 700, color: "#1a2744" }}>{w.baskets.length}</td>
        <td style={{ padding: "8px 10px", textAlign: "center", fontSize: "12px", color: "#374151" }}>{totalFish}</td>
        <td style={{ padding: "8px 10px", textAlign: "center", fontSize: "12px", color: "#059669", fontWeight: 700 }}>{avgKg}</td>
        <td style={{ padding: "8px 6px", textAlign: "center", fontSize: "11px", color: "#9ca3af" }}>{open ? "▲" : "▼"}</td>
      </tr>
      {open && w.baskets.length > 0 && (
        <tr>
          <td colSpan={8} style={{ padding: "4px 16px 10px", background: "#f8fafc" }}>
            <div className="weigh-confirm-baskets">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{"משקל סל מלא (ק\"ג)"}</th>
                    <th>מספר דגים</th>
                    <th>{"ממוצע (ק\"ג)"}</th>
                  </tr>
                </thead>
                <tbody>
                  {w.baskets.map((b, idx) => {
                    const avg = b.fishCount > 0 ? (b.weightWithFish / b.fishCount).toFixed(3) : "—";
                    return (
                      <tr key={b.id}>
                        <td>{b.basketSeq}</td>
                        <td>{b.weightWithFish.toFixed(2)}</td>
                        <td>{b.fishCount}</td>
                        <td style={{ color: "#059669", fontWeight: 700 }}>{avg}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── List table ─────────────────────────────────────────────── */
function WeighingTable({ rows, title, color }: { rows: Weighing[]; title: string; color: string }) {
  return (
    <div style={{ background: "white", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden", marginBottom: "16px" }}>
      <div style={{ background: color, color: "white", padding: "8px 14px", fontSize: "12px", fontWeight: 700, letterSpacing: "0.3px" }}>{title}</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "560px" }}>
          <thead>
            <tr style={{ background: "#12243d", color: "white" }}>
              <th style={{ padding: "9px 10px", textAlign: "right", fontWeight: 700, fontSize: "11px", whiteSpace: "nowrap" }}>תאריך</th>
              <th style={{ padding: "9px 10px", textAlign: "right", fontWeight: 700, fontSize: "11px", whiteSpace: "nowrap" }}>בריכה</th>
              <th style={{ padding: "9px 10px", textAlign: "right", fontWeight: 700, fontSize: "11px", whiteSpace: "nowrap" }}>מחזור</th>
              <th style={{ padding: "9px 10px", textAlign: "right", fontWeight: 700, fontSize: "11px", whiteSpace: "nowrap" }}>שוקל</th>
              <th style={{ padding: "9px 10px", textAlign: "center", fontWeight: 700, fontSize: "11px", whiteSpace: "nowrap" }}>סלים</th>
              <th style={{ padding: "9px 10px", textAlign: "center", fontWeight: 700, fontSize: "11px", whiteSpace: "nowrap" }}>{"סה\"כ דגים"}</th>
              <th style={{ padding: "9px 10px", textAlign: "center", fontWeight: 700, fontSize: "11px", whiteSpace: "nowrap" }}>{"ממוצע (ק\"ג)"}</th>
              <th style={{ padding: "9px 6px", width: "24px" }} />
            </tr>
          </thead>
          <tbody>
            {rows.map(w => <WeighingRow key={w.id} w={w} />)}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p style={{ textAlign: "center", color: "#9ca3af", padding: "32px 16px", fontSize: "13px" }}>אין שקילות להצגה</p>
      )}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────── */
export default function WeighingsClient({
  initialFieldWeighings,
  initialNetWeighings,
  weightTypes,
  ponds,
  canCreate,
}: Props) {
  const [view, setView] = useState<"list" | "form">("list");
  const [weighType, setWeighType] = useState<"field" | "net" | null>(null);
  const [formDatetime, setFormDatetime] = useState(nowDatetimeLocal);
  const [formPondId, setFormPondId] = useState("");
  const [formPondCode, setFormPondCode] = useState("—");
  const [formFishType, setFormFishType] = useState("");
  const [stagedBaskets, setStagedBaskets] = useState<StagedBasket[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldWeighings] = useState<Weighing[]>(initialFieldWeighings);
  const [netWeighings]   = useState<Weighing[]>(initialNetWeighings);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (view !== "form") return;
    const id = setInterval(() => {
      const el = document.getElementById("wf-datetime") as HTMLInputElement | null;
      if (!el?.dataset.manualEdit) {
        setFormDatetime(nowDatetimeLocal());
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [view]);

  const handlePondChange = useCallback((id: string) => {
    setFormPondId(id);
    const pond = ponds.find(p => p.id === id);
    setFormPondCode(pond?.code ?? "—");
  }, [ponds]);

  function openForm() {
    setWeighType(null);
    setFormDatetime(nowDatetimeLocal());
    setFormPondId("");
    setFormPondCode("—");
    setFormFishType("");
    setStagedBaskets([]);
    setFormError(null);
    setShowConfirm(false);
    setView("form");
  }

  function closeForm() {
    setView("list");
    setWeighType(null);
  }

  function addBasket() {
    setStagedBaskets(prev => [...prev, { tmpId: nextTmpId(), time: nowTimeStr(), weightWithFish: "", fishCount: "" }]);
  }

  function removeBasket(tmpId: string) {
    setStagedBaskets(prev => prev.filter(b => b.tmpId !== tmpId));
  }

  function updateBasket(tmpId: string, field: keyof StagedBasket, value: string) {
    setStagedBaskets(prev => prev.map(b => b.tmpId === tmpId ? { ...b, [field]: value } : b));
  }

  const summary = calcSummary(stagedBaskets);

  function handleSaveClick(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!weighType) { setFormError("יש לבחור סוג שקילה"); return; }
    if (!formPondId) { setFormError("יש לבחור בריכה"); return; }
    if (stagedBaskets.length === 0) { setFormError("יש להוסיף לפחות סל אחד"); return; }
    const invalid = stagedBaskets.some(b =>
      !b.weightWithFish || !b.fishCount ||
      parseFloat(b.weightWithFish) <= 0 ||
      parseInt(b.fishCount, 10) <= 0
    );
    if (invalid) { setFormError("יש לוודא שכל הסלים כוללים משקל ומספר דגים תקינים"); return; }
    const pond = ponds.find(p => p.id === formPondId);
    if (!pond?.hasActiveCycle) {
      setFormError("לא ניתן לבצע שקילה — לבריכה אין מחזור פעיל פתוח");
      return;
    }
    setShowConfirm(true);
  }

  async function commitSave() {
    setConfirmError(null);
    setSaving(true);
    try {
      const wt = weightTypes.find(w =>
        weighType === "field" ? w.name.includes("שטח") : w.name.includes("רשת")
      );
      if (!wt) { setConfirmError("לא נמצא סוג שקילה תואם במערכת"); setSaving(false); return; }
      const res = await fetch("/api/weighings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: formDatetime, pondId: formPondId, weightTypeId: wt.id }),
      });
      const data = await res.json() as { id?: string; error?: string };
      if (!res.ok) { setConfirmError(data.error ?? "שגיאה ביצירת שקילה"); setSaving(false); return; }
      const wid = data.id!;
      let savedCount = 0;
      for (const b of stagedBaskets) {
        const bRes = await fetch(`/api/weighings/${wid}/baskets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weightWithFish: parseFloat(b.weightWithFish),
            fishCount: parseInt(b.fishCount, 10),
          }),
        });
        if (!bRes.ok) {
          // Stop and report exactly how many made it in — a silent partial save
          // would leave the weighing missing baskets without anyone knowing.
          let bMsg = "שגיאה בשמירת סל";
          try { const bd = await bRes.json(); bMsg = bd.error ?? bMsg; } catch {}
          setConfirmError(`${bMsg} — נשמרו ${savedCount} מתוך ${stagedBaskets.length} סלים. נסה שנית`);
          setSaving(false);
          return;
        }
        savedCount++;
      }
      setShowConfirm(false);
      window.location.reload();
    } catch {
      setConfirmError("שגיאת תקשורת. נסה שוב.");
    } finally {
      setSaving(false);
    }
  }

  const selPond = ponds.find(p => p.id === formPondId);

  /* ── LIST VIEW ── */
  if (view === "list") {
    return (
      <div dir="rtl" style={{ padding: "20px 24px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <span className="weighing-type-badge wbadge-field">📐 שקילות שטח</span>
            <span className="weighing-type-badge wbadge-net">🥅 שקילות רשת</span>
          </div>
          {canCreate && (
            <button
              onClick={openForm}
              style={{ padding: "9px 18px", borderRadius: "8px", border: "none", fontWeight: 700, fontSize: "13px", fontFamily: "inherit", cursor: "pointer", background: "#1B3A2B", color: "white", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              שקילה חדשה
            </button>
          )}
        </div>
        <WeighingTable rows={fieldWeighings} title="📐 שקילות שטח" color="#D97B1A" />
        <WeighingTable rows={netWeighings}   title="🥅 שקילות רשת"  color="#2C7A52" />
      </div>
    );
  }

  /* ── FORM VIEW — exact prototype weighing-form-screen structure ── */
  return (
    <div dir="rtl" className="weighing-screen" style={{ display: "flex" }}>

      {/* ── Compact fixed top — weighing-fixed-top ── */}
      <div className="weighing-fixed-top">
        <div className="wf-nav-left">
          <button className="wf-back-btn" onClick={closeForm}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            חזרה
          </button>
          <span className="wf-breadcrumb">
            {weighType === "field" ? "שקילות > שקילת שטח" : weighType === "net" ? "שקילות > שקילת רשת" : "שקילות"}
          </span>
        </div>
        <span className={`weighing-type-badge ${weighType === "field" ? "wbadge-field" : weighType === "net" ? "wbadge-net" : ""}`}>
          {weighType === "field" ? "📐 שקילת שטח" : weighType === "net" ? "🥅 שקילת רשת" : "⚖️"}
        </span>
      </div>

      {/* ── Weighing type selector strip — wf-type-strip ── */}
      <div id="wf-type-strip" style={{ background: "white", borderBottom: "2px solid #e5e7eb", padding: "10px 14px", display: "flex", gap: "8px", flexWrap: "wrap", flexShrink: 0, alignItems: "center" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", whiteSpace: "nowrap", marginLeft: "4px" }}>
          סוג שקילה: <span style={{ color: "#ef4444" }}>*</span>
        </span>
        <button
          className={`tf-type-btn${weighType === "field" ? " active" : ""}`}
          id="wfbtn-field"
          type="button"
          onClick={() => setWeighType("field")}
          style={{ ["--tc" as string]: "#D97B1A", ["--ts" as string]: "#9E560E" }}
        >
          📐 שקילת שטח
        </button>
        <button
          className={`tf-type-btn${weighType === "net" ? " active" : ""}`}
          id="wfbtn-net"
          type="button"
          onClick={() => setWeighType("net")}
          style={{ ["--tc" as string]: "#2C7A52", ["--ts" as string]: "#1A5435" }}
        >
          🥅 שקילת רשת
        </button>
      </div>

      {/* ── Scrollable content — weighing-scrollable ── */}
      <div className="weighing-scrollable">

        {/* Prompt to select type first */}
        {!weighType && (
          <div id="wf-type-prompt" style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>☝️</div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#374151", marginBottom: "6px" }}>בחר סוג שקילה</div>
            <div style={{ fontSize: "13px" }}>לחץ על אחד הכפתורים בשורה למעלה כדי להתחיל</div>
          </div>
        )}

        {/* Form content — wf-form-content */}
        {weighType && (
          <div id="wf-form-content">

            {/* ── א. נתוני בריכה ── */}
            <div id="wf-parta-section">
              <div className="weighing-part-hdr">א. נתוני בריכה</div>
              <div className="weighing-card">

                {/* שורה 1: תאריך | שם בריכה | קוד בריכה */}
                <div className="wf-grid-3">
                  <div>
                    <label className="wf-label">תאריך ושעה</label>
                    <div style={{ display:"flex", gap:4 }}>
                      <input
                        type="date"
                        id="wf-datetime"
                        className="wf-input"
                        value={formDatetime.slice(0,10)}
                        onChange={e => { setFormDatetime(`${e.target.value}T${formDatetime.slice(11,16)||"00:00"}`); (e.target as HTMLInputElement).dataset.manualEdit = "1"; }}
                        style={{ fontSize:"11px", padding:"8px 4px", flex:1 }}
                      />
                      <input
                        type="text"
                        className="wf-input"
                        value={formDatetime.slice(11,16)}
                        onChange={e => { setFormDatetime(`${formDatetime.slice(0,10)}T${e.target.value}`); }}
                        placeholder="HH:mm"
                        maxLength={5}
                        style={{ fontSize:"11px", padding:"8px 4px", width:68 }}
                      />
                    </div>
                  </div>
                  <div style={{ position: "relative", zIndex: 120 }}>
                    <label className="wf-label">שם בריכה</label>
                    <PondCombobox ponds={ponds} value={formPondId} onChange={handlePondChange} />
                  </div>
                  <div>
                    <label className="wf-label opt">קוד</label>
                    <input
                      type="text"
                      id="wf-pool-code"
                      className="wf-input"
                      readOnly
                      value={formPondCode}
                      placeholder="—"
                      style={{ fontSize: "12px", textAlign: "center", padding: "8px 4px" }}
                    />
                  </div>
                </div>

                {/* hidden cycle inputs */}
                <input type="hidden" id="wf-cycle" />
                <input type="hidden" id="wf-priority-cycle" />

                {/* שורה 2: סוג דג */}
                <div className="wf-grid-full" style={{ marginBottom: 0, position: "relative", zIndex: 110 }}>
                  <label className="wf-label">סוג דג</label>
                  <input
                    type="text"
                    className="wf-input"
                    value={formFishType}
                    onChange={e => setFormFishType(e.target.value)}
                    placeholder="— בחר סוג דג —"
                    style={{ padding: "8px 30px 8px 10px", fontSize: "13px" }}
                  />
                </div>

              </div>
            </div>{/* /wf-parta-section */}

            {/* ── ב. חישובי סלים ── */}
            <div className="weighing-part-hdr">ב. חישובי סלים</div>
            <div className="weighing-card">
              <div className="basket-table-wrap">
                <table className="basket-table" id="wf-basket-table">
                  <colgroup>
                    <col style={{ width: "36px" }} />
                    <col style={{ width: "70px" }} />
                    <col />
                    <col />
                    <col />
                    <col style={{ width: "30px" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>שעה</th>
                      <th>{"משקל סל מלא (ק\"ג)"}</th>
                      <th>מספר דגים בסל</th>
                      <th>{"משקל דג ממוצע (גרם)"}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody id="wf-basket-tbody">
                    {stagedBaskets.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: "12px" }}>
                          לחץ &quot;+ הוסף סל&quot; להתחיל
                        </td>
                      </tr>
                    )}
                    {stagedBaskets.map((b, idx) => {
                      const wf = parseFloat(b.weightWithFish);
                      const fc = parseInt(b.fishCount, 10);
                      const avgG = wf > 0 && fc > 0 ? Math.round(wf / fc * 1000).toString() : "—";
                      return (
                        <tr key={b.tmpId}>
                          <td>{idx + 1}</td>
                          <td>
                            <input
                              type="text"
                              className="basket-input basket-time-live"
                              value={b.time}
                              onChange={e => updateBasket(b.tmpId, "time", e.target.value)}
                              placeholder="HH:mm"
                              maxLength={5}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="basket-input"
                              min="0"
                              step="0.1"
                              value={b.weightWithFish}
                              onChange={e => updateBasket(b.tmpId, "weightWithFish", e.target.value)}
                              required
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="basket-input"
                              min="0"
                              step="1"
                              value={b.fishCount}
                              onChange={e => updateBasket(b.tmpId, "fishCount", e.target.value)}
                              required
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="basket-input"
                              readOnly
                              value={avgG}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="basket-del-btn"
                              onClick={() => removeBasket(b.tmpId)}
                              title="מחק סל"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: "10px", color: "#9ca3af", textAlign: "left", marginTop: "3px", display: "flex", alignItems: "center", gap: "4px" }}>
                <span>◀ החלק לצפייה בכל העמודות</span>
              </div>
              <button className="add-basket-btn" type="button" onClick={addBasket}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                + הוסף סל
              </button>
            </div>

            {formError && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", color: "#dc2626", marginTop: "8px" }}>
                ⛔ {formError}
              </div>
            )}

          </div>
        )}{/* /wf-form-content */}
      </div>{/* /weighing-scrollable */}

      {/* ── Fixed bottom: summary row + save button — weighing-fixed-bottom ── */}
      {weighType && (
        <div className="weighing-fixed-bottom">
          {/* Summary row */}
          <div className="wf-summary-row" style={{ gridTemplateColumns: "30px 1fr 1fr 1fr" }}>
            <div className="wf-sum-cell" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div className="wf-sum-lbl" style={{ fontSize: "8px" }}>סלים</div>
              <div className="wf-sum-val" style={{ fontSize: "12px" }} id="wf-sum-count">{summary.count}</div>
            </div>
            <div className="wf-sum-cell">
              <div className="wf-sum-lbl">{"סה\"כ ק\"ג"}</div>
              <div className="wf-sum-val" id="wf-sum-weight">{summary.totalKg.toFixed(2)}</div>
            </div>
            <div className="wf-sum-cell">
              <div className="wf-sum-lbl">{"סה\"כ דגים"}</div>
              <div className="wf-sum-val" id="wf-sum-fish">{summary.totalFish}</div>
            </div>
            <div className="wf-sum-cell">
              <div className="wf-sum-lbl">ממוצע גרם</div>
              <div className="wf-sum-val" id="wf-sum-avg">{summary.avgGrams ? Math.round(summary.avgGrams) : "—"}</div>
            </div>
          </div>
          {/* Save button — centered, smaller */}
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 16px 12px", background: "white" }}>
            <button
              className="weighing-save-btn"
              id="wf-save-btn"
              type="button"
              onClick={(e) => handleSaveClick(e as unknown as FormEvent)}
              style={{ width: "auto", minWidth: "160px", maxWidth: "220px", padding: "11px 24px", fontSize: "14px", borderRadius: "10px" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              שמור שקילה
            </button>
          </div>
        </div>
      )}

      {/* ── Confirm overlay — weigh-confirm-overlay ── */}
      {showConfirm && weighType && (
        <div
          className="weigh-confirm-overlay show"
          onClick={e => { if (e.target === e.currentTarget && !saving) setShowConfirm(false); }}
        >
          <div className="weigh-confirm-box">
            {/* Top bar */}
            <div className="weigh-confirm-top">
              <div className="weigh-confirm-top-text">
                <h3>{weighType === "field" ? "📐" : "🥅"} סיכום שקילה</h3>
                <p>{weighType === "field" ? "שקילת שטח" : "שקילת רשת"}{selPond ? ` — ${selPond.name}` : ""}</p>
              </div>
              <div className="weigh-confirm-top-icon">✅</div>
            </div>

            {/* Body */}
            <div className="weigh-confirm-body">

              {/* Meta grid */}
              <div className="weigh-confirm-meta">
                {[
                  { label: "סוג שקילה",        value: weighType === "field" ? "📐 שקילת שטח" : "🥅 שקילת רשת" },
                  { label: "תאריך ושעה",       value: formDatetime.replace("T", " ") },
                  { label: "בריכה",             value: selPond ? `${selPond.name}${selPond.code ? ` (${selPond.code})` : ""}` : "—" },
                  { label: "קוד מזהה מחזור",   value: selPond?.activeCycleCode ?? "—" },
                  { label: "מחזור פריוריטי",   value: "—" },
                  { label: "סוג דג",            value: formFishType || "—" },
                  { label: "מועד שמירה",        value: (() => { const _n = new Date(); return `${_n.toLocaleDateString("he-IL")} ${String(_n.getHours()).padStart(2,"0")}:${String(_n.getMinutes()).padStart(2,"0")}`; })() },
                ].map(({ label, value }) => (
                  <div className="weigh-meta-item" key={label}>
                    <label>{label}</label>
                    <span>{value}</span>
                  </div>
                ))}
              </div>

              {/* Baskets table in confirm */}
              <div className="weigh-confirm-baskets">
                <table>
                  <thead>
                    <tr>
                      <th>סל#</th>
                      <th>{"משקל סל מלא (ק\"ג)"}</th>
                      <th>מספר דגים בסל</th>
                      <th>{"משקל דג ממוצע (גרם)"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stagedBaskets.map((b, idx) => {
                      const wf = parseFloat(b.weightWithFish);
                      const fc = parseInt(b.fishCount, 10);
                      const avgG = wf > 0 && fc > 0 ? Math.round(wf / fc * 1000) : "—";
                      return (
                        <tr key={b.tmpId}>
                          <td>{idx + 1}</td>
                          <td>{wf.toFixed(2)}</td>
                          <td>{b.fishCount}</td>
                          <td>{avgG}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="weigh-confirm-totals">
                <div className="wct-cell">
                  <div className="wct-lbl">{"סה\"כ ק\"ג"}</div>
                  <div className="wct-val">{summary.totalKg.toFixed(2)}</div>
                  <div className="wct-unit">{"ק\"ג"}</div>
                </div>
                <div className="wct-cell">
                  <div className="wct-lbl">{"סה\"כ דגים"}</div>
                  <div className="wct-val">{summary.totalFish}</div>
                  <div className="wct-unit">דגים</div>
                </div>
                <div className="wct-cell">
                  <div className="wct-lbl">ממוצע גרם</div>
                  <div className="wct-val">{summary.avgGrams ? Math.round(summary.avgGrams) : "—"}</div>
                  <div className="wct-unit">גרם</div>
                </div>
              </div>

              {confirmError && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", color: "#dc2626", marginBottom: "12px" }}>
                  ⛔ {confirmError}
                </div>
              )}

            </div>{/* /weigh-confirm-body */}

            {/* Action buttons */}
            <div className="weigh-confirm-actions">
              <button
                className="weigh-confirm-save-btn"
                type="button"
                onClick={commitSave}
                disabled={saving}
                style={{ opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                {saving ? "שומר..." : "שמור שקילה"}
              </button>
              <button
                className="weigh-confirm-cancel-btn"
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={saving}
                style={{ cursor: saving ? "not-allowed" : "pointer" }}
              >
                ביטול
              </button>
            </div>

          </div>{/* /weigh-confirm-box */}
        </div>
      )}{/* /weigh-confirm-overlay */}

    </div>
  );
}
