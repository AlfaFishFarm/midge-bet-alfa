"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ConfirmDialog from "@/components/ConfirmDialog";
import PondCombobox from "@/components/PondCombobox";
import ErrorBanner from "@/components/ErrorBanner";

interface Balance {
  incoming: number;
  outgoing: number;
  mortality: number;
  difference: number;
  withinTolerance: boolean;
}

interface CycleInfo {
  id: string;
  priorityCycleCode: string | null;
  openedAt: string;
  closedAt: string | null;
  closeNotes: string | null;
  balance: Balance | null;
}

interface PondOption {
  id: string;
  name: string;
  code: string | null;
  status: "open" | "closed" | "noCycle";
  openCycleOpenedAt: string | null;
  lastClosedCycleClosedAt: string | null;
  cycle: CycleInfo | null;
}

interface Props {
  ponds: PondOption[];
  anyMissingPriority: boolean;
}

function nowStr() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function computeCycleCode(pond: PondOption | null): string {
  if (!pond || !pond.cycle) return "—";
  const code = pond.code ?? pond.name;
  return `${code}-${pond.cycle.openedAt.slice(0, 10).replaceAll("-", "")}`;
}

function BalanceSummary({ balance }: { balance: Balance }) {
  const withinTolerance = balance.withinTolerance;
  return (
    <div
      style={{
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 12,
        fontWeight: 500,
        background: withinTolerance ? "#eff6ff" : "#fef2f2",
        border: `1px solid ${withinTolerance ? "#bfdbfe" : "#fecaca"}`,
        color: withinTolerance ? "#1e3a5f" : "#7f1d1d",
      }}
    >
      <p>
        סה&quot;כ הוכנסו לבריכה{" "}
        <strong>{balance.incoming.toLocaleString()}</strong> דגים,
        הוצאו <strong>{balance.outgoing.toLocaleString()}</strong>,
        פחת <strong>{balance.mortality.toLocaleString()}</strong>
      </p>
      <p style={{ marginTop: 4, fontSize: 11, color: withinTolerance ? "#1e40af" : "#991b1b", fontWeight: 600 }}>
        הפרש: {balance.difference > 0 ? "+" : ""}
        {balance.difference.toLocaleString()} דגים
        {!withinTolerance && " — מחוץ לטווח הסבול (±100)"}
      </p>
    </div>
  );
}

export default function ClosePoolClient({ ponds, anyMissingPriority }: Props) {
  const router = useRouter();

  const [selectedPondId, setSelectedPondId] = useState("");
  const [priorityCycleCode, setPriorityCycleCode] = useState("");
  const [closedAt, setClosedAt] = useState(nowStr());
  const [closeNotes, setCloseNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editUnlocked, setEditUnlocked] = useState(false);

  const selectedPond = ponds.find((p) => p.id === selectedPondId) ?? null;
  const isEditClosed = selectedPond?.status === "closed";
  const openedAtFull = selectedPond?.cycle?.openedAt.slice(0, 16) ?? "";
  const hasExistingCode = !!selectedPond?.cycle?.priorityCycleCode;

  const selectedPondMissingPriority =
    !!selectedPond && !isEditClosed && !hasExistingCode && !priorityCycleCode;

  const showPriorityWarning = !isEditClosed && (
    !selectedPond ? anyMissingPriority : selectedPondMissingPriority
  );

  const submitDisabledByPriority =
    !isEditClosed && (
      !selectedPond ? anyMissingPriority : selectedPondMissingPriority
    );

  function selectPond(id: string) {
    setSelectedPondId(id);
    setError(null);
    const p = ponds.find((x) => x.id === id);
    if (!p || !p.cycle) return;
    setPriorityCycleCode(p.cycle.priorityCycleCode ?? "");
    setClosedAt(p.status === "closed" ? p.cycle.closedAt!.slice(0, 16) : nowStr());
    setCloseNotes(p.cycle.closeNotes ?? "");
    setEditUnlocked(p.status !== "closed");
  }

  const cycleCode = computeCycleCode(selectedPond);

  const submitLabel = isEditClosed ? "עדכן פרטי מחזור גידול בבריכה" : "סגור בריכה";
  const confirmTitle = isEditClosed ? "אישור עדכון פרטי סגירה" : "אישור סגירת מחזור גידול";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedPond || !selectedPond.cycle) { setError("יש לבחור בריכה"); return; }
    if (!closedAt) { setError("יש להזין תאריך סגירה"); return; }
    if (closedAt > nowStr()) { setError("תאריך סגירה לא יכול להיות בעתיד"); return; }
    if (closedAt < openedAtFull) { setError("תאריך סגירה לא יכול להיות לפני תאריך הפתיחה"); return; }
    if (!hasExistingCode && !priorityCycleCode) {
      setError("קוד Priority נדרש לסגירת מחזור — הזן קוד לפני הסגירה");
      return;
    }
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    if (!selectedPond || !selectedPond.cycle) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cycles/${selectedPond.cycle.id}/close`, {
        method: isEditClosed ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priorityCycleCode: priorityCycleCode || undefined,
          closedAt,
          closeNotes: closeNotes || undefined,
        }),
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
      setError("שגיאת תקשורת. נסה שנית.");
    } finally {
      setLoading(false);
    }
  }

  const balance = !isEditClosed ? selectedPond?.cycle?.balance ?? null : null;

  const balanceConfirmRows: Array<{ label: string; value: string; highlight?: "blue" | "red" }> = balance
    ? [
        {
          label: "מאזן דגים",
          value: `הוכנסו ${balance.incoming.toLocaleString()}, הוצאו ${balance.outgoing.toLocaleString()}, פחת ${balance.mortality.toLocaleString()}`,
          highlight: balance.withinTolerance ? "blue" : "red",
        },
        {
          label: "הפרש",
          value:
            (balance.difference > 0 ? "+" : "") +
            balance.difference.toLocaleString() +
            " דגים" +
            (!balance.withinTolerance ? " ⚠️ מחוץ לטווח" : ""),
          highlight: balance.withinTolerance ? "blue" : "red",
        },
      ]
    : [];

  const confirmRows = isEditClosed
    ? [
        { label: "שם בריכה", value: selectedPond?.name ?? "—" },
        { label: "תאריך סגירה מעודכן", value: closedAt.replace("T", " ") },
        { label: "הערות סגירה", value: closeNotes || "—" },
      ]
    : [
        { label: "שם בריכה", value: selectedPond?.name ?? "—" },
        { label: "קוד בריכה", value: selectedPond?.code ?? "—" },
        { label: "תאריך פתיחה", value: openedAtFull.replace("T", " ") },
        { label: "תאריך סגירה", value: closedAt.replace("T", " ") },
        { label: "מספר מחזור אפליקציה", value: cycleCode },
        { label: "מחזור פריוריטי", value: priorityCycleCode || "—" },
        ...balanceConfirmRows,
        { label: "הערות סגירה", value: closeNotes || "—" },
      ];

  const pondOptionsForPicker = ponds.map((p) => ({ ...p, disabled: p.status === "noCycle" }));

  return (
    <form onSubmit={handleSubmit} className="pool-form-wrap">

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
          <span style={{ color: "#1A2B1F", fontWeight: 600 }}>סגירה (חיסול) בריכה</span>
        </div>
      </div>

      {/* Title row */}
      <div className="pool-form-title-row">
        <div className="pft-title">🔒 סגירה (חיסול) בריכה</div>
        <div className="pft-sub">{isEditClosed ? "עריכת פרטי מחזור גידול" : "סגירת מחזור גידול"}</div>
      </div>

      {/* Warning banner — missing priority */}
      {showPriorityWarning && (
        <div className="pool-warn-banner" id="cp-no-priority-warning">
          ⚠️ קיים מחזור פעיל ללא קוד פריוריטי. יש להשלים את הקוד לפני ביצוע סגירה.
        </div>
      )}

      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

      {/* Form card */}
      <div className="pool-form-card">

        {/* Row 1: Pool dropdown + auto pool code + edit button */}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label className="pf-label">בחר בריכה</label>
            <PondCombobox
              ponds={pondOptionsForPicker}
              value={selectedPondId}
              onChange={selectPond}
              placeholder="— בחר בריכה —"
              labelExtra={(p) =>
                p.status === "noCycle" ? "ללא מחזור" : p.status === "open" ? "פתוחה" : "סגורה"
              }
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
              panelStyle={{ borderColor: "#E8544A" }}
            />
          </div>
          {/* Pool code display + optional edit-closed button */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start", flexShrink: 0 }}>
            <label className="pf-label opt" style={{ visibility: "hidden" }}>.</label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <div
                id="cp-pool-code-display"
                className="pf-input"
                style={{
                  background: "#f1f5f9",
                  color: "#374151",
                  fontWeight: 700,
                  fontSize: 15,
                  letterSpacing: 1,
                  minWidth: 60,
                  textAlign: "center",
                  cursor: "default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {selectedPond?.code ?? "—"}
              </div>
              {isEditClosed && !editUnlocked && (
                <button
                  id="cp-edit-closed-btn"
                  type="button"
                  onClick={() => setEditUnlocked(true)}
                  style={{
                    background: "#d97706",
                    color: "white",
                    border: "none",
                    borderRadius: 7,
                    padding: "9px 12px",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "'Heebo','Segoe UI',sans-serif",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  ✏️ ערוך סגורה
                </button>
              )}
            </div>
          </div>
        </div>

        <hr className="pf-divider" />

        {/* Row 2: Open date (display) + Close datetime — pf-grid-2 */}
        <div className="pf-grid-2" style={{ marginTop: 0 }}>
          <div>
            <label className="pf-label opt">תאריך פתיחה</label>
            <div
              id="cp-open-date-display"
              className="pf-input"
              style={{
                background: "#f1f5f9",
                color: "#374151",
                display: "flex",
                alignItems: "center",
                cursor: "default",
              }}
            >
              {openedAtFull ? openedAtFull.replace("T", " ") : "—"}
            </div>
          </div>
          <div>
            <label className="pf-label">תאריך סגירה</label>
            <div style={{ display:"flex", gap:4 }}>
              <input
                type="date"
                value={closedAt.slice(0,10)}
                onChange={(e) => setClosedAt(`${e.target.value}T${closedAt.slice(11,16)||"00:00"}`)}
                min={openedAtFull ? openedAtFull.slice(0,10) : undefined}
                max={nowStr().slice(0,10)}
                disabled={!selectedPond || (isEditClosed && !editUnlocked)}
                required
                className="pf-input"
                style={{ flex:1 }}
              />
              <input
                type="text"
                value={closedAt.slice(11,16)}
                onChange={(e) => setClosedAt(`${closedAt.slice(0,10)}T${e.target.value}`)}
                placeholder="HH:mm"
                maxLength={5}
                disabled={!selectedPond || (isEditClosed && !editUnlocked)}
                className="pf-input"
                style={{ width:72 }}
              />
            </div>
          </div>
        </div>

        {/* Cycle fields — pf-grid-2 */}
        <div className="pf-grid-2">
          <div>
            <label className="pf-label opt">קוד מזהה מחזור</label>
            <input
              type="text"
              id="cp-cycle-app"
              readOnly
              value={cycleCode}
              placeholder="אוטומטי"
              className="pf-input"
            />
          </div>
          <div>
            <label className="pf-label opt">מחזור פריוריטי</label>
            <input
              type="text"
              id="cp-cycle-priority"
              readOnly={!isEditClosed && hasExistingCode}
              value={priorityCycleCode}
              onChange={(e) => setPriorityCycleCode(e.target.value)}
              disabled={!selectedPond || (isEditClosed && !editUnlocked) || (!isEditClosed && hasExistingCode)}
              placeholder="אוטומטי"
              className="pf-input"
            />
          </div>
        </div>

        <hr className="pf-divider" />

        {/* הערות */}
        <div>
          <label className="pf-label opt">הערות</label>
          <textarea
            id="cp-notes"
            value={closeNotes}
            onChange={(e) => setCloseNotes(e.target.value)}
            rows={2}
            disabled={!selectedPond || (isEditClosed && !editUnlocked)}
            placeholder="הערות לסגירת המחזור..."
            className="pf-textarea"
          />
        </div>

        {/* Balance summary — shown only for open ponds being closed */}
        {balance && (
          <div style={{ marginTop: 10 }}>
            <BalanceSummary balance={balance} />
          </div>
        )}

      </div>

      {/* Locked message */}
      {isEditClosed && !editUnlocked && (
        <div id="cp-locked-msg" className="cp-locked-msg">
          🔒 בריכה סגורה — לחץ על &quot;ערוך סגורה&quot; כדי לערוך
        </div>
      )}

      <button
        type="submit"
        id="cp-submit-btn"
        disabled={!selectedPond || submitDisabledByPriority || (isEditClosed && !editUnlocked)}
        className="pool-submit-btn pool-submit-red"
      >
        🔒 {submitLabel}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        icon={isEditClosed ? "✅" : "🔒"}
        rows={confirmRows}
        confirmLabel={loading ? "שומר..." : isEditClosed ? "עדכן" : "סגור מחזור"}
        confirmWarning={
          balance && !balance.withinTolerance
            ? `⚠️ מאזן חריג: הפרש של ${balance.difference > 0 ? "+" : ""}${balance.difference.toLocaleString()} דגים (מחוץ לטווח ±100). ניתן לסגור — וודא שהנתונים מדויקים.`
            : undefined
        }
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </form>
  );
}
