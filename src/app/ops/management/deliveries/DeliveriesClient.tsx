"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface DeliveryRow {
  id: string;
  date: string;           // ISO string
  clientName: string;
  totalQuantity: number;  // total fish count across all details
  status: string;
}

interface Props {
  initialOpen: DeliveryRow[];
  initialClosed: DeliveryRow[];
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Shorten CUID for display as delivery code
function shortCode(id: string) {
  return id.slice(-8).toUpperCase();
}

// ─── Confirm-cancel dialog ────────────────────────────────────────────────────
function CancelDialog({
  delivery,
  onConfirm,
  onClose,
}: {
  delivery: DeliveryRow;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    await onConfirm();
    setLoading(false);
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff", borderRadius: 16, padding: "28px 28px 24px",
          maxWidth: 380, width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 17, fontWeight: 700, color: "#1a2744", marginBottom: 10 }}>
          ביטול תעודת משלוח
        </div>
        <div style={{ fontSize: 14, color: "#555", marginBottom: 22, lineHeight: 1.6 }}>
          האם לבטל את תעודת המשלוח של <strong>{delivery.clientName}</strong> מתאריך{" "}
          <strong>{formatDate(delivery.date)}</strong>?<br />
          <span style={{ color: "#E8544A", fontSize: 13 }}>
            הביטול הוא בלתי חוזר — התעודה תסומן כמבוטלת.
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: "8px 20px", borderRadius: 8, border: "1.5px solid #d1d5db",
              background: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "#374151",
            }}
          >
            ביטול
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            style={{
              padding: "8px 20px", borderRadius: 8, border: "none",
              background: loading ? "#f87171" : "#E8544A", color: "#fff",
              fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "מבטל..." : "אישור ביטול"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────
function DeliveryTableRow({
  row,
  onCancel,
  showApprove,
}: {
  row: DeliveryRow;
  onCancel: (row: DeliveryRow) => void;
  showApprove: boolean;
}) {
  const router = useRouter();

  return (
    <tr style={{ borderBottom: "1px solid #e8e4dc" }}>
      <td style={tdStyle}>{formatDate(row.date)}</td>
      <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12, color: "#6b7280" }}>
        #{shortCode(row.id)}
      </td>
      <td style={{ ...tdStyle, fontWeight: 600 }}>{row.clientName}</td>
      <td style={{ ...tdStyle, textAlign: "center" }}>
        {row.totalQuantity > 0 ? row.totalQuantity.toLocaleString("he-IL") : "—"}
      </td>
      <td style={{ ...tdStyle, textAlign: "center" }}>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", alignItems: "center" }}>
          {/* Status badge for open tab */}
          {showApprove && row.status === "ממתין לאישור" && (
            <span style={{
              padding: "2px 9px", borderRadius: 99, fontSize: 11, fontWeight: 700,
              background: "#fef3c7", color: "#92400e", whiteSpace: "nowrap",
            }}>
              ממתין לאישור
            </span>
          )}
          {showApprove && row.status === "טיוטא" && (
            <span style={{
              padding: "2px 9px", borderRadius: 99, fontSize: 11, fontWeight: 700,
              background: "#e5e7eb", color: "#374151", whiteSpace: "nowrap",
            }}>
              טיוטא
            </span>
          )}
          {showApprove && (
            <button
              onClick={() => router.push(`/ops/deliveries/new?id=${row.id}`)}
              style={{
                padding: "5px 14px", borderRadius: 7, border: "none",
                background: row.status === "ממתין לאישור" ? "#f59e0b" : "#2BAEA6",
                color: "#fff", fontSize: 13, fontWeight: 700,
                cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              {row.status === "ממתין לאישור" ? "הפקה ✓" : "אישור ✓"}
            </button>
          )}
          {!showApprove && (
            <Link
              href={`/ops/deliveries/new?id=${row.id}&view=1`}
              style={{
                padding: "5px 14px", borderRadius: 7, border: "1.5px solid #2BAEA6",
                background: "#fff", color: "#2BAEA6", fontSize: 13, fontWeight: 700,
                cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none",
              }}
            >
              צפייה
            </Link>
          )}
          <button
            onClick={() => onCancel(row)}
            style={{
              padding: "5px 14px", borderRadius: 7, border: "none",
              background: "#fee2e2", color: "#E8544A", fontSize: 13, fontWeight: 700,
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            ביטול ✕
          </button>
        </div>
      </td>
    </tr>
  );
}

const tdStyle: React.CSSProperties = {
  padding: "11px 12px", fontSize: 14, color: "#1a2744", verticalAlign: "middle",
};

const thStyle: React.CSSProperties = {
  padding: "10px 12px", fontSize: 13, fontWeight: 700, color: "#6b7280",
  background: "#f9f6f0", textAlign: "right", borderBottom: "2px solid #e8e4dc",
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function DeliveriesClient({ initialOpen, initialClosed }: Props) {
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [openRows, setOpenRows] = useState<DeliveryRow[]>(initialOpen);
  const [closedRows, setClosedRows] = useState<DeliveryRow[]>(initialClosed);

  // Date-range for closed tab
  const today = new Date().toISOString().slice(0, 10);
  const weekAgoStr = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(weekAgoStr);
  const [toDate, setToDate] = useState(today);
  const [loadingClosed, setLoadingClosed] = useState(false);

  // Cancel dialog state
  const [cancelTarget, setCancelTarget] = useState<DeliveryRow | null>(null);

  // ── Cancel handler ──────────────────────────────────────────────────────────
  const handleCancel = useCallback(async () => {
    if (!cancelTarget) return;
    const res = await fetch(`/api/deliveries/${cancelTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "מבוטל" }),
    });
    if (res.ok) {
      setOpenRows((prev) => prev.filter((r) => r.id !== cancelTarget.id));
      setClosedRows((prev) => prev.filter((r) => r.id !== cancelTarget.id));
    }
    setCancelTarget(null);
  }, [cancelTarget]);

  // ── Reload closed deliveries for date range ─────────────────────────────────
  async function reloadClosed() {
    setLoadingClosed(true);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      const res = await fetch(`/api/deliveries?${params}`);
      if (res.ok) {
        const data: DeliveryRow[] = await res.json();
        setClosedRows(data);
      }
    } finally {
      setLoadingClosed(false);
    }
  }

  const rows = tab === "open" ? openRows : closedRows;
  const showApprove = tab === "open";

  return (
    <>
      {/* Cancel dialog */}
      {cancelTarget && (
        <CancelDialog
          delivery={cancelTarget}
          onConfirm={handleCancel}
          onClose={() => setCancelTarget(null)}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
        <Link
          href="/ops/management"
          style={{
            display: "flex", alignItems: "center", gap: 5,
            fontSize: 14, color: "#2BAEA6", fontWeight: 600, textDecoration: "none",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          חזרה
        </Link>
        <div style={{ fontSize: 11, color: "#9ca3af" }}>
          ניהול תפעול
          <span style={{ margin: "0 5px" }}>›</span>
          <span style={{ color: "#1a2744", fontWeight: 600 }}>ניהול תעודות משלוח</span>
        </div>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a2744", margin: "0 0 20px" }}>
        ניהול תעודות משלוח
      </h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 0, borderBottom: "2px solid #e8e4dc" }}>
        {(["open", "closed"] as const).map((t) => {
          const label = t === "open" ? "תעודות פתוחות" : "תעודות סגורות";
          const badge = t === "open" ? openRows.length : null;
          const isActive = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "10px 22px", border: "none", background: "none",
                fontSize: 15, fontWeight: isActive ? 700 : 500,
                color: isActive ? "#2BAEA6" : "#6b7280",
                cursor: "pointer", borderBottom: isActive ? "2.5px solid #2BAEA6" : "2.5px solid transparent",
                marginBottom: -2, display: "flex", alignItems: "center", gap: 7,
              }}
            >
              {label}
              {badge !== null && badge > 0 && (
                <span style={{
                  background: "#E8544A", color: "#fff", borderRadius: 99,
                  fontSize: 11, fontWeight: 800, padding: "1px 7px", lineHeight: "18px",
                }}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Closed tab date filter */}
      {tab === "closed" && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          padding: "14px 4px", borderBottom: "1px solid #e8e4dc", marginBottom: 4,
        }}>
          <label style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>מ-</label>
          <input
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={dateInputStyle}
          />
          <label style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>עד-</label>
          <input
            type="date"
            value={toDate}
            min={fromDate}
            max={today}
            onChange={(e) => setToDate(e.target.value)}
            style={dateInputStyle}
          />
          <button
            onClick={reloadClosed}
            disabled={loadingClosed}
            style={{
              padding: "7px 16px", borderRadius: 8, border: "none",
              background: "#2BAEA6", color: "#fff", fontSize: 13, fontWeight: 700,
              cursor: loadingClosed ? "not-allowed" : "pointer",
              opacity: loadingClosed ? 0.7 : 1,
            }}
          >
            {loadingClosed ? "טוען..." : "עדכן"}
          </button>
        </div>
      )}

      {/* New delivery button (open tab) */}
      {tab === "open" && (
        <div style={{ padding: "12px 4px", borderBottom: "1px solid #e8e4dc", marginBottom: 4 }}>
          <Link
            href="/ops/deliveries/new"
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "8px 18px", borderRadius: 9, border: "none",
              background: "#2BAEA6", color: "#fff", fontSize: 14, fontWeight: 700,
              textDecoration: "none",
            }}
          >
            + תעודת משלוח חדשה
          </Link>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginTop: 12 }}>
        {rows.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#9ca3af", fontSize: 15 }}>
            {tab === "open"
              ? "אין תעודות משלוח הממתינות לאישור"
              : "אין תעודות משלוח בטווח התאריכים שנבחר"}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>תאריך</th>
                <th style={thStyle}>קוד תעודה</th>
                <th style={thStyle}>לקוח</th>
                <th style={{ ...thStyle, textAlign: "center" }}>כמות דגים</th>
                <th style={{ ...thStyle, textAlign: "center" }}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <DeliveryTableRow
                  key={row.id}
                  row={row}
                  onCancel={setCancelTarget}
                  showApprove={showApprove}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

const dateInputStyle: React.CSSProperties = {
  padding: "6px 10px", borderRadius: 8, border: "1.5px solid #d1d5db",
  fontSize: 13, fontFamily: "inherit", background: "#fff", color: "#1a2744",
};
