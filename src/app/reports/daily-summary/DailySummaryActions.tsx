"use client";

import { useState, useRef } from "react";

// ─── Prop types (plain serialisable objects only — passed from server component) ─
export interface TransferRowData {
  id: string;
  transferType: string;
  fish: string;
  source: string;
  supplier: string;
  dest: string;
  fishCount: number | null;
  avgWeightGrams: number | null;
  totalWeightKg: number | null;
}

export interface WeighingRowData {
  id: string;
  type: string;
  pond: string;
  fish: string;
  fishCount: number;
  avgWeightGrams: number | null;
  totalNetKg: number;
}

export interface CycleRowData {
  id: string;
  pond: string;
  action: string;
  cycle: string;
  time: string;
}

interface Props {
  dateLabel: string;
  transferRows: TransferRowData[];
  weighingRows: WeighingRowData[];
  cycleRows: CycleRowData[];
}

function buildSummaryText(
  dateLabel: string,
  transferRows: TransferRowData[],
  weighingRows: WeighingRowData[],
  cycleRows: CycleRowData[],
  notes: string
): string {
  const lines: string[] = [];
  lines.push(`*סיכום יומי — מדגה בית-אלפא*`);
  lines.push(`תאריך: ${dateLabel}`);
  lines.push("");

  lines.push(`*העברות:*`);
  if (transferRows.length === 0) {
    lines.push("אין פעולות העברות להיום");
  } else {
    for (const r of transferRows) {
      const count = r.fishCount != null ? `${r.fishCount.toLocaleString("he-IL")} דגים` : "";
      const avg = r.avgWeightGrams != null ? ` | ממוצע ${Math.round(r.avgWeightGrams).toLocaleString("he-IL")} גר'` : "";
      const weight = r.totalWeightKg != null ? ` | ${r.totalWeightKg.toFixed(1)} ק"ג` : "";
      const supplier = r.supplier !== "—" ? ` | ספק: ${r.supplier}` : "";
      lines.push(`• ${r.transferType} — ${r.fish} | ${r.source}${supplier} ➜ ${r.dest}${count ? " | " + count : ""}${avg}${weight}`);
    }
  }
  lines.push("");

  lines.push(`*שקילות:*`);
  if (weighingRows.length === 0) {
    lines.push("אין פעולות שקילות להיום");
  } else {
    for (const r of weighingRows) {
      const avg = r.avgWeightGrams != null ? ` | ממוצע ${Math.round(r.avgWeightGrams).toLocaleString("he-IL")} גר'` : "";
      lines.push(`• ${r.type} — ${r.fish} | ${r.pond} | ${r.fishCount.toLocaleString("he-IL")} דגים${avg} | ${r.totalNetKg.toFixed(1)} ק"ג`);
    }
  }
  lines.push("");

  lines.push(`*פתיחות וסגירות בריכות:*`);
  if (cycleRows.length === 0) {
    lines.push("אין פתיחות/סגירות בריכות להיום");
  } else {
    for (const r of cycleRows) {
      lines.push(`• ${r.action} — ${r.pond} | מחזור: ${r.cycle}${r.time ? ` | שעה: ${r.time}` : ""}`);
    }
  }

  if (notes.trim()) {
    lines.push("");
    lines.push(`*הערות:*`);
    lines.push(notes.trim());
  }

  return lines.join("\n");
}

export default function DailySummaryActions({
  dateLabel,
  transferRows,
  weighingRows,
  cycleRows,
}: Props) {
  const [notes, setNotes] = useState("");
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleCreateSummary() {
    const text = buildSummaryText(dateLabel, transferRows, weighingRows, cycleRows, notes);
    setSummaryText(text);
    setCopied(false);
  }

  function handleClose() {
    setSummaryText(null);
    setCopied(false);
  }

  async function handleCopy() {
    if (!summaryText) return;
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      if (textareaRef.current) textareaRef.current.select();
    }
  }

  function handleWhatsApp() {
    if (!summaryText) return;
    const encoded = encodeURIComponent(summaryText);
    window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      {/* Prototype: .form-card { background:white; border-radius:14px; padding:20px 18px;
          box-shadow:0 2px 14px rgba(0,0,0,0.07); margin-bottom:14px; }
          .form-label { display:block; font-size:13px; font-weight:600; color:#374151; margin-bottom:6px; }
          .form-textarea { width:100%; padding:11px 14px; border:1.5px solid #e5e7eb;
            border-radius:8px; font-size:14px; font-family:inherit; color:#1a2744;
            outline:none; background:white; resize:vertical; min-height:80px; }
          focus: border-color:#93c5fd */}
      <div
        style={{
          background: "white",
          borderRadius: "14px",
          padding: "20px 18px",
          boxShadow: "0 2px 14px rgba(0,0,0,0.07)",
          marginBottom: "14px",
          marginTop: "4px",
        }}
      >
        <div style={{ marginBottom: 0 }}>
          <label
            htmlFor="ds-notes"
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 600,
              color: "#374151",
              marginBottom: "6px",
            }}
          >
            הערות נוספות
          </label>
          <textarea
            id="ds-notes"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="הערות חופשיות לסיכום היומי..."
            style={{
              width: "100%",
              padding: "11px 14px",
              border: "1.5px solid #e5e7eb",
              borderRadius: "8px",
              fontSize: "14px",
              fontFamily: "inherit",
              color: "#1a2744",
              outline: "none",
              background: "white",
              resize: "vertical",
              minHeight: "80px",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#93c5fd")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
          />
        </div>
      </div>

      {/* Prototype: .action-btn.action-btn-purple
          width:100%; padding:14px; border-radius:10px; border:none; cursor:pointer;
          font-size:16px; font-weight:700; font-family:inherit; color:white;
          background:#9B59CF; display:flex; align-items:center;
          justify-content:center; gap:8px; margin-top:4px;
          hover: background:#7C3AB0 */}
      <button
        onClick={handleCreateSummary}
        style={{
          width: "100%",
          padding: "14px",
          borderRadius: "10px",
          border: "none",
          fontSize: "16px",
          fontWeight: 700,
          color: "white",
          background: "#9B59CF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          marginTop: "4px",
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "all .15s",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#7C3AB0")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#9B59CF")}
      >
        <span>📋</span>
        <span>צור סיכום</span>
      </button>

      {/* Summary modal overlay */}
      {summaryText !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
            padding: "16px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div
            style={{
              position: "relative",
              display: "flex",
              maxHeight: "88vh",
              width: "100%",
              maxWidth: "520px",
              flexDirection: "column",
              borderRadius: "14px",
              background: "white",
              boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
            }}
            dir="rtl"
          >
            {/* Header — dark green matching prototype's #1B3A2B pattern */}
            <div
              style={{
                background: "#1B3A2B",
                color: "white",
                padding: "18px 22px",
                borderRadius: "14px 14px 0 0",
              }}
            >
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, marginBottom: "2px" }}>סיכום יומי</h3>
              <p style={{ fontSize: "12px", opacity: 0.7, margin: 0 }}>
                מדגה בית-אלפא | {dateLabel}
              </p>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
              <textarea
                ref={textareaRef}
                readOnly
                value={summaryText}
                rows={16}
                style={{
                  width: "100%",
                  resize: "none",
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                  background: "#f9fafb",
                  padding: "12px",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  lineHeight: "1.6",
                  color: "#374151",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Actions */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                borderTop: "1px solid #f3f4f6",
                padding: "16px 22px",
              }}
            >
              {/* WhatsApp / send button */}
              <button
                onClick={handleWhatsApp}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  borderRadius: "8px",
                  background: "#25D366",
                  border: "none",
                  padding: "11px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "white",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all .15s",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#1ebe57")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#25D366")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M11.99 0C5.374 0 0 5.373 0 11.988c0 2.108.549 4.151 1.595 5.945L0 24l6.232-1.566a11.938 11.938 0 005.757 1.471h.005C18.61 23.905 24 18.528 24 11.912 24 5.374 18.61 0 11.99 0zm.01 21.877a9.895 9.895 0 01-5.031-1.373l-.361-.214-3.741.981.999-3.648-.235-.374A9.88 9.88 0 012.12 11.99C2.12 6.523 6.52 2.12 12 2.12c5.478 0 9.878 4.4 9.878 9.87 0 5.478-4.4 9.887-9.878 9.887z" />
                </svg>
                <span>שמור ושלח בווטסאפ</span>
              </button>

              <button
                onClick={handleCopy}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#f3f4f6",
                  padding: "11px 18px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#374151",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all .15s",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#e5e7eb")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#f3f4f6")}
              >
                {copied ? (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>הועתק!</span>
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    <span>העתק ללוח</span>
                  </>
                )}
              </button>

              <button
                onClick={handleClose}
                style={{
                  borderRadius: "8px",
                  border: "none",
                  padding: "11px 18px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#374151",
                  cursor: "pointer",
                  background: "#f3f4f6",
                  fontFamily: "inherit",
                  transition: "all .15s",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#e5e7eb")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#f3f4f6")}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
