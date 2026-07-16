"use client";

// Shared "confirm before save" dialog per מסמך אפיון מודול תפעול בריכות, page 6/9:
// "להוציא הודעת אישור שמסכמת את הפעולה ... העדכון יישמר בבסיס הנתונים רק לאחר אישור
// ההודעה." Summarizes exactly what will be written; the DB write only happens when
// the caller's onConfirm fires (the fetch lives in the screen, not here). Cancel just
// dismisses with no request sent.
interface Row {
  label: string;
  value: string;
}

interface Props {
  open: boolean;
  title: string;
  icon?: string;
  rows: Row[];
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  // GAP 7 (close-pool): Optional red warning text shown below the rows, styled
  // like prototype ".confirm-warning { color: #dc2626 }". Used to show balance
  // out-of-tolerance warning in the close-pool confirm dialog.
  confirmWarning?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  icon = "🏠",
  rows,
  confirmLabel = "אישור",
  cancelLabel = "ביטול",
  loading = false,
  confirmWarning,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5">
        <div className="flex flex-col items-center text-center gap-2">
          <span className="text-3xl" aria-hidden>
            {icon}
          </span>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        </div>

        <div className="divide-y divide-gray-100">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between py-2 text-sm">
              <span className="text-gray-500">{r.label}</span>
              <span className="font-medium text-gray-900">{r.value}</span>
            </div>
          ))}
        </div>

        {confirmWarning && (
          <p className="text-xs font-semibold text-red-600">{confirmWarning}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-4 py-2 font-medium disabled:opacity-50"
          >
            {loading ? "שומר..." : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md px-4 py-2 font-medium disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
