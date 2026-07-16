"use client";

// Shared dismissible red error banner per מסמך אפיון מודול תפעול בריכות, page 6/10:
// "תופיע הודעה אדומה עם פירוט הבעיה וכפתור לסגירת ההודעה. סגירה חזרה למסך פתיחה/עדכון".
// Red header bar + title, body with the problem detail, explicit "הבנתי" close button
// that clears the error and returns focus to the editable form. Used for both
// client-side validation failures and server-side save failures.
interface Props {
  title?: string;
  message: string;
  onClose: () => void;
}

export default function ErrorBanner({ title = "לא ניתן לבצע פעולה", message, onClose }: Props) {
  return (
    <div className="rounded-xl overflow-hidden border border-red-200 shadow-sm">
      <div className="bg-red-600 text-white px-4 py-2.5 flex items-center gap-2">
        <span aria-hidden>⊘</span>
        <span className="font-semibold">{title}</span>
      </div>
      <div className="bg-white px-4 py-3 space-y-3">
        <p className="text-sm text-gray-700 flex items-start gap-2">
          <span className="text-red-600 shrink-0" aria-hidden>⊘</span>
          <span>{message}</span>
        </p>
        <button
          type="button"
          onClick={onClose}
          className="bg-slate-800 hover:bg-slate-900 text-white rounded-md px-4 py-1.5 text-sm font-medium"
        >
          הבנתי
        </button>
      </div>
    </div>
  );
}
