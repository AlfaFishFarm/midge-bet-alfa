"use client";

import { useState, useEffect, type FormEvent } from "react";

interface Basket {
  id: string;
  basketSeq: number;
  emptyWetWeight: number;
  weightWithFish: number;
  fishCount: number;
  notes: string | null;
  // Per-basket weighing time — UI/session-only (prototype's wf-basket-tbody "שעה" column,
  // live-ticking clock until the basket is saved). Spec page 43 itself raises an open
  // question ("לשאול את דנה אם באמת הכרחי לשמור שעת שקילה של כל סל") and there's no backing
  // column on FishWeighingBasketDetail (no-new-fields-without-sign-off rule) — so this is
  // never sent to the server, just displayed live for staged baskets and frozen at commit.
  // Baskets loaded from a prior session (existingBaskets from the server) show "—".
  time: string;
}

interface WeighContext {
  transferId: string;
  detailId: string;
  weighingId: string | null;
  pondId: string;
  weightTypeId: string;
  date: string;
  tankId: string | null;
  tankCode: string | null;
  pondName: string | null;
  cycleCode: string;
  fishLabel: string;
  existingBaskets: Basket[];
}

interface Props {
  transferId: string;
  detailId: string;
  // Called when the modal closes. `savedAvgWeightGrams` is the new average to apply to the
  // row immediately (undefined when nothing changed, e.g. plain cancel with no edits).
  onClose: (savedAvgWeightGrams?: number | null) => void;
}

const INPUT =
  "w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500";
const BTN =
  "bg-brand-600 hover:bg-brand-700 text-white rounded-md px-4 py-2 font-medium disabled:opacity-50 text-sm";
const BTN_OUTLINE =
  "border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md px-4 py-2 font-medium disabled:opacity-50 text-sm";

function calcNetWeight(row: Basket) {
  return row.weightWithFish - row.emptyWetWeight;
}

function calcAvgWeightGrams(row: Basket) {
  const net = calcNetWeight(row);
  if (!row.fishCount) return null;
  return String(Math.round((net / row.fishCount) * 1000));
}

function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Baskets added in this session but not yet persisted to the server carry a client-only
// "tmp-" id. They live only in local state until the user clicks "שמור שקילה לאישור ושמירה"
// (spec page 21) — clicking "ביטול" discards them with no server call at all.
function isStaged(basket: Basket) {
  return basket.id.startsWith("tmp-");
}

// Weighing window as a POPUP over the transfers screen — per the spec's explicit instruction
// ("רצוי שיהיה חלון קופץ מעל למסך ההעברות ולא מסך נפרד") and Dean's confirmation
// (2026-06-25, "כן כמו שכתוב באיפיון... האייקון שיש"): keep the existing ⚖️ icon as the
// trigger, but open this as a modal in place, instead of navigating to a dedicated screen.
// Replaces the earlier dedicated-screen approach (src/app/transfers/[id]/weigh/[detailId]).
export default function WeighingModal({ transferId, detailId, onClose }: Props) {
  const [ctx, setCtx] = useState<WeighContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [weighingId, setWeighingId] = useState<string | null>(null);
  const [baskets, setBaskets] = useState<Basket[]>([]);
  // Per spec page 20-23: date is FIXED (= transfer date), only time is editable.
  const [basketTime, setBasketTime] = useState(nowTimeStr);
  const [withFish, setWithFish] = useState("");
  const [fishCount, setFishCount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Two-step confirm per spec page 21/43-47 ("מסך אישור ביצוע שקילות" / prototype's
  // weigh-confirm-overlay) — clicking the main save button no longer persists directly;
  // it opens a read-only summary first, and only "שמור שקילה" on that summary actually saves.
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/transfers/${transferId}/details/${detailId}/weigh-context`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(data.error ?? "שגיאה בטעינת נתוני שקילה");
          return;
        }
        setCtx(data);
        setWeighingId(data.weighingId);
        // Baskets loaded from a prior session have no live time to show (see Basket.time
        // comment above) — display "—" for them, matching the prototype's frozen/saved cells.
        setBaskets(
          (data.existingBaskets as Basket[]).map((b) => ({ ...b, time: "—" }))
        );
      } catch {
        if (!cancelled) setLoadError("שגיאת תקשורת בטעינת נתוני שקילה");
      }
    })();
    return () => { cancelled = true; };
  }, [transferId, detailId]);

  // Esc closes the modal like a cancel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baskets]);

  // Live clock for staged (not-yet-saved) baskets' "שעה" cell — mirrors the prototype's
  // tfLiveClockTick(), which re-stamps every unsaved basket's time cell every 10s and then
  // leaves it frozen once the basket is actually saved. Per-basket time is never typed by
  // hand; it's purely a live display (see the Basket.time comment for why it isn't persisted).
  useEffect(() => {
    const interval = setInterval(() => {
      setBaskets((prev) =>
        prev.map((b) => (isStaged(b) ? { ...b, time: nowTimeStr() } : b))
      );
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const totalFish = baskets.reduce((s, b) => s + b.fishCount, 0);
  const totalNet = baskets.reduce((s, b) => s + calcNetWeight(b), 0);
  // Displayed average weight is in KG (Dean, 2026-06-25); the value passed to the server
  // via commitWeighing/deleteBasket below is computed separately and stays in grams.
  const overallAvgGrams = totalFish > 0 ? String(Math.round((totalNet / totalFish) * 1000)) : null;
  const pendingCount = baskets.filter(isStaged).length;

  async function ensureWeighing(): Promise<string> {
    if (weighingId) return weighingId;
    if (!ctx) throw new Error("נתוני שקילה לא נטענו");
    const datetime = `${ctx.date}T${basketTime}`;
    const res = await fetch("/api/weighings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: datetime,
        pondId: ctx.pondId,
        weightTypeId: ctx.weightTypeId,
        transferDetailId: detailId,
        tankId: ctx.tankId ?? undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      // 409 = same tank already has a weighing for this date+pond (DB-enforced, see
      // FishWeighingHeader's @@unique([date, pondId, tankId]) — spec page 20's same-tank-twice rule).
      if (res.status === 409) {
        throw new Error(data.error ?? "כבר קיימת שקילה לטנק זה בתאריך זה");
      }
      throw new Error(data.error ?? "שגיאה ביצירת שקילה");
    }
    setWeighingId(data.id);
    return data.id;
  }

  // Adds a basket to the local staging list only — spec page 21 requires a dedicated
  // confirm step ("מסך אישור ביצוע שקילות") with its own save/cancel, so nothing is
  // persisted to the server until the user explicitly clicks "שמור שקילה לאישור ושמירה".
  function addBasket(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const wf = parseFloat(withFish);
    const fc = parseInt(fishCount, 10);
    if (isNaN(wf) || isNaN(fc) || wf <= 0 || fc <= 0) {
      setError("יש להזין משקל מלא ומספר דגים תקינים");
      return;
    }
    const staged: Basket = {
      id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      basketSeq: baskets.length + 1,
      emptyWetWeight: 0,
      weightWithFish: wf,
      fishCount: fc,
      notes: null,
      time: nowTimeStr(),
    };
    setBaskets((prev) => [...prev, staged]);
    setWithFish("");
    setFishCount("");
  }

  // Removing a staged (not-yet-saved) basket is purely local. Removing an already-persisted
  // basket (from a prior confirmed session) still deletes it for real and immediately syncs
  // the parent transfer-detail's avgWeightGrams so the transfer screen stays consistent even
  // if the user closes the modal without clicking save again.
  async function deleteBasket(basket: Basket) {
    if (isStaged(basket)) {
      setBaskets((prev) => prev.filter((b) => b.id !== basket.id));
      return;
    }
    if (!weighingId) return;
    setSaving(true);
    try {
      await fetch(`/api/weighings/${weighingId}/baskets/${basket.id}`, { method: "DELETE" });
      const remaining = baskets.filter((b) => b.id !== basket.id);
      setBaskets(remaining);
      const newTotal = remaining.reduce((s, b) => s + b.fishCount, 0);
      const newNet = remaining.reduce((s, b) => s + calcNetWeight(b), 0);
      const newAvg = newTotal > 0 ? (newNet / newTotal) * 1000 : null;
      await syncAvgToDetail(newAvg);
    } finally {
      setSaving(false);
    }
  }

  async function syncAvgToDetail(avgGrams: number | null) {
    await fetch(`/api/transfers/${transferId}/details/${detailId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avgWeightGrams: avgGrams }),
    });
  }

  // "שמור שקילה לאישור ושמירה" — spec page 21's confirm-and-save action. Creates the
  // weighing header if needed, persists every still-staged basket in order, syncs the
  // resulting average back onto the transfer-detail row, then closes the modal.
  async function commitWeighing() {
    setError(null);
    setSaving(true);
    try {
      const wid = await ensureWeighing();
      const staged = baskets.filter(isStaged);
      const updated = [...baskets];
      for (const b of staged) {
        const res = await fetch(`/api/weighings/${wid}/baskets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weightWithFish: b.weightWithFish,
            fishCount: b.fishCount,
            notes: b.notes ?? undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "שגיאה בשמירת סל");
          setBaskets(updated);
          return;
        }
        const idx = updated.findIndex((bb) => bb.id === b.id);
        if (idx !== -1) updated[idx] = { ...updated[idx], id: data.id, basketSeq: data.basketSeq };
      }
      setBaskets(updated);
      const finalNet = updated.reduce((s, b) => s + calcNetWeight(b), 0);
      const finalFish = updated.reduce((s, b) => s + b.fishCount, 0);
      const finalAvg = finalFish > 0 ? (finalNet / finalFish) * 1000 : null;
      await syncAvgToDetail(finalAvg);
      setShowConfirm(false);
      onClose(finalAvg);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "שגיאה");
      setShowConfirm(false);
    } finally {
      setSaving(false);
    }
  }

  // "ביטול" — true cancel per spec page 21: discards any staged baskets with no server
  // call at all and closes the modal. Already-persisted baskets are untouched.
  function handleCancel() {
    if (pendingCount > 0 && !confirm(`יש ${pendingCount} סלים שלא נשמרו — לבטל ולמחוק אותם?`)) {
      return;
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
          <h1 className="text-lg font-bold text-brand-700">⚖️ שקילת סלים</h1>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
            aria-label="סגור"
          >
            ×
          </button>
        </div>

        {loadError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2 m-5">{loadError}</p>
        )}

        {!ctx && !loadError && (
          <p className="text-sm text-gray-400 p-5">טוען נתוני שקילה...</p>
        )}

        {ctx && (
          <>
            <div className="p-5 space-y-5">
              {/* Info banner — mirrors the prototype's #wf-transfer-banner, shown whenever the
                  weighing form is reached from a transfer (the only way this modal opens):
                  "שקילה מתוך העברה — נתוני הבריכה והדג נעולים אוטומטית." */}
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs font-medium text-blue-800">
                <span>🔄</span>
                <span>
                  {`שקילה מתוך העברה — טנק: ${ctx.tankCode ?? "—"} | דג: ${ctx.fishLabel}. נתוני הבריכה והדג נעולים אוטומטית.`}
                </span>
              </div>

              {/* Part A — pond/tank data, read-only from the transfer details + date (fixed) +
                  time (editable). Spec page 20/43: "חלק א: נתוני בריכה וטנק והדג: read only
                  ומגיעים מפרטי ההעברה. רק השעה ניתנת לעריכה." Header bar matches the
                  prototype's .weighing-part-hdr ("א. נתוני בריכה" / "ב. חישובי סלים"). */}
              <div>
                <div className="bg-emerald-700 text-white text-[11px] font-bold tracking-wide px-3 py-1.5 rounded-t-md">
                  א. נתוני בריכה
                </div>
                <div className="flex flex-wrap gap-4 items-center bg-gray-50 rounded-b-lg px-4 py-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">בריכה (קבוע)</p>
                    <p className="text-sm font-medium text-gray-800">{ctx.pondName ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">מזהה קוד מחזור גידול (קבוע)</p>
                    <p className="text-sm font-medium text-gray-800 font-mono">{ctx.cycleCode}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">סוג דג (קבוע)</p>
                    <p className="text-sm font-medium text-gray-800">{ctx.fishLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">טנק (קבוע)</p>
                    <p className="text-sm font-medium text-gray-800 font-mono">{ctx.tankCode ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">תאריך (קבוע)</p>
                    <p className="text-sm font-medium text-gray-800 font-mono">
                      {new Date(ctx.date).toLocaleDateString("he-IL")}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">שעה (ניתנת לעריכה)</label>
                    <input
                      type="text"
                      value={basketTime}
                      onChange={(e) => setBasketTime(e.target.value)}
                      placeholder="HH:mm"
                      maxLength={5}
                      className="border border-gray-300 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
              </div>
              {!ctx.tankCode && (
                <p className="text-xs text-amber-600 -mt-3">
                  לשורה זו לא הוגדר טנק פנימי (אמצעי העברה חיצוני) — השקילה תישמר ללא טנק משויך.
                </p>
              )}

              {/* Part B — basket weighing. Spec page 43: "חלק ב: שקילת סלים — לכל סל מדווחים
                  ספירת דגים ומשקל הדגים בסל, מחושב משקל ממוצע... וממוצע משוקלל לשקילת סלים."
                  Header bar matches the prototype's second .weighing-part-hdr. */}
              <div>
                <div className="bg-emerald-700 text-white text-[11px] font-bold tracking-wide px-3 py-1.5 rounded-t-md">
                  ב. חישובי סלים
                </div>
                <div className="bg-white border border-gray-200 rounded-b-lg px-4 py-3 space-y-4">
              {baskets.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">סלים שנשקלו</h3>
                  <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-right px-3 py-2 font-medium text-gray-700">#</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-700">שעה</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-700">{'משקל סל מלא (ק"ג)'}</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-700">מספר דגים בסל</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-700">{'משקל ממוצע (גרם)'}</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {baskets.map((b) => (
                        <tr key={b.id} className={isStaged(b) ? "bg-amber-50/40" : ""}>
                          <td className="px-3 py-2">{b.basketSeq}</td>
                          <td className="px-3 py-2 font-mono">{b.time}</td>
                          <td className="px-3 py-2">{b.weightWithFish.toFixed(2)}</td>
                          <td className="px-3 py-2">{b.fishCount}</td>
                          <td className="px-3 py-2">{calcAvgWeightGrams(b)}</td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => deleteBasket(b)}
                              disabled={saving}
                              className="text-red-500 hover:text-red-700 text-xs"
                            >
                              מחק
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-medium">
                      <tr>
                        <td className="px-3 py-2 text-xs text-gray-600 font-bold">{'סלים: '}{baskets.length}</td>
                        <td className="px-3 py-2 text-xs text-gray-400">
                          {pendingCount > 0 ? `${pendingCount} ממתינים` : "הכל נשמר"}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">{'סה"כ '}{totalNet.toFixed(2)}{' ק"ג'}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{totalFish} דגים</td>
                        <td className="px-3 py-2 text-xs text-brand-700 font-bold">{overallAvgGrams ?? "—"}{' גרם'}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              <form onSubmit={addBasket} className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700">הוסף סל</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">{'משקל סל מלא (ק"ג)'}</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={withFish}
                      onChange={(e) => setWithFish(e.target.value)}
                      required
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">מספר דגים בסל</label>
                    <input
                      type="number"
                      min="1"
                      value={fishCount}
                      onChange={(e) => setFishCount(e.target.value)}
                      required
                      className={INPUT}
                    />
                  </div>
                </div>
                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
                )}
                <button type="submit" className={BTN}>
                  הוסף סל
                </button>
              </form>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 flex items-center justify-between gap-3 sticky bottom-0 bg-white">
              <p className="text-xs text-gray-500">
                {pendingCount > 0
                  ? `${pendingCount} סלים ממתינים לשמירה — הם יישמרו רק בלחיצה על "שמור שקילה לאישור ושמירה".`
                  : baskets.length > 0
                  ? "כל הסלים נשמרו."
                  : "הוסף סל כדי להתחיל."}
              </p>
              <div className="flex gap-2 shrink-0">
                <button onClick={handleCancel} disabled={saving} className={BTN_OUTLINE}>
                  ביטול
                </button>
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={saving || baskets.length === 0}
                  className={BTN}
                >
                  שמור שקילה
                </button>
              </div>
            </div>
          </>
        )}

        {/* Confirm-and-save summary — spec page 21/43-47 ("מסך אישור ביצוע שקילות", prototype's
            weigh-confirm-overlay): slides up from bottom with green header, meta grid,
            basket table, totals box, and sticky action buttons. */}
        {showConfirm && ctx && (
          <div
            className="fixed inset-0 z-[60] flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.55)" }}
            onClick={(e) => { if (e.target === e.currentTarget && !saving) setShowConfirm(false); }}
          >
            <style>{`
              @keyframes slideUpPanel {
                from { transform: translateY(100%); }
                to   { transform: translateY(0); }
              }
            `}</style>
            <div
              className="bg-white w-full overflow-y-auto"
              style={{
                borderRadius: "20px 20px 0 0",
                maxWidth: "520px",
                maxHeight: "86vh",
                boxShadow: "0 -8px 40px rgba(0,0,0,0.3)",
                animation: "slideUpPanel .25s ease",
              }}
            >
              {/* Top bar — prototype: .weigh-confirm-top: bg #059669, sticky */}
              <div
                className="sticky top-0 z-10 flex items-center justify-between px-4 py-3.5"
                style={{ background: "#059669", color: "white", borderRadius: "20px 20px 0 0" }}
              >
                <div>
                  <h3 className="text-base font-bold">⚖️ סיכום שקילה</h3>
                  <p className="text-xs opacity-75">בדוק את הנתונים לפני שמירה</p>
                </div>
                <span className="text-3xl opacity-85">✅</span>
              </div>

              <div className="px-4 pt-3.5">
                {/* Meta grid — prototype: .weigh-confirm-meta: 2-col grid */}
                <div className="grid grid-cols-2 gap-x-3.5 gap-y-1.5 mb-3">
                  {[
                    { label: "סוג שקילה",  value: "שקילת סל לטנק" },
                    { label: "בריכה",       value: ctx.pondName ?? "—" },
                    { label: "מחזור",       value: ctx.cycleCode },
                    { label: "סוג דג",     value: ctx.fishLabel },
                    { label: "טנק",         value: ctx.tankCode ?? "—" },
                    { label: "תאריך ושעה", value: `${new Date(ctx.date).toLocaleDateString("he-IL")} ${basketTime}` },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <label className="block text-[10px] font-semibold text-gray-400">{label}</label>
                      <span className="text-sm font-bold" style={{ color: "#1a2744" }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Basket table — prototype: .weigh-confirm-baskets table */}
                <div className="overflow-x-auto mb-3">
                  <table className="w-full border-collapse text-xs" style={{ minWidth: "260px" }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #e2e8f0" }}>
                        <th className="px-2 py-1.5 text-center font-bold" style={{ color: "#1a2744" }}>#</th>
                        <th className="px-2 py-1.5 text-center font-bold" style={{ color: "#1a2744" }}>{'משקל סל מלא (ק"ג)'}</th>
                        <th className="px-2 py-1.5 text-center font-bold" style={{ color: "#1a2744" }}>מספר דגים</th>
                        <th className="px-2 py-1.5 text-center font-bold" style={{ color: "#1a2744" }}>{'ממוצע (גרם)'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {baskets.map((b) => (
                        <tr key={b.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td className="px-2 py-1.5 text-center">{b.basketSeq}</td>
                          <td className="px-2 py-1.5 text-center">{b.weightWithFish.toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-center">{b.fishCount}</td>
                          <td className="px-2 py-1.5 text-center">{calcAvgWeightGrams(b)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals box — prototype: .weigh-confirm-totals: green bg/border, grid */}
                <div
                  className="grid grid-cols-3 gap-1.5 mb-3.5 rounded-[10px] px-2.5 py-2.5"
                  style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0" }}
                >
                  {[
                    { label: "סלים",     value: String(baskets.length), unit: "" },
                    { label: 'סה"כ ק"ג', value: totalNet.toFixed(2),   unit: 'ק"ג' },
                    { label: "ממוצע",    value: overallAvgGrams ?? "—",    unit: 'גרם' },
                  ].map(({ label, value, unit }) => (
                    <div key={label} className="text-center">
                      <div className="text-[10px] font-bold" style={{ color: "#15803d" }}>{label}</div>
                      <div className="text-lg font-black" style={{ color: "#059669" }}>{value} <span className="text-xs font-semibold opacity-70">{unit}</span></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons — sticky at bottom of overlay */}
              <div
                className="sticky bottom-0 flex gap-3 px-4 py-3.5"
                style={{ background: "white", borderTop: "1.5px solid #e2e8f0" }}
              >
                <button
                  onClick={() => { setShowConfirm(false); }}
                  disabled={saving}
                  className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-[10px] py-3 font-semibold text-sm disabled:opacity-50"
                >
                  חזור לעריכה
                </button>
                <button
                  onClick={commitWeighing}
                  disabled={saving}
                  className="flex-1 text-white rounded-[10px] py-3 font-bold text-sm disabled:opacity-50"
                  style={{ background: "#059669" }}
                >
                  {saving ? "שומר..." : "שמור שקילה"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
