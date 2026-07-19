"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PondCombobox from "@/components/PondCombobox";
import WeighingModal from "@/app/transfers/[id]/WeighingModal";

// ── Types ────────────────────────────────────────────────────────────────────
interface Pond {
  id: string; code: string | null; name: string;
  pondTypeName: string; hasActiveCycle: boolean; activeCycleCode: string | null;
}
interface Supplier { id: string; name: string; }
interface FishStrain { id: string; englishName: string | null; latinName: string; }
interface PopulationCode { id: string; code: string; }
interface WeightType { id: string; name: string; }
interface Tank { id: string; code: string; }
interface DraftHeader {
  id: string; transferType: string; transferDate: string;
  sourcePondId: string; sourcePondName: string;
}
interface Props {
  ponds: Pond[]; suppliers: Supplier[]; existingDrafts: DraftHeader[];
  fishStrains: FishStrain[]; allPonds: Pond[]; populationCodes: PopulationCode[];
  weightTypes: WeightType[]; tanks: Tank[]; virtualPondId?: string; shivukPondId?: string;
}

// ── Local row — in React state until batch-save to DB ────────────────────────
interface LocalRow {
  localId: number; editing: boolean;
  meansDisplay: string; vehicleText: string;
  fishStrainId: string; avgWeightGrams: string;
  totalWeightKg: string; fishCount: string;
  transferTime: string; destPondId: string;
  populationCodeId: string; mortalityCause: string;
  avgFromWeighing: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPE_DATA = [
  { type: "קניה",  emoji: "🛒", tc: "#3D9A6A", ts: "#1A5435", badge: "tf-badge-green"  },
  { type: "דילול", emoji: "💧", tc: "#2271B2", ts: "#144D80", badge: "tf-badge-blue"   },
  { type: "פירוק", emoji: "🔓", tc: "#1D8C85", ts: "#0D5E59", badge: "tf-badge-teal"   },
  { type: "תמותה", emoji: "💀", tc: "#C93B31", ts: "#8B2820", badge: "tf-badge-red"    },
  { type: "שיווק", emoji: "📦", tc: "#D97B1A", ts: "#9E560E", badge: "tf-badge-orange" },
] as const;

const MORTALITY_CAUSES = [
  "מחלה","חנק","טמפרטורה","רעלן","תקיפה","סיבה לא ידועה","אחר",
];
const MEANS_OPTIONS = ["טנק שלנו","טנק ספק","אחר"];

const BADGE_BY_TYPE: Record<string,string> = Object.fromEntries(
  TYPE_DATA.map((t) => [t.type, t.badge])
);
const TF_INPUT: React.CSSProperties = {
  border: "1.5px solid #d1d5db", borderRadius: 8, padding: "9px 12px",
  fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%",
  boxSizing: "border-box",
};
const TF_AUTO: React.CSSProperties = {
  ...TF_INPUT, background: "#f1f5f9", color: "#374151", fontWeight: 700,
};
const TF_GHOST: React.CSSProperties = {
  ...TF_INPUT, background: "#f8fafc", color: "#9ca3af", fontStyle: "italic",
};
const COMPUTED: React.CSSProperties = { background: "#f1f5f9", color: "#374151" };

// ── Helpers ───────────────────────────────────────────────────────────────────
function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function blankRow(id: number): LocalRow {
  return {
    localId: id, editing: true,
    meansDisplay: "", vehicleText: "",
    fishStrainId: "", avgWeightGrams: "",
    totalWeightKg: "", fishCount: "",
    transferTime: nowHHMM(),
    destPondId: "", populationCodeId: "",
    mortalityCause: "", avgFromWeighing: false,
  };
}
function recompute(row: LocalRow, field: string, val: string, type: string): LocalRow {
  const next = { ...row, [field]: val };
  const avg = parseFloat(next.avgWeightGrams);
  const w   = parseFloat(next.totalWeightKg);
  const cnt = parseInt(next.fishCount, 10);
  if (type === "קניה" || type === "תמותה") {
    if (!isNaN(cnt) && !isNaN(avg) && cnt > 0 && avg > 0)
      next.totalWeightKg = ((cnt * avg) / 1000).toFixed(1);
  } else {
    if (!isNaN(w) && !isNaN(avg) && w > 0 && avg > 0)
      next.fishCount = String(Math.round((w * 1000) / avg));
  }
  return next;
}
function fishLabel(fishStrains: FishStrain[], id: string) {
  const f = fishStrains.find((s) => s.id === id);
  return f ? (f.englishName || f.latinName) : "—";
}
function pondLabel(allPonds: Pond[], id: string) {
  return allPonds.find((p) => p.id === id)?.name ?? "—";
}
function popLabel(populationCodes: PopulationCode[], id: string) {
  return populationCodes.find((pc) => pc.id === id)?.code ?? "—";
}

// ── SVG helpers ───────────────────────────────────────────────────────────────
function SaveRowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white"
      strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 3, flexShrink: 0 }}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14H6L5 6"/>
    </svg>
  );
}
function PenIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NewTransferForm({
  ponds, suppliers, existingDrafts, fishStrains, allPonds,
  populationCodes, weightTypes, tanks, virtualPondId, shivukPondId,
}: Props) {
  const router = useRouter();
  const rowCounter = useRef(0);
  const today = new Date().toISOString().slice(0, 10);

  const [transferDate, setTransferDate] = useState(today);
  const [transferType, setTransferType] = useState("");
  const [pondId, setPondId]             = useState("");
  const [supplierId, setSupplierId]     = useState("");
  const [headerNotes, setHeaderNotes]   = useState("");
  const [showDraftPicker, setShowDraftPicker] = useState(false);
  const [rows, setRows]                 = useState<LocalRow[]>([]);
  const [rowError, setRowError]         = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess]   = useState<string | null>(null);

  // Weighing modal state
  const [savedHeaderId, setSavedHeaderId]   = useState<string | null>(null);
  const [savedDetailIds, setSavedDetailIds] = useState<Record<number, string>>({});
  const [weighingTarget, setWeighingTarget] = useState<{ headerId: string; detailId: string; localId: number } | null>(null);
  const [autoSaving, setAutoSaving]         = useState(false);

  // ── Dirty-state guard: warn before navigating away with unsaved rows ────────
  useEffect(() => {
    if (rows.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [rows.length]);

  function safeNavigate(href: string) {
    if (rows.length > 0 && !window.confirm("יש נתונים שלא נשמרו — האם לצאת בלי לשמור?")) return;
    router.push(href);
  }

  const isKiniya    = transferType === "קניה";
  const isMortality = transferType === "תמותה";
  const isShivuk    = transferType === "שיווק";
  const isWeighingType = !isKiniya && !isMortality; // דילול/פירוק/שיווק
  const selectedPond     = !isKiniya ? (ponds.find((p) => p.id === pondId) ?? null) : null;
  const pondCycleBlocked = !!selectedPond && !selectedPond.hasActiveCycle;
  const closedRows  = rows.filter((r) => !r.editing);
  const editingRows = rows.filter((r) => r.editing);
  const totalKg     = closedRows.reduce((s, r) => s + (parseFloat(r.totalWeightKg) || 0), 0);
  const totalFish   = closedRows.reduce((s, r) => s + (parseInt(r.fishCount, 10) || 0), 0);
  const currentBadge = BADGE_BY_TYPE[transferType] ?? "tf-badge-teal";
  const matchingDraft = !isKiniya && pondId && transferDate && transferType
    ? existingDrafts.find(
        (d) => d.sourcePondId === pondId &&
               d.transferDate.slice(0,10) === transferDate &&
               d.transferType === transferType
      ) : null;

  function getDestPonds(): Pond[] {
    if (transferType === "שיווק")
      return allPonds.filter((p) => p.pondTypeName === "בור" || p.pondTypeName === "מחסן שיווק");
    // Spec p38: dest ponds are growth ponds only — "לא וירטואלית ולא בור" — and open.
    return allPonds.filter(
      (p) =>
        p.hasActiveCycle &&
        p.id !== pondId &&
        p.pondTypeName !== "בור" &&
        !p.pondTypeName.includes("וירטואלית")
    );
  }

  // shivuk population code id for locking שלב באכלוס
  const shivukCodeId = populationCodes.find((pc) => pc.code === "שיווק")?.id ?? "";

  function addRow() {
    rowCounter.current += 1;
    const newRow = blankRow(rowCounter.current);
    // Default means per spec: קניה → חיצוני (טנק ספק), דילול/פירוק/שיווק → פנימי (טנק שלנו)
    if (transferType === "קניה") {
      newRow.meansDisplay = "טנק ספק";
    } else if (!isMortality) {
      newRow.meansDisplay = "טנק שלנו";
      if (transferType === "שיווק") {
        newRow.populationCodeId = shivukCodeId;
        newRow.destPondId = shivukPondId ?? "";
      }
    }
    setRows((prev) => [...prev, newRow]);
    setRowError(null);
  }
  function updateRow(localId: number, field: string, val: string) {
    setRows((prev) =>
      prev.map((r) => r.localId !== localId ? r : recompute(r, field, val, transferType))
    );
  }
  function closeRowById(localId: number) {
    setRowError(null);
    setRows((prev) =>
      prev.map((r) => {
        if (r.localId !== localId) return r;
        if (!r.fishStrainId) { setRowError("יש לבחור סוג דג"); return r; }
        if (isMortality && !r.mortalityCause) { setRowError("יש לבחור סיבת תמותה"); return r; }
        if (!isMortality && !isShivuk && !r.destPondId) { setRowError("יש לבחור בריכת יעד"); return r; }
        return { ...r, editing: false };
      })
    );
  }
  function openRowById(localId: number) {
    setRows((prev) => prev.map((r) => r.localId === localId ? { ...r, editing: true } : r));
  }
  function deleteRowById(localId: number) {
    setRows((prev) => prev.filter((r) => r.localId !== localId));
  }
  function selectType(t: string) {
    setTransferType(t);
    if (t === "קניה") setPondId("");
    else              setSupplierId("");
    setRows([]); setRowError(null); setSaveError(null); setShowDraftPicker(false); setSavedHeaderId(null); setSavedDetailIds({});
  }

  // ── Weighing modal ────────────────────────────────────────────
  async function openWeighingModal(localId: number) {
    const row = rows.find((r) => r.localId === localId);
    if (!pondId) { setSaveError("יש לבחור בריכת מקור לפני שקילה"); return; }
    if (!row || !row.fishStrainId || !row.destPondId) {
      setSaveError("יש לבחור סוג דג ובריכת יעד לפני שקילה");
      return;
    }
    setAutoSaving(true);
    setSaveError(null);
    try {
      let hId = savedHeaderId;
      if (!hId) {
        const hBody: Record<string,unknown> = { transferDate, transferType, pondId };
        const hRes = await fetch("/api/transfers", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(hBody),
        });
        const hData = await hRes.json();
        if (!hRes.ok) throw new Error(hData.error ?? "שגיאה ביצירת העברה");
        hId = hData.id as string;
        setSavedHeaderId(hId);
      }
      // Build means/tank info so the WeighingModal sees the correct tank code
      const meansBody: Record<string,unknown> = {};
      if (row.meansDisplay) {
        meansBody.meansType = row.meansDisplay === "טנק שלנו" ? "פנימי" : "חיצוני";
        if (row.meansDisplay === "טנק שלנו") {
          const tk = tanks.find((t) => t.code === row.vehicleText);
          if (tk) meansBody.internalTankId = tk.id;
        } else if (row.vehicleText) {
          meansBody.externalVehicleCode = row.vehicleText;
        }
      }
      let dId = savedDetailIds[localId];
      if (!dId) {
        const dBody: Record<string,unknown> = {
          fishStrainId: row.fishStrainId,
          destPondId:   row.destPondId,
          ...meansBody,
        };
        const dRes = await fetch(`/api/transfers/${hId}/details`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dBody),
        });
        const dData = await dRes.json();
        if (!dRes.ok) throw new Error(dData.error ?? "שגיאה ביצירת שורה");
        dId = dData.id as string;
        setSavedDetailIds((prev) => ({ ...prev, [localId]: dId! }));
      } else if (Object.keys(meansBody).length > 0) {
        // Existing draft detail — PATCH with current means info so modal shows correct tank
        const mRes = await fetch(`/api/transfers/${hId}/details/${dId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(meansBody),
        });
        if (!mRes.ok) throw new Error("שגיאה בעדכון אמצעי ההעברה — נסה שנית");
      }
      setWeighingTarget({ headerId: hId!, detailId: dId, localId });
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "שגיאת תקשורת");
    } finally {
      setAutoSaving(false);
    }
  }

  async function doSave(dest: "detail" | "list") {
    setSaveError(null);
    if (!transferType)           { setSaveError("יש לבחור סוג העברה"); return; }
    if (!isKiniya && !pondId)    { setSaveError("יש לבחור בריכת מקור"); return; }
    if (isKiniya && !supplierId) { setSaveError("יש לבחור ספק"); return; }
    if (pondCycleBlocked)        { setSaveError("לבריכה זו אין מחזור גידול פתוח"); return; }
    if (closedRows.length === 0) { setSaveError("יש להוסיף לפחות שורה אחת ולסגור אותה"); return; }
    if (editingRows.length > 0)  { setSaveError("יש לסגור את כל השורות הפתוחות לפני שמירה"); return; }
    setSaving(true);
    try {
      let headerId: string;
      if (savedHeaderId) {
        headerId = savedHeaderId;
        if (headerNotes.trim()) {
          const nRes = await fetch(`/api/transfers/${headerId}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notes: headerNotes.trim() }),
          });
          if (!nRes.ok) { setSaveError("שגיאה בשמירת ההערות — נסה שנית"); return; }
        }
      } else {
        const hBody: Record<string,unknown> = { transferDate, transferType };
        if (isKiniya) hBody.supplierId = supplierId;
        else          hBody.pondId     = pondId;
        if (headerNotes.trim()) hBody.notes = headerNotes.trim();
        const hRes  = await fetch("/api/transfers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(hBody) });
        const hTxt  = await hRes.text();
        let hData: { id?: string; error?: string } = {};
        try { if (hTxt) hData = JSON.parse(hTxt); } catch {}
        if (!hRes.ok) { setSaveError(hData.error ?? "שגיאה ביצירת העברה"); return; }
        headerId = hData.id as string;
      }

      for (const row of closedRows) {
        const dBody: Record<string,unknown> = {
          fishStrainId: row.fishStrainId,
          destPondId:   isMortality ? (virtualPondId ?? "") : (isShivuk ? (shivukPondId ?? "") : row.destPondId),
        };
        const cnt = parseInt(row.fishCount, 10);
        const avg = parseFloat(row.avgWeightGrams);
        const wkg = parseFloat(row.totalWeightKg);
        if (!isNaN(cnt) && cnt > 0)         dBody.fishCount      = cnt;
        if (!isNaN(avg) && avg > 0)         dBody.avgWeightGrams = avg;
        if (!isNaN(wkg) && wkg > 0 && !isKiniya) dBody.totalWeightKg = wkg;
        if (row.transferTime) {
          // transferTime is "HH:mm" — combine with transferDate for a valid ISO string
          dBody.transferTime = row.transferTime.length === 5
            ? `${transferDate}T${row.transferTime}:00`
            : row.transferTime;
        }
        if (row.populationCodeId)           dBody.populationCodeId = row.populationCodeId;
        if (isMortality && row.mortalityCause) dBody.causeOfDeath = row.mortalityCause;
        if (row.meansDisplay) {
          dBody.meansType = row.meansDisplay === "טנק שלנו" ? "פנימי" : "חיצוני";
          if (row.meansDisplay === "טנק שלנו") {
            const t = tanks.find((t) => t.code === row.vehicleText);
            if (t) dBody.internalTankId = t.id;
          } else if (row.vehicleText) {
            dBody.externalVehicleCode = row.vehicleText;
          }
        }
        const existingDetailId = savedDetailIds[row.localId];
        const dRes = existingDetailId
          ? await fetch(`/api/transfers/${headerId}/details/${existingDetailId}`, {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify(dBody),
            })
          : await fetch(`/api/transfers/${headerId}/details`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify(dBody),
            });
        if (!dRes.ok) {
          let dErrMsg = "שגיאה בשמירת שורה";
          try { const dTxt = await dRes.text(); if (dTxt) { const d = JSON.parse(dTxt); dErrMsg = d.error ?? dErrMsg; } } catch {}
          setSaveError(dErrMsg);
          return;
        }
      }
      if (dest === "detail") {
        // Finalize the transfer: PATCH header → הסתיימה (cascades details → סגירה).
        // MUST verify success before showing ✓ — otherwise a failed finalize
        // would leave the transfer as a draft while the user believes it's done.
        const finRes = await fetch(`/api/transfers/${headerId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "הסתיימה" }),
        });
        if (!finRes.ok) {
          let finMsg = "שגיאה בסיום ההעברה — השורות נשמרו אך ההעברה נותרה טיוטא. נסה שנית";
          try { const d = await finRes.json(); finMsg = d.error ?? finMsg; } catch {}
          setSaveError(finMsg);
          return;
        }
        setSaveSuccess("ההעברה הושלמה ונשמרה בהצלחה ✓");
        setTimeout(() => router.push(`/transfers/${headerId}`), 1500);
      } else {
        setSaveSuccess("הטיוטה נשמרה בהצלחה ✓");
        setTimeout(() => router.push("/transfers"), 1500);
      }
    } finally {
      setSaving(false);
    }
  }

  // ── Column headers ────────────────────────────────────────────────────────
  const editCols = isMortality
    ? ["סוג דג","משקל ממוצע (גרם)","מספר דגים","משקל כולל (ק\"ג)","שעת ההתרחשות","סיבת תמותה","סגור","מחק"]
    : isKiniya
    ? ["אמצעי העברה","מספר רכב","סוג דג","בריכת יעד","משקל ממוצע (גרם)","מספר דגים","משקל כולל (ק\"ג)","שעת העברה","שלב באכלוס","סגור","מחק"]
    : isShivuk
    ? ["אמצעי העברה","מספר רכב","סוג דג","משקל ממוצע (גרם)","משקל כולל (ק\"ג)","מספר דגים","שעת העברה","שלב באכלוס","סגור","מחק"]
    : ["אמצעי העברה","מספר רכב","סוג דג","בריכת יעד","משקל ממוצע (גרם)","משקל כולל (ק\"ג)","מספר דגים","שעת העברה","שלב באכלוס","סגור","מחק"];

  const closedCols = isMortality
    ? ["סוג דג","ממוצע (גרם)","כמות","משקל (ק\"ג)","שעה","סיבת תמותה","✎","🗑"]
    : isKiniya
    ? ["אמצעי","רכב","סוג דג","בריכת יעד","ממוצע (גרם)","כמות","משקל (ק\"ג)","שעה","שלב","✎","🗑"]
    : isShivuk
    ? ["אמצעי","רכב","סוג דג","ממוצע (גרם)","משקל (ק\"ג)","כמות","שעה","שלב","✎","🗑"]
    : ["אמצעי","רכב","סוג דג","בריכת יעד","ממוצע (גרם)","משקל (ק\"ג)","כמות","שעה","שלב","✎","🗑"];

  const addLabel    = isMortality ? "הוסף רשומה" : "הוסף טנק";
  const closeLabel  = isMortality ? "סגור רשומה" : "סגירת טנק";
  const closedTitle = isMortality ? "רשומות סגורות" : "טנקים סגורים";
  const openTitle   = isMortality ? "פירוט תמותת דגים"  : "שקילת טנקים";

  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:"calc(100vh - 54px)", background:"#F2EDE3", padding:0 }}>

      {/* ── Dark-green top bar ── */}
      <div style={{ background:"#1B3A2B", padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button type="button" className="tf-back-btn" onClick={() => safeNavigate("/ops")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            חזרה
          </button>
          <span className="tf-breadcrumb">תפעול › העברות</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {existingDrafts.length > 0 && (
            <button type="button" onClick={() => setShowDraftPicker((v) => !v)}
              style={{ background:"#d97706", color:"white", border:"none", borderRadius:7, padding:"6px 12px", fontSize:12, fontWeight:700, fontFamily:"inherit", cursor:"pointer", display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              ייבא מטיוטה
            </button>
          )}
          <span className={`tf-type-badge ${currentBadge}`}>{transferType || "בחר סוג"}</span>
        </div>
      </div>

      {/* ── Type strip ── */}
      <div style={{ background:"white", borderBottom:"2px solid #e5e7eb", padding:"10px 14px", display:"flex", gap:8, flexWrap:"wrap", flexShrink:0, alignItems:"center" }}>
        <span style={{ fontSize:11, fontWeight:700, color:"#6b7280", whiteSpace:"nowrap", marginLeft:4 }}>
          סוג העברה: <span style={{ color:"#ef4444" }}>*</span>
        </span>
        {TYPE_DATA.map((t) => (
          <button key={t.type} type="button"
            className={`tf-type-btn${transferType === t.type ? " active" : ""}`}
            style={{ "--tc": t.tc, "--ts": t.ts } as React.CSSProperties}
            onClick={() => selectType(t.type)}>
            {t.emoji} {t.type}
          </button>
        ))}
      </div>

      {/* ── Scrollable body ── */}
      <div className="transfer-scrollable" style={{ flex:1, paddingBottom: transferType ? 108 : 20 }}>

        {/* Draft picker */}
        {showDraftPicker && existingDrafts.length > 0 && (
          <div style={{ background:"#fffbeb", border:"1.5px solid #fcd34d", borderRadius:12, padding:14, margin:"12px 14px 0" }}>
            <p style={{ fontSize:12, fontWeight:700, color:"#92400e", marginBottom:8 }}>
              טיוטות פתוחות ({existingDrafts.length})
            </p>
            {existingDrafts.map((d) => (
              <button key={d.id} type="button" onClick={() => safeNavigate(`/transfers/${d.id}`)}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:8, textAlign:"right", fontSize:13, color:"#92400e", background:"none", border:"none", cursor:"pointer", borderRadius:8, padding:"6px 8px", fontFamily:"inherit" }}>
                <span style={{ fontWeight:700, flexShrink:0 }}>{d.transferType}</span>
                <span style={{ color:"#d97706" }}>·</span>
                <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.sourcePondName}</span>
                <span style={{ fontSize:11, color:"#d97706", marginRight:"auto", flexShrink:0 }}>
                  {new Date(d.transferDate).toLocaleDateString("he-IL")}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ── Mortality reminder banner (spec v4: "כדאי להוסיף תזכורת") ── */}
        {isMortality && (
          <div style={{ margin:"10px 14px 0", padding:"10px 14px", background:"#fff3cd", border:"1.5px solid #f59e0b", borderRadius:8, fontSize:13, color:"#92400e", fontWeight:600, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:16 }}>⚠️</span>
            לדווח רק על דגים מתים שהוצאו מהבריכה — אין לדווח על דגים שנשארו בה
          </div>
        )}

        {/* ── Header section — ALWAYS VISIBLE ── */}
        <div className="tf-header-section" style={{ margin:"12px 14px 0" }}>
          <div className="tf-section-title">פרטי העברה</div>
          <div className="tf-header-row" style={{ flexWrap:"wrap", gap:10 }}>

            <div className="tf-field tf-field-date">
              <label className="tf-label">תאריך</label>
              <input type="date" className="tf-date-input"
                value={transferDate} onChange={(e) => setTransferDate(e.target.value)} max={today} required/>
            </div>

            {isKiniya ? (<>
              <div className="tf-field" style={{ flex:"0 0 auto" }}>
                <label className="tf-label no-req">בריכת שליה</label>
                <div style={{ padding:"9px 14px", background:"#fef3c7", border:"1.5px solid #f59e0b", borderRadius:8, fontSize:13, fontWeight:700, color:"#92400e", whiteSpace:"nowrap" }}>
                  🏪 מחסן ראשי
                </div>
              </div>
              <div className="tf-field tf-supplier-wrap" style={{ flex:"0 0 200px" }}>
                <label className="tf-label">שם ספק</label>
                <select className="tf-supplier-select" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">— בחר ספק —</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </>) : (<>
              <div className="tf-field tf-field-pool">
                <label className="tf-label">
                  {isMortality ? "בריכת גידול" : "בריכת שליה"}
                  {!transferType && <span style={{ color:"#9ca3af", fontWeight:400, fontSize:11, marginRight:4 }}>(בחר סוג תחילה)</span>}
                </label>
                <PondCombobox id="src-pond" ponds={ponds} value={pondId} onChange={setPondId}
                  required={!!transferType} inputStyle={TF_INPUT}
                  labelExtra={(p) => p.hasActiveCycle ? "פתוחה" : "ללא מחזור"}/>
                {pondCycleBlocked && (
                  <p style={{ fontSize:11, color:"#d97706", marginTop:4 }}>לבריכה זו אין מחזור גידול פעיל</p>
                )}
              </div>
              <div className="tf-field" style={{ flex:"0 0 110px" }}>
                <label className="tf-label no-req">קוד בריכה</label>
                <input type="text" className="tf-date-input" readOnly
                  value={selectedPond?.code ?? ""}
                  placeholder="אוטומטי"
                  style={selectedPond?.code ? TF_AUTO : TF_GHOST}/>
              </div>
              <div className="tf-field" style={{ flex:"0 0 165px" }}>
                <label className="tf-label no-req">קוד מחזור</label>
                <input type="text" className="tf-date-input" readOnly
                  value={selectedPond?.activeCycleCode ?? ""}
                  placeholder="אוטומטי"
                  style={selectedPond?.activeCycleCode ? TF_AUTO : TF_GHOST}/>
              </div>
            </>)}
          </div>

          {matchingDraft && (
            <div style={{ background:"#eff6ff", border:"1.5px solid #93c5fd", borderRadius:10, padding:"10px 14px", marginTop:10, display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
              <p style={{ fontSize:13, color:"#1d4ed8", margin:0 }}>קיימת טיוטה פתוחה לבריכה ותאריך אלה</p>
              <button type="button" onClick={() => safeNavigate(`/transfers/${matchingDraft.id}`)}
                style={{ fontSize:13, fontWeight:700, color:"#1d4ed8", background:"none", border:"none", cursor:"pointer", textDecoration:"underline", whiteSpace:"nowrap", fontFamily:"inherit" }}>
                המשך להעברה קיימת ←
              </button>
            </div>
          )}

          {transferType && (
            <div className="tf-field" style={{ marginTop:10 }}>
              <label className="tf-label no-req">
                {isMortality ? "הערות על אירוע התמותה" : "הערות"}
              </label>
              <textarea value={headerNotes} onChange={(e) => setHeaderNotes(e.target.value)}
                rows={2} style={{ ...TF_INPUT, resize:"vertical" }}
                placeholder={isMortality ? "פרט נסיבות, תסמינים, טיפולים..." : undefined}/>
            </div>
          )}
        </div>

        {/* No type: prompt */}
        {!transferType && (
          <div style={{ textAlign:"center", padding:"40px 20px", color:"#9ca3af" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>☝️</div>
            <div style={{ fontSize:15, fontWeight:700, color:"#374151", marginBottom:6 }}>בחר סוג העברה</div>
            <div style={{ fontSize:13 }}>לחץ על אחד הכפתורים למעלה כדי להתחיל</div>
          </div>
        )}

        {/* ── Rows section — shown immediately when type is selected ── */}
        {transferType && (
          <div style={{ margin:"14px 14px 0" }}>

            {/* Active rows */}
            <div className="tf-rows-section">
              <div className="tf-rows-title" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px" }}>
                <span style={{ display:"flex", alignItems:"center", gap:8 }}>
                  {openTitle}
                  {editingRows.length > 0 && (
                    <span style={{ background:"#3b82f6", color:"white", borderRadius:10, padding:"1px 7px", fontSize:10 }}>
                      {editingRows.length}
                    </span>
                  )}
                </span>
                <button type="button" onClick={addRow}
                  style={{ background:"#1B3A2B", color:"white", border:"none", borderRadius:20, width:28, height:28, fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1, flexShrink:0 }}>
                  +
                </button>
              </div>

              {editingRows.length === 0 ? (
                <div style={{ textAlign:"center", padding:"18px 20px", color:"#9ca3af", fontSize:13 }}>
                  לחץ + כדי להוסיף {isMortality ? "רשומה" : "טנק"}
                </div>
              ) : (
                <div className="tf-table-wrap">
                  <table className="tf-table">
                    <thead><tr>
                      {editCols.map((col,i) => (
                        <th key={i} className={col === "סגור" || col === "מחק" ? "center" : ""}>{col}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {editingRows.map((r) => {
                        const destPonds = getDestPonds();
                        return (
                          <tr key={r.localId} style={{ background: isMortality ? "#fff5f5" : "#fafeff" }}>
                            {!isMortality && (<>
                              <td>
                                <select className={`tf-row-select${!r.meansDisplay?" unset":""}`} style={{ minWidth:100 }}
                                  value={r.meansDisplay} onChange={(e) => updateRow(r.localId,"meansDisplay",e.target.value)}>
                                  <option value="" disabled>בחר...</option>
                                  {MEANS_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                                </select>
                              </td>
                              <td>
                                <input type="text" className="tf-row-input"
                                  value={r.vehicleText}
                                  onChange={(e) => updateRow(r.localId,"vehicleText",e.target.value)}
                                  placeholder={r.meansDisplay==="טנק שלנו" ? "קוד טנק" : "מס׳ רכב"}
                                  style={{ minWidth:80 }}/>
                              </td>
                            </>)}

                            <td>
                              <select className={`tf-row-select${!r.fishStrainId?" unset":""}`}
                                value={r.fishStrainId} onChange={(e) => updateRow(r.localId,"fishStrainId",e.target.value)}>
                                <option value="" disabled>בחר דג...</option>
                                {fishStrains.map((f) => (
                                  <option key={f.id} value={f.id}>{f.englishName||f.latinName}</option>
                                ))}
                              </select>
                            </td>

                            {/* ── dest pond (before weighing) — hidden for שיווק, auto-set to מחסן ראשי ── */}
                            {!isMortality && !isShivuk && (
                              <td>
                                <select className={`tf-row-select${!r.destPondId?" unset":""}`} style={{ minWidth:120 }}
                                  value={r.destPondId} onChange={(e) => updateRow(r.localId,"destPondId",e.target.value)}>
                                  <option value="" disabled>בחר בריכה...</option>
                                  {destPonds.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ""}</option>
                                  ))}
                                </select>
                              </td>
                            )}

                            {/* ── avg weight: differs by type ── */}
                            <td>
                              {isWeighingType ? (
                                /* דילול/פירוק/שיווק: readonly + ⚖️ button */
                                <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                                  <input type="number" readOnly className="tf-row-input"
                                    value={r.avgWeightGrams}
                                    placeholder="גרם"
                                    style={{ minWidth:60,
                                      ...(r.avgFromWeighing
                                        ? { background:"#d1fae5", color:"#065f46", fontWeight:700, borderColor:"#6ee7b7" }
                                        : COMPUTED)
                                    }}/>
                                  <button type="button" className="tf-avg-pull-btn"
                                    title="משיכת משקל ממוצע משקילה"
                                    onClick={() => openWeighingModal(r.localId)}>
                                    ⚖️
                                  </button>
                                </div>
                              ) : (
                                /* קניה / תמותה: manual */
                                <input type="number" min="0" step="1" className="tf-row-input"
                                  value={r.avgWeightGrams}
                                  onChange={(e) => updateRow(r.localId,"avgWeightGrams",e.target.value)}
                                  placeholder="גרם"
                                  style={{ minWidth:65 }}/>
                              )}
                            </td>

                            {/* קניה/תמותה: count is manual */}
                            {(isKiniya || isMortality) && (
                              <td>
                                <input type="number" min="0" step="1" className="tf-row-input"
                                  value={r.fishCount}
                                  onChange={(e) => updateRow(r.localId,"fishCount",e.target.value)}
                                  placeholder="כמות" style={{ minWidth:65 }}/>
                              </td>
                            )}

                            {/* total weight: computed for קניה/תמותה, manual for others */}
                            <td>
                              {(isKiniya||isMortality) ? (
                                <input type="number" readOnly className="tf-row-input"
                                  value={r.totalWeightKg} placeholder="אוטומטי"
                                  style={{ minWidth:70, ...COMPUTED }}/>
                              ) : (
                                <input type="number" min="0" step="0.1" className="tf-row-input tf-row-weight"
                                  value={r.totalWeightKg}
                                  onChange={(e) => updateRow(r.localId,"totalWeightKg",e.target.value)}
                                  placeholder="0.0" style={{ minWidth:75 }}/>
                              )}
                            </td>

                            {/* count: computed for דילול/פירוק/שיווק */}
                            {!isKiniya && !isMortality && (
                              <td>
                                <input type="text" readOnly className="tf-row-input"
                                  value={r.fishCount} placeholder="—"
                                  style={{ minWidth:65, ...COMPUTED }}/>
                              </td>
                            )}

                            <td>
                              <input type="text" className="tf-row-input tf-row-time"
                                value={r.transferTime}
                                placeholder="HH:mm"
                                maxLength={5}
                                onChange={(e) => updateRow(r.localId,"transferTime",e.target.value)}/>
                            </td>

                            {!isMortality && (
                              <td>
                                {transferType === "שיווק" ? (
                                  /* שיווק: locked to "שיווק" per spec */
                                  <input type="text" readOnly className="tf-row-input"
                                    value="שיווק"
                                    style={{ minWidth: 90, background: "#fef3c7", color: "#92400e", fontWeight: 700, border: "1.5px solid #f59e0b" }} />
                                ) : (
                                  <select className={`tf-row-select${!r.populationCodeId?" unset":""}`}
                                    value={r.populationCodeId} onChange={(e) => updateRow(r.localId,"populationCodeId",e.target.value)}>
                                    <option value="" disabled>שלב...</option>
                                    {populationCodes.map((pc) => (
                                      <option key={pc.id} value={pc.id}>{pc.code}</option>
                                    ))}
                                  </select>
                                )}
                              </td>
                            )}

                            {isMortality && (
                              <td>
                                <select className={`tf-row-select${!r.mortalityCause?" unset":""}`} style={{ minWidth:130 }}
                                  value={r.mortalityCause} onChange={(e) => updateRow(r.localId,"mortalityCause",e.target.value)}>
                                  <option value="" disabled>בחר סיבה...</option>
                                  {MORTALITY_CAUSES.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </td>
                            )}

                            <td className="center">
                              <button type="button" className="tf-save-row-btn"
                                onClick={() => closeRowById(r.localId)}
                                style={{ whiteSpace:"nowrap", padding:"5px 8px", display:"flex", alignItems:"center", gap:3 }}>
                                <SaveRowIcon/>{closeLabel}
                              </button>
                            </td>
                            <td className="center">
                              <button type="button" className="tf-del-row-btn"
                                onClick={() => deleteRowById(r.localId)}>
                                <TrashIcon/>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <button type="button" className="tf-add-row-btn" onClick={addRow}>
                <PlusIcon/>{addLabel}
              </button>

              {rowError && (
                <div style={{ background:"#fef2f2", borderTop:"1px solid #fca5a5", padding:"8px 14px", fontSize:13, color:"#dc2626" }}>
                  {rowError}
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ background:"#e2e8f0", borderRadius:8, padding:"6px 14px", fontSize:11, fontWeight:700, color:"#475569", textAlign:"center", margin:"12px 0 10px", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              {closedTitle}
              <span style={{ background:"#1B3A2B", color:"white", borderRadius:10, padding:"1px 8px", fontSize:10 }}>
                {closedRows.length}
              </span>
            </div>

            {/* Closed rows */}
            <div className="tf-rows-section">
              {closedRows.length === 0 ? (
                <div style={{ textAlign:"center", padding:"18px 20px", fontSize:13, color:"#9ca3af" }}>
                  אין {isMortality ? "רשומות" : "טנקים"} סגורים עדיין
                </div>
              ) : (
                <div className="tf-table-wrap">
                  <table className="tf-table">
                    <thead><tr>
                      {closedCols.map((col,i) => (
                        <th key={i} className={col==="✎"||col==="🗑" ? "center" : ""}>{col}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {closedRows.map((r,ri) => {
                        const bg = ri%2===0 ? "white" : "#f0fdf8";
                        return (
                          <tr key={r.localId} style={{ background:bg, borderBottom:"1px solid #d1fae5" }}>
                            {!isMortality && (<>
                              <td>
                                {r.meansDisplay ? (
                                  <span style={{ background:"#dcfce7", color:"#15803d", padding:"2px 7px", borderRadius:6, fontWeight:600, fontSize:11 }}>
                                    {r.meansDisplay}
                                  </span>
                                ) : "—"}
                              </td>
                              <td style={{ color:"#6b7280" }}>{r.vehicleText||"—"}</td>
                            </>)}
                            <td style={{ fontWeight:600 }}>{fishLabel(fishStrains,r.fishStrainId)}</td>
                            {!isMortality && (
                              <td>{pondLabel(allPonds,r.destPondId)}</td>
                            )}
                            <td style={{ textAlign:"center", color:"#1d4ed8", fontWeight:700 }}>
                              {r.avgWeightGrams||"—"}
                              {r.avgFromWeighing && <span style={{ color:"#059669", fontSize:10, marginRight:3 }}> ⚖️</span>}
                            </td>
                            {(isKiniya||isMortality) && (
                              <td style={{ textAlign:"center" }}>{r.fishCount||"—"}</td>
                            )}
                            <td style={{ textAlign:"center", fontWeight:700 }}>
                              {r.totalWeightKg ? parseFloat(r.totalWeightKg).toFixed(1) : "—"}
                            </td>
                            {!isKiniya && !isMortality && (
                              <td style={{ textAlign:"center" }}>{r.fishCount||"—"}</td>
                            )}
                            <td style={{ textAlign:"center", color:"#6b7280" }}>{r.transferTime||"—"}</td>
                            {!isMortality && (
                              <td style={{ color:"#9ca3af", fontSize:11 }}>{popLabel(populationCodes,r.populationCodeId)}</td>
                            )}
                            {isMortality && (
                              <td style={{ fontSize:11, color:"#dc2626" }}>{r.mortalityCause||"—"}</td>
                            )}
                            <td className="center">
                              <button type="button" className="tf-edit-row-btn" onClick={() => openRowById(r.localId)}>
                                <PenIcon/>
                              </button>
                            </td>
                            <td className="center">
                              <button type="button" className="tf-del-row-btn" onClick={() => deleteRowById(r.localId)}>
                                <TrashIcon/>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {saveSuccess && (
              <div style={{ background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:8, padding:"8px 12px", marginTop:8, fontSize:13, color:"#16a34a", fontWeight:700, display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:18 }}>✓</span>{saveSuccess}
              </div>
            )}
            {saveError && (
              <div style={{ background:"#fef2f2", border:"1.5px solid #fca5a5", borderRadius:8, padding:"8px 12px", marginTop:8, fontSize:13, color:"#dc2626" }}>
                {saveError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Fixed bottom: summary + save ── */}
      {transferType && (
        <div style={{ flexShrink:0 }}>
          <div className="tf-summary-bar">
            <div className="tf-sum-cell">
              <div className="tf-sum-lbl">{isMortality ? "רשומות" : "טנקים"}</div>
              <div className="tf-sum-val">{closedRows.length}</div>
            </div>
            <div className="tf-sum-cell">
              <div className="tf-sum-lbl">{"סה\"כ ק\"ג"}</div>
              <div className="tf-sum-val">{totalKg > 0 ? totalKg.toFixed(1) : "0"}</div>
            </div>
            <div className="tf-sum-cell">
              <div className="tf-sum-lbl">{"סה\"כ דגים"}</div>
              <div className="tf-sum-val">{totalFish > 0 ? totalFish.toLocaleString("he-IL") : "0"}</div>
            </div>
          </div>
          <div style={{ background:"#1B3A2B", display:"flex", gap:10, padding:"10px 14px" }}>
            <button type="button" onClick={() => doSave("detail")}
              disabled={saving || closedRows.length===0 || editingRows.length>0}
              style={{ flex:1, padding:"11px 14px", background:"#1B3A2B", border:"2px solid rgba(255,255,255,0.35)", borderRadius:8, color:"white", fontWeight:700, fontSize:14, fontFamily:"inherit",
                cursor:(saving||closedRows.length===0||editingRows.length>0)?"not-allowed":"pointer",
                opacity:(saving||closedRows.length===0||editingRows.length>0)?0.45:1 }}>
              {saving ? "שומר..." : "סכם העברה"}
            </button>
            <button type="button" onClick={() => doSave("list")}
              disabled={saving || closedRows.length===0}
              style={{ flexShrink:0, padding:"11px 16px", background:"#d97706", border:"none", borderRadius:8, color:"white", fontWeight:700, fontSize:13, fontFamily:"inherit",
                cursor:(saving||closedRows.length===0)?"not-allowed":"pointer",
                opacity:(saving||closedRows.length===0)?0.45:1 }}>
              שמור כטיוטה
            </button>
          </div>
        </div>
      )}

      {/* ── Weighing modal ── */}
      {weighingTarget && (
        <WeighingModal
          transferId={weighingTarget.headerId}
          detailId={weighingTarget.detailId}
          onClose={(avgGrams) => {
            if (avgGrams != null) {
              setRows((prev) => prev.map((r) =>
                r.localId === weighingTarget.localId
                  ? { ...r, avgWeightGrams: String(Math.round(avgGrams)), avgFromWeighing: true }
                  : r
              ));
            }
            setWeighingTarget(null);
          }}
        />
      )}

      {/* Auto-saving indicator */}
      {autoSaving && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.4)",
          display:"flex", alignItems:"center", justifyContent:"center",
          zIndex:2000,
        }}>
          <div style={{
            background:"white", borderRadius:12, padding:"20px 32px",
            boxShadow:"0 8px 32px rgba(0,0,0,0.2)", fontSize:14, fontWeight:700, color:"#374151",
          }}>
            שומר טיוטא...
          </div>
        </div>
      )}
    </div>
  );
}