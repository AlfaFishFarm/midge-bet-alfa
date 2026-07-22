"use client";

import { useState, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ConfirmDialog from "@/components/ConfirmDialog";
import PondCombobox from "@/components/PondCombobox";
import ErrorBanner from "@/components/ErrorBanner";

interface OpenCycleInfo {
  id: string;
  priorityCycleCode: string | null;
  openedAt: string;
  openNotes: string | null;
  hasTransfers: boolean;
}

interface PondOption {
  id: string;
  name: string;
  code: string | null;
  openCycle: OpenCycleInfo | null;
}

interface Props {
  ponds: PondOption[];
}

function nowStr() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// "YYYY-MM-DDTHH:mm" strings compare correctly as plain strings ONLY when the
// hour is always 2 digits. The time field is free text, so a value like "9:24"
// (no leading zero) breaks that assumption — lexicographic comparison then
// treats "9:24" as greater than "14:10" (the char '9' > '1'), which falsely
// flags an earlier same-day time as "in the future". Parse to a real Date
// instead, padding hour/minute defensively, so comparisons are always correct
// regardless of how the user typed the time.
function toDateSafe(str: string): Date {
  const [datePart, timePart = ""] = str.split("T");
  const [hh = "00", mm = "00"] = timePart.split(":");
  return new Date(`${datePart}T${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`);
}

// Normalize a raw "HH:mm" text-field value (may be missing the leading zero)
// into a proper 2-digit:2-digit string once the user leaves the field.
function normalizeTime(t: string): string {
  const m = t.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return t;
  return `${m[1].padStart(2, "0")}:${m[2].padStart(2, "0")}`;
}

function computeCycleCode(pond: PondOption | null, dateStr: string): string {
  if (!pond || !dateStr) return "";
  const code = pond.code ?? pond.name;
  return `${code}-${dateStr.slice(0, 10).replaceAll("-", "")}`;
}

export default function OpenPoolClient({ ponds }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [selectedPondId, setSelectedPondId] = useState("");
  const [priorityCycleCode, setPriorityCycleCode] = useState("");
  const [openedAt, setOpenedAt] = useState(nowStr());
  const [openNotes, setOpenNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Lock/unlock state: when an open pond is selected, fields are locked until user clicks "ערוך פתוחה"
  const [editUnlocked, setEditUnlocked] = useState(false);

  const selectedPond = ponds.find((p) => p.id === selectedPondId) ?? null;
  const isEdit = !!selectedPond?.openCycle;
  // Fields are locked when viewing an open pond before clicking the edit button
  const isLocked = isEdit && !editUnlocked;

  function selectPond(id: string) {
    setSelectedPondId(id);
    setError(null);
    setEditError(null);
    setEditUnlocked(false); // always reset lock on pond change
    const p = ponds.find((x) => x.id === id);
    if (!p) return;
    if (p.openCycle) {
      setPriorityCycleCode(p.openCycle.priorityCycleCode ?? "");
      setOpenedAt(p.openCycle.openedAt.slice(0, 16));
      setOpenNotes(p.openCycle.openNotes ?? "");
    } else {
      setPriorityCycleCode("");
      setOpenedAt(nowStr());
      setOpenNotes("");
    }
  }

  // Prototype: opEditOpenPool() blocks edit if pool has transfers
  function handleEditClick() {
    setEditError(null);
    if (selectedPond?.openCycle?.hasTransfers) {
      setEditError('לא ניתן לבצע עריכה — כבר נעשו פעולות העברה בבריכה זו');
      return;
    }
    setEditUnlocked(true);
  }

  const cycleCode = computeCycleCode(selectedPond, openedAt);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedPond) { setError("יש לבחור בריכה"); return; }
    if (!openedAt) { setError("יש להזין תאריך פתיחה"); return; }
    if (toDateSafe(openedAt) > new Date()) { setError("תאריך פתיחה לא יכול להיות בעתיד"); return; }
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    if (!selectedPond) return;
    setLoading(true);
    try {
      const url = isEdit ? `/api/cycles/${selectedPond.openCycle!.id}` : "/api/cycles";
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit
        ? { priorityCycleCode: priorityCycleCode || undefined, openedAt, openNotes }
        : { pondId: selectedPond.id, priorityCycleCode: priorityCycleCode || undefined, openedAt, openNotes };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setConfirmOpen(false);
        setError(data.error ?? "שגיאה בשמירה");
        return;
      }
      router.push("/ops/management");
      router.refresh();
    } catch {
      setConfirmOpen(false);
      setError("שגיאת תקשורת. נסה שוב.");
    } finally {
      setLoading(false);
    }
  }

  // Submit button appearance per mode
  const submitBtnStyle: React.CSSProperties = isLocked
    ? { background: "#9ca3af", cursor: "not-allowed" }
    : isEdit
    ? { background: "#d97706" }
    : {};

  const submitBtnText = isLocked
    ? '✏️ לחץ "ערוך פתוחה" כדי לערוך'
    : isEdit
    ? "💾 שמור עדכון"
    : "🏊 פתח בריכה";

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="pool-form-wrap">

      {/* Header: back button + breadcrumb */}
      <div className="pool-form-header">
        <Link href="/ops/management" className="sub-back-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          חזרה
        </Link>
        <div className="sub-breadcrumb">
          <span>ניהול תפעול</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span style={{ color: "#1A2B1F", fontWeight: 600 }}>פתיחת בריכה</span>
        </div>
      </div>

      {/* Title row */}
      <div className="pool-form-title-row">
        <div className="pft-title">🏊 פתיחת בריכה</div>
        <div className="pft-sub">
          {isEdit ? "עריכת פרטי מחזור גידול" : "פתיחת מחזור גידול חדש"}
        </div>
      </div>

      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

      {/* Form card */}
      <div className="pool-form-card">

        {/* Pool dropdown + pool code on same row */}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label className="pf-label">בחר בריכה</label>
            <PondCombobox
              ponds={ponds}
              value={selectedPondId}
              onChange={selectPond}
              placeholder="— בחר בריכה —"
              labelExtra={(p) => (p.openCycle ? "פתוחה" : "סגורה")}
              inputStyle={{
                width: "100%",
                padding: "10px 14px",
                border: "1.5px solid #e5e7eb",
                borderRadius: 8,
                fontSize: 14,
                fontFamily: "'Heebo','Segoe UI',sans-serif",
                color: "#9ca3af",
                background: "white",
                outline: "none",
                boxSizing: "border-box" as React.CSSProperties["boxSizing"],
                cursor: "pointer",
                transition: "border-color .15s",
              }}
            />
          </div>
          <div style={{ flex: "0 0 130px" }}>
            <label className="pf-label opt">קוד בריכה</label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="text"
                readOnly
                value={selectedPond?.code ?? ""}
                placeholder="אוטומטי"
                className="pf-input"
                style={{ flex: 1 }}
              />
              {/* Orange edit button — shown only when open pond selected and not yet unlocked */}
              {isLocked && (
                <button
                  type="button"
                  title="ערוך פתיחת בריכה פתוחה"
                  onClick={handleEditClick}
                  style={{
                    background: "#d97706",
                    color: "white",
                    border: "none",
                    borderRadius: 7,
                    padding: "9px 12px",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  ✏️ ערוך פתוחה
                </button>
              )}
            </div>
            {/* Transfer block error — shown below code row, like prototype */}
            {editError && (
              <div style={{
                background: "#fef2f2",
                border: "1.5px solid #fca5a5",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 600,
                color: "#dc2626",
                marginTop: 6,
              }}>
                ❌ {editError}
              </div>
            )}
          </div>
        </div>

        <hr className="pf-divider" />

        {/* Date */}
        <div>
          <label className="pf-label">תאריך ושעה</label>
          <div style={{ display:"flex", gap:4 }}>
            <input
              type="date"
              value={openedAt.slice(0,10)}
              onChange={(e) => setOpenedAt(`${e.target.value}T${openedAt.slice(11,16)||"00:00"}`)}
              max={nowStr().slice(0,10)}
              disabled={!selectedPond || isLocked}
              required
              className="pf-input"
              style={{ flex:1, ...(isLocked ? { background:"#f1f5f9", color:"#9ca3af", cursor:"not-allowed" } : {}) }}
            />
            <input
              type="text"
              value={openedAt.slice(11,16)}
              onChange={(e) => setOpenedAt(`${openedAt.slice(0,10)}T${e.target.value}`)}
              onBlur={(e) => setOpenedAt(`${openedAt.slice(0,10)}T${normalizeTime(e.target.value)}`)}
              placeholder="HH:mm"
              maxLength={5}
              disabled={!selectedPond || isLocked}
              className="pf-input"
              style={{ width:72, ...(isLocked ? { background:"#f1f5f9", color:"#9ca3af", cursor:"not-allowed" } : {}) }}
            />
          </div>
        </div>

        {/* מחזור פריוריטי */}
        <div style={{ marginTop: 10 }}>
          <label className="pf-label opt">מחזור פריוריטי</label>
          <input
            type="text"
            value={priorityCycleCode}
            onChange={(e) => setPriorityCycleCode(e.target.value)}
            disabled={!selectedPond || isLocked}
            placeholder="מספר מחזור ממערכת פריוריטי"
            className="pf-input"
            style={isLocked ? { background: "#f1f5f9", color: "#9ca3af", cursor: "not-allowed" } : {}}
          />
        </div>

        {/* קוד מזהה מחזור — readonly */}
        <div style={{ marginTop: 10 }}>
          <label className="pf-label opt">קוד מזהה מחזור</label>
          <input
            type="text"
            readOnly
            value={cycleCode}
            placeholder="יתמלא אוטומטית"
            className="pf-input"
          />
        </div>

        <hr className="pf-divider" />

        {/* הערות */}
        <div>
          <label className="pf-label opt">הערות</label>
          <textarea
            value={openNotes}
            onChange={(e) => setOpenNotes(e.target.value)}
            rows={2}
            disabled={!selectedPond || isLocked}
            placeholder="הערות לפתיחת המחזור..."
            className="pf-textarea"
            style={isLocked ? { background: "#f1f5f9", color: "#9ca3af", cursor: "not-allowed" } : {}}
          />
        </div>

      </div>

      <button
        type="submit"
        disabled={!selectedPond || isLocked}
        className={`pool-submit-btn${isEdit && editUnlocked ? "" : " pool-submit-teal"}`}
        style={submitBtnStyle}
        id="op-submit-btn"
      >
        {submitBtnText}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        icon="🏊"
        title={isEdit ? "אישור עדכון פרטי מחזור" : "אישור פתיחת בריכה"}
        rows={[
          { label: "שם בריכה", value: selectedPond?.name ?? "—" },
          { label: "קוד בריכה", value: selectedPond?.code ?? "—" },
          { label: "תאריך ושעת פתיחה", value: openedAt.replace("T", " ") },
          { label: "קוד מזהה מחזור", value: cycleCode || "—" },
          { label: "מחזור פריוריטי", value: priorityCycleCode || "—" },
          { label: "הערות", value: openNotes || "—" },
        ]}
        confirmLabel={loading ? "שומר..." : "שמירה"}
        loading={loading}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </form>
  );
}
