"use client";

import { useState, useEffect, useMemo, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import PondCombobox from "@/components/PondCombobox";
import WeighingModal from "./WeighingModal";
import { isVirtualPondType } from "@/lib/cycles";

interface FishStrain { id: string; englishName: string | null; latinName: string; }
// Lightweight shape — matches what a Detail's destPond relation actually selects
// (id/code/name only). Kept separate from PondWithCycle below so existing detail
// rows don't need to carry pondType/active-cycle data they were never fetched with.
interface Pond { id: string; code: string | null; name: string; }
// Richer shape for the pond-picker options (item #1/#2/#4, Dean 2026-06-29): every
// pond search must show open/closed status, and dest-pond filtering/blocking needs
// to know the pond's type and whether it has an open growth cycle.
interface PondWithCycle extends Pond {
  pondTypeName: string;
  hasActiveCycle: boolean;
  activeCycleCode: string | null;
}
interface PopulationCode { id: string; code: string; }
interface WeightType { id: string; name: string; }
interface Tank { id: string; code: string; }
interface TransferMeansData {
  id: string; meansType: string; internalTankId: string | null; externalVehicleCode: string | null;
}
interface Weighing { id: string; date: string; }

interface Detail {
  id: string;
  fishStrainId: string;
  fishStrain: FishStrain;
  destPondId: string;
  destPond: Pond;
  fishCount: number | null;
  avgWeightGrams: number | null;
  totalWeightKg: number | null;
  transferTime: string | null;
  populationCodeId: string | null;
  populationCode: PopulationCode | null;
  transferMeansId: string | null;
  transferMeans: TransferMeansData | null;
  status: string;
  notes: string | null;
  weighings: Weighing[];
}

// Staged-save model for תמותה only (spec page 19, item #8 — Dean approved "build fully
// per spec" 2026-06-29). Rows loaded from the server start locked (read-only) with an
// "ערוך" button to unlock; rows added this session start unlocked. "מחק" only *stages*
// a row for removal — the actual create/update/delete against the DB happens in one
// batch call when "שמור" is pressed, wrapped server-side in a rollback transaction, so a
// half-finished edit never partially lands.
interface MortalityRow {
  localId: string; // existing FishTransferDetail.id, or a temp "new-N" id for unsaved rows
  isNew: boolean;
  isLocked: boolean;
  markedForDelete: boolean;
  fishStrainId: string;
  fishCountInput: string; // raw text input
  avgWeightKgInput: string; // raw text input — entered/displayed in kg app-wide
  transferTime: string; // datetime-local string
  mortalityCause: string;
  otherNotes: string; // free text when mortalityCause === "אחר"
}

interface Header {
  id: string;
  transferType: string;
  transferDate: string;
  status: string;
  sourcePondId: string;
  // Part A summary surfaced inside Part B (Dean, 2026-06-29, item #3) — needs the name
  // alongside the id since this component never fetches ponds by id itself.
  sourcePondName: string;
  cycleId: string;
  cycleCode: string;
  supplierName?: string | null; // Gap #9: for קניה, show supplier instead of sourcePondName in banners
  notes?: string | null;
}

interface Props {
  header: Header;
  initialDetails: Detail[];
  fishStrains: FishStrain[];
  // Full pond list (with type + active-cycle status) — this component derives its own
  // type-specific dest-pond filtering from it instead of receiving a pre-filtered list,
  // so closed ponds can still be shown (with status) rather than silently hidden.
  allPonds: PondWithCycle[];
  populationCodes: PopulationCode[];
  weightTypes: WeightType[];
  tanks: Tank[];
  suppliers: { id: string; name: string }[];
  canEdit: boolean;
  // Fish strains already on this pond's roster (from קניה transfers in this cycle).
  // A non-empty set here enables the החלפת דגים dialog (spec p.42): picking a strain
  // not in this set opens the 3-option overlay instead of adding the row directly.
  // Empty array = no previous קניה transfers found = no dialog (first fish in pond).
  pondRosterStrainIds: string[];
  // תמותה rows auto-route to a virtual "receiving" pond instead of a real dest pond
  // (merged back into this unified manager 2026-06-21 per the prototype's
  // ops-transfers-screen — see CLAUDE.md "New authoritative UI/UX reference").
  virtualPondId?: string;
}

const INPUT =
  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-400";
const BTN =
  "bg-brand-600 hover:bg-brand-700 text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const BTN_OUTLINE =
  "border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 transition-colors";
const BTN_BLUE =
  "bg-blue-600 hover:bg-blue-700 text-white rounded px-2.5 py-1 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

const WEIGHABLE = ["דילול", "פירוק", "שיווק"];

// Spec page 19: "סיבת תמותה — לבחור מתוך רשימה" (selected from a list, not free text).
// The spec doesn't enumerate the actual list — built from the prototype's own example
// hints ("חמצן, מחלה, חום...") plus standard fish-farm mortality categories, with an
// "אחר" escape hatch that reveals a free-text follow-up so no real-world cause is lost.
// Flagged to Dean: confirm/edit this list with farm staff if it should differ.
const MORTALITY_CAUSES = [
  "חמצן (היפוקסיה)",
  "מחלה",
  "חום / טמפרטורה קיצונית",
  "זיהום מים",
  "טיפול כימי",
  "תמותה טבעית",
  "אחר",
];

function nowLocal(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function strainLabel(s: FishStrain) { return s.englishName ?? s.latinName; }

function tankLabel(meansData: TransferMeansData | null, tanks: Tank[]): string {
  if (!meansData) return "—";
  if (meansData.meansType === "פנימי" && meansData.internalTankId) {
    const t = tanks.find((tk) => tk.id === meansData.internalTankId);
    return t?.code ?? "טנק";
  }
  if (meansData.meansType === "חיצוני" && meansData.externalVehicleCode) {
    return meansData.externalVehicleCode;
  }
  return "—";
}

export default function TransferDetailManager({
  header,
  initialDetails,
  fishStrains,
  allPonds,
  populationCodes,
  weightTypes,
  tanks,
  canEdit,
  virtualPondId,
  pondRosterStrainIds,
}: Props) {
  const router = useRouter();
  const [details, setDetails] = useState<Detail[]>(initialDetails);
  const [headerStatus, setHeaderStatus] = useState(header.status);
  const [headerNotes, setHeaderNotes] = useState(header.notes ?? "");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesFeedback, setNotesFeedback] = useState<string | null>(null);

  const isWeighable = WEIGHABLE.includes(header.transferType);
  const isMortality = header.transferType === "תמותה";
  const isShiuukType = header.transferType === "שיווק";

  // Dest-pond options for Part B, derived per transfer type (Dean, 2026-06-29):
  // - שיווק ships to the מחסן שיווק warehouse, which never carries a growth cycle —
  //   so it's the one type that doesn't require an active cycle on the dest pond.
  // - Every other non-mortality type (קניה/דילול/פירוק) moves fish into a real pond,
  //   so only concrete (non-virtual, non-בור) ponds are valid destinations (item #2),
  //   and an active cycle is required before the row can be added (item #4).
  // Closed ponds are still shown (not hidden) so the open/closed status is visible
  // in the search (item #1) — selecting one is what triggers the block + warning.
  const destPondOptions: PondWithCycle[] = useMemo(() => {
    if (isShiuukType) return allPonds.filter((p) => p.pondTypeName === "מחסן שיווק");
    return allPonds.filter((p) => !isVirtualPondType(p.pondTypeName) && p.pondTypeName !== "בור");
  }, [allPonds, isShiuukType]);
  const destPondRequiresActiveCycle = !isShiuukType;

  // --- Add-row form state ---
  const [addOpen, setAddOpen] = useState(false);
  const [fishStrainId, setFishStrainId] = useState("");
  const [destPondId, setDestPondId] = useState("");
  // קניה fields
  const [fishCount, setFishCount] = useState("");
  const [avgWeightGrams, setAvgWeightGrams] = useState("");
  // דילול/פירוק/שיווק field
  const [totalWeightKg, setTotalWeightKg] = useState("");
  const [transferTime, setTransferTime] = useState(nowLocal);
  const [populationCodeId, setPopulationCodeId] = useState("");
  const [meansType, setMeansType] = useState<"פנימי" | "חיצוני" | "">("");
  const [internalTankId, setInternalTankId] = useState("");
  const [externalVehicleCode, setExternalVehicleCode] = useState("");
  const [rowNotes, setRowNotes] = useState("");
  // mortality-only: "סיבת תמותה" select + free-text follow-up when "אחר" is chosen
  const [mortalityCause, setMortalityCause] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSaving, setAddSaving] = useState(false);

  // --- Close row ---
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);

  // --- Staged row deletion (קניה/דילול/פירוק/שיווק — spec p.36-38, prototype tfDelRow) ---
  // Clicking "מחק" only hides the row + recalculates the summary locally; the actual
  // DB delete is deferred to the batch endpoint and flushed on "שמור כטיוטה"/"סכם העברה"
  // (mirrors the deferred-delete language used for all four non-מותה transfer types).
  const [stagedDeleteIds, setStagedDeleteIds] = useState<Set<string>>(new Set());
  const [flushingDeletes, setFlushingDeletes] = useState(false);

  // --- Inline edit of אמצעי העברה on an already-saved row (spec pages 15-16:
  // "אמצעי העברה ניתן לעדכון, לא אפור" — must stay editable after the row is created,
  // not just at creation time). Not relevant for תמותה (no transfer means there). ---
  const [editingMeansId, setEditingMeansId] = useState<string | null>(null);
  const [editMeansType, setEditMeansType] = useState<"פנימי" | "חיצוני" | "">("");
  const [editInternalTankId, setEditInternalTankId] = useState("");
  const [editExternalVehicleCode, setEditExternalVehicleCode] = useState("");
  const [editMeansSaving, setEditMeansSaving] = useState(false);
  const [editMeansError, setEditMeansError] = useState<string | null>(null);

  function startEditMeans(d: Detail) {
    setEditingMeansId(d.id);
    setEditMeansType((d.transferMeans?.meansType as "פנימי" | "חיצוני" | undefined) ?? "");
    setEditInternalTankId(d.transferMeans?.internalTankId ?? "");
    setEditExternalVehicleCode(d.transferMeans?.externalVehicleCode ?? "");
    setEditMeansError(null);
  }

  function cancelEditMeans() {
    setEditingMeansId(null);
    setEditMeansError(null);
  }

  async function saveEditMeans(detailId: string) {
    setEditMeansSaving(true);
    setEditMeansError(null);
    try {
      const body: Record<string, unknown> = {};
      if (editMeansType) {
        body.meansType = editMeansType;
        if (editMeansType === "פנימי") body.internalTankId = editInternalTankId || null;
        if (editMeansType === "חיצוני") body.externalVehicleCode = editExternalVehicleCode || null;
      }
      const res = await fetch(`/api/transfers/${header.id}/details/${detailId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setEditMeansError(data.error ?? "שגיאה בעדכון אמצעי העברה"); return; }
      setDetails((prev) =>
        prev.map((d) =>
          d.id === detailId
            ? {
                ...d,
                transferMeans: editMeansType
                  ? {
                      id: d.transferMeans?.id ?? "",
                      meansType: editMeansType,
                      internalTankId: editMeansType === "פנימי" ? editInternalTankId || null : null,
                      externalVehicleCode: editMeansType === "חיצוני" ? editExternalVehicleCode || null : null,
                    }
                  : d.transferMeans,
              }
            : d
        )
      );
      setEditingMeansId(null);
    } catch {
      setEditMeansError("שגיאת תקשורת");
    } finally {
      setEditMeansSaving(false);
    }
  }

  // --- Finalize (Gap #8) — custom overlay instead of window.confirm() ---
  const [finalizeSaving, setFinalizeSaving] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [finalizeConfirmOpen, setFinalizeConfirmOpen] = useState(false);

  // --- Weighing popup (spec: "רצוי שיהיה חלון קופץ מעל למסך ההעברות ולא מסך נפרד") ---
  const [weighingDetailId, setWeighingDetailId] = useState<string | null>(null);

  // --- החלפת דגים dialog state (spec page 42) ---
  // Triggered when user selects a strain not in pondRosterStrainIds.
  // pendingSwitchStrain = the strain the user just selected (not on roster).
  // rosterStrains = strains currently on the pond roster, shown as options for replacement.
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
  const [pendingSwitchStrainId, setPendingSwitchStrainId] = useState<string | null>(null);
  const [switchReplacementStrainId, setSwitchReplacementStrainId] = useState("");
  const [switchSaving, setSwitchSaving] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  // Beforeunload guard when the add form is dirty
  const formDirty = addOpen && (!!fishStrainId || !!destPondId || !!fishCount || !!totalWeightKg);
  useEffect(() => {
    if (!formDirty) return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [formDirty]);

  const isFinished = headerStatus === "הסתיימה";
  // Rows staged for deletion disappear from both lists + the summary immediately —
  // "בעת לחיצה על הכפתור יתבצע חישוב מחדש של שורת הסיכום" — even though the underlying
  // DB row still exists until the next save flushes stagedDeleteIds.
  const liveDetails = details.filter((d) => !stagedDeleteIds.has(d.id));
  const draftRows = liveDetails.filter((d) => d.status === "טיוטא");
  const closedRows = liveDetails.filter((d) => d.status === "סגירה");

  // Auto-lock populationCode for שיווק
  const isShiuuk = header.transferType === "שיווק";
  const shiuukPopCode = populationCodes.find((pc) => pc.code === "שיווק");

  // Summary bar totals (Section B) — computed over live (non-staged-for-deletion) rows
  const summaryTanks = liveDetails.length;
  const summaryWeightKg = liveDetails.reduce((sum, d) => {
    if (isWeighable) return sum + (d.totalWeightKg ?? 0);
    return sum + ((d.fishCount ?? 0) * (d.avgWeightGrams ?? 0) / 1000);
  }, 0);

  // Per-row: can we enable "סגירת טנק"? (Section D)
  // תמותה rows skip the transfer-means/population-code requirements — fish that died
  // were never moved or staged, so only the weight fields matter.
  function canCloseRow(row: Detail): boolean {
    if (isWeighable) {
      if ((row.totalWeightKg ?? 0) <= 0) return false;
      if ((row.avgWeightGrams ?? 0) <= 0) return false; // requires basket weighing first
    } else {
      if ((row.fishCount ?? 0) <= 0) return false;
      if ((row.avgWeightGrams ?? 0) <= 0) return false;
    }
    if (isMortality) return true;
    if (!row.transferMeans?.meansType) return false;
    if (row.transferMeans.meansType === "פנימי" && !row.transferMeans.internalTankId) return false;
    if (row.transferMeans.meansType === "חיצוני" && !row.transferMeans.externalVehicleCode) return false;
    if (!row.populationCodeId) return false;
    return true;
  }

  function openAddForm() {
    // Default meansType per transfer type (Section D)
    setMeansType(header.transferType === "קניה" ? "חיצוני" : isWeighable ? "פנימי" : "");
    setAddOpen(true);
  }

  async function reloadDetails() {
    const res = await fetch(`/api/transfers/${header.id}/details`);
    if (res.ok) setDetails(await res.json());
  }

  async function addDetail(e: FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!fishStrainId) {
      setAddError("יש לבחור סוג דג");
      return;
    }
    if (isMortality) {
      if (!virtualPondId) {
        setAddError("לא נמצאה בריכה וירטואלית לקליטת תמותה. פנה למנהל המערכת.");
        return;
      }
    } else if (!destPondId) {
      setAddError("יש לבחור זן ובריכת יעד");
      return;
    }

    // Item #4 (Dean, 2026-06-29): block adding the row if the chosen dest pond has no
    // open growth cycle, with an alert — not a silent failure later from the API.
    if (!isMortality && destPondRequiresActiveCycle) {
      const chosenDest = destPondOptions.find((p) => p.id === destPondId);
      if (chosenDest && !chosenDest.hasActiveCycle) {
        setAddError("לבריכת היעד שנבחרה אין מחזור גידול פתוח — יש לפתוח מחזור גידול תחילה");
        return;
      }
    }

    // החלפת דגים check (spec page 42): if the source pond has a known roster
    // (at least one previous קניה in this cycle) AND the chosen strain is not
    // on that roster, open the 3-option dialog instead of adding immediately.
    if (!isMortality && pondRosterStrainIds.length > 0 && !pondRosterStrainIds.includes(fishStrainId)) {
      // Stash the pending strain and open the dialog. addDetail will be
      // re-called (or bypassed) from inside the dialog handlers.
      setPendingSwitchStrainId(fishStrainId);
      setSwitchReplacementStrainId("");
      setSwitchError(null);
      setSwitchDialogOpen(true);
      setAddSaving(false);
      return;
    }

    if (isMortality && !mortalityCause) {
      setAddError("יש לבחור סיבת תמותה מהרשימה");
      return;
    }

    setAddSaving(true);
    try {
      const effectivePop =
        isShiuuk && shiuukPopCode ? shiuukPopCode.id : populationCodeId || undefined;

      const effectiveMortalityNotes =
        mortalityCause === "אחר" ? `אחר: ${rowNotes}`.trim() : mortalityCause;

      const body: Record<string, unknown> = {
        fishStrainId,
        destPondId: isMortality ? virtualPondId : destPondId,
        transferTime: transferTime || undefined,
        notes: isMortality ? effectiveMortalityNotes : rowNotes || undefined,
      };
      if (!isMortality) {
        if (effectivePop) body.populationCodeId = effectivePop;
        if (meansType) {
          body.meansType = meansType;
          if (meansType === "פנימי" && internalTankId) body.internalTankId = internalTankId;
          if (meansType === "חיצוני" && externalVehicleCode)
            body.externalVehicleCode = externalVehicleCode;
        }
      }

      if (isWeighable) {
        if (totalWeightKg) body.totalWeightKg = parseFloat(totalWeightKg);
      } else {
        if (fishCount) body.fishCount = parseInt(fishCount, 10);
        // avgWeightGrams input field is entered in KG; convert to grams for storage.
        if (avgWeightGrams) body.avgWeightGrams = parseFloat(avgWeightGrams) * 1000;
      }

      const res = await fetch(`/api/transfers/${header.id}/details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "שגיאה בהוספת שורה");
        return;
      }

      await reloadDetails();
      setAddOpen(false);
      resetForm();
    } catch {
      setAddError("שגיאת תקשורת");
    } finally {
      setAddSaving(false);
    }
  }

  function resetForm() {
    setFishStrainId(""); setDestPondId(""); setFishCount(""); setAvgWeightGrams("");
    setTotalWeightKg(""); setTransferTime(nowLocal()); setPopulationCodeId("");
    setMeansType(""); setInternalTankId(""); setExternalVehicleCode(""); setRowNotes("");
    setMortalityCause("");
  }

  // Stages the row for deletion only — no network call here. The row disappears from
  // the screen and the summary recalculates immediately (draftRows/summary are derived
  // from liveDetails, which already excludes stagedDeleteIds); the actual prisma delete
  // happens only when flushStagedDeletes() runs, on save (spec p.36-38).
  function deleteDetail(detailId: string) {
    const d = details.find((x) => x.id === detailId);
    if (d && d.weighings.length > 0) {
      alert("לא ניתן למחוק שורה שיש לה שקילות — מחק את השקילות תחילה");
      return;
    }
    // (Deletion is already confirmed by the staged-delete pattern — no window.confirm needed)
    setStagedDeleteIds((prev) => new Set(prev).add(detailId));
  }

  // Commits every staged deletion in one rollback-protected batch call, then reloads
  // the detail list from the server. Returns false (with an alert already shown) if the
  // flush fails, so callers (save-as-draft / finalize) can bail out before proceeding.
  async function flushStagedDeletes(): Promise<boolean> {
    if (stagedDeleteIds.size === 0) return true;
    setFlushingDeletes(true);
    try {
      const res = await fetch(`/api/transfers/${header.id}/details/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creates: [], updates: [], deleteIds: Array.from(stagedDeleteIds) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "שגיאה במחיקת השורות שסומנו למחיקה");
        return false;
      }
      setStagedDeleteIds(new Set());
      await reloadDetails();
      return true;
    } catch {
      alert("שגיאת תקשורת בעת מחיקת השורות שסומנו למחיקה");
      return false;
    } finally {
      setFlushingDeletes(false);
    }
  }

  async function closeRow(detailId: string) {
    setCloseError(null);
    setClosingId(detailId);
    try {
      const res = await fetch(`/api/transfers/${header.id}/details/${detailId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "סגירה" }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCloseError(data.error ?? "שגיאה בסגירת שורה");
        return;
      }
      setDetails((prev) => prev.map((d) => (d.id === detailId ? { ...d, status: "סגירה" } : d)));
    } catch {
      setCloseError("שגיאת תקשורת");
    } finally {
      setClosingId(null);
    }
  }

  // Spec page 23: "לחיצה על כפתור עריכה מסירה את הסימון של הרשומה כ'סגורה זמנית'
  // ומחזיר אותה לחלק השני לעריכת עדכונים או מחיקה" — reopen a closed row back to draft.
  async function reopenRow(detailId: string) {
    setCloseError(null);
    setClosingId(detailId);
    try {
      const res = await fetch(`/api/transfers/${header.id}/details/${detailId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "טיוטא" }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCloseError(data.error ?? "שגיאה בפתיחת שורה לעריכה");
        return;
      }
      setDetails((prev) => prev.map((d) => (d.id === detailId ? { ...d, status: "טיוטא" } : d)));
    } catch {
      setCloseError("שגיאת תקשורת");
    } finally {
      setClosingId(null);
    }
  }

  // הערות חופשיות על אירוע התמותה — header-level notes, mortality only (spec page 19)
  async function saveHeaderNotes() {
    setNotesSaving(true);
    setNotesFeedback(null);
    try {
      const res = await fetch(`/api/transfers/${header.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: headerNotes }),
      });
      setNotesFeedback(res.ok ? "ההערות נשמרו ✓" : "שגיאה בשמירת ההערות — נסה שנית");
    } catch {
      setNotesFeedback("שגיאת תקשורת — ההערות לא נשמרו");
    } finally {
      setNotesSaving(false);
    }
  }

  // "שמור כטיוטה" — per spec, saving as draft is also a commit point for staged
  // deletions ("מחיקת שורות... יתבצע רק בעת שמירת ההעברה (או שמירת טיוטא)").
  async function handleSaveDraft() {
    const ok = await flushStagedDeletes();
    if (!ok) return;
    router.push("/transfers");
  }

  async function handleFinalize() {
    setFinalizeError(null);
    const ok = await flushStagedDeletes();
    if (!ok) return;
    if (draftRows.length > 0) {
      setFinalizeError("לא ניתן לסכם — יש שורות פתוחות. סגור תחילה את כל הטנקים.");
      return;
    }
    // Gap #8: open custom confirm overlay instead of browser confirm()
    setFinalizeConfirmOpen(true);
  }

  async function commitFinalize() {
    setFinalizeConfirmOpen(false);
    setFinalizeSaving(true);
    try {
      const res = await fetch(`/api/transfers/${header.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "הסתיימה" }),
      });
      if (!res.ok) {
        const data = await res.json();
        setFinalizeError(data.error ?? "שגיאה בעדכון סטטוס");
        return;
      }
      setHeaderStatus("הסתיימה");
      router.push("/transfers");
    } catch {
      setFinalizeError("שגיאת תקשורת");
    } finally {
      setFinalizeSaving(false);
    }
  }

  // Opens the weighing popup for this row, in place — per the spec ("רצוי שיהיה חלון קופץ
  // מעל למסך ההעברות ולא מסך נפרד") and Dean's confirmation (2026-06-25). Same ⚖️ icon as
  // before; previously this navigated to a dedicated screen, now it opens WeighingModal
  // directly over this screen with no navigation.
  function goToWeighingScreen(detail: Detail) {
    setWeighingDetailId(detail.id);
  }

  // Called when WeighingModal closes. If a weighing was actually saved, update this row's
  // avgWeightGrams locally so the table reflects it immediately (the modal already PATCHed
  // the server); a plain cancel passes undefined and nothing changes.
  function handleWeighingClose(detailId: string, savedAvgWeightGrams?: number | null) {
    setWeighingDetailId(null);
    if (savedAvgWeightGrams === undefined) return;
    setDetails((prev) =>
      prev.map((d) =>
        d.id === detailId
          ? {
              ...d,
              avgWeightGrams: savedAvgWeightGrams,
              weighings: savedAvgWeightGrams !== null ? [{ id: d.weighings[0]?.id ?? "tmp", date: new Date().toISOString() }] : [],
            }
          : d
      )
    );
    // Reload from the server to pick up the authoritative weighing id/count for the row's
    // "⚖️ שקילה (N)" label — the local patch above is just an optimistic placeholder.
    reloadDetails();
  }

  // --- החלפת דגים dialog handlers ---

  // "ביטול" — close dialog, clear the strain selection, let user pick again.
  function handleSwitchCancel() {
    setSwitchDialogOpen(false);
    setPendingSwitchStrainId(null);
    setSwitchReplacementStrainId("");
    setSwitchError(null);
    setFishStrainId("");
  }

  // "בצע בכל זאת" — proceed with the strain the user picked even though
  // it's not on the roster. Per spec: add a note to the row's notes field
  // indicating the strain is not on the pond register (spec p.42:
  // "להוסיף בשדה ההערה דיוח על פעולה שנעשתה על דגים שלפי הרישום אינם נמצאים").
  async function handleSwitchProceedAnyway() {
    setSwitchDialogOpen(false);
    // The strain is already set in fishStrainId; just append the warning note.
    const strainObj = fishStrains.find((s) => s.id === pendingSwitchStrainId);
    const strainName = strainObj ? strainLabel(strainObj) : "סוג דג לא ידוע";
    const warningNote = `⚠️ ${strainName} אינו נמצא ברישום הבריכה לפי הרישום הקיים`;
    // Prepend to existing row notes
    setRowNotes((prev) => prev ? `${warningNote} | ${prev}` : warningNote);
    setPendingSwitchStrainId(null);
    setSwitchError(null);
    // The form is now ready; user will click the normal submit button.
  }

  // "החלפת דג" — user picked a replacement strain from the roster.
  // 1. Submit the detail row with the NEW (replacement) strain.
  // 2. Then call POST /api/fish-switching to record the switch.
  async function handleSwitchAndSave(e: React.FormEvent) {
    e.preventDefault();
    if (!switchReplacementStrainId) {
      setSwitchError("יש לבחור דג חלופי מהרשימה");
      return;
    }
    setSwitchSaving(true);
    setSwitchError(null);
    const fromStrainId = pendingSwitchStrainId!;
    // Use the replacement strain for the actual transfer row
    setFishStrainId(switchReplacementStrainId);
    setSwitchDialogOpen(false);
    // Build the body for the detail POST with the replacement strain
    const effectivePop =
      isShiuukType && shiuukPopCode ? shiuukPopCode.id : populationCodeId || undefined;
    const body: Record<string, unknown> = {
      fishStrainId: switchReplacementStrainId,
      destPondId: isMortality ? virtualPondId : destPondId,
      transferTime: transferTime || undefined,
      notes: rowNotes || undefined,
    };
    if (!isMortality) {
      if (effectivePop) body.populationCodeId = effectivePop;
      if (meansType) {
        body.meansType = meansType;
        if (meansType === "פנימי" && internalTankId) body.internalTankId = internalTankId;
        if (meansType === "חיצוני" && externalVehicleCode)
          body.externalVehicleCode = externalVehicleCode;
      }
    }
    if (isWeighable) {
      if (totalWeightKg) body.totalWeightKg = parseFloat(totalWeightKg);
    } else {
      if (fishCount) body.fishCount = parseInt(fishCount, 10);
      if (avgWeightGrams) body.avgWeightGrams = parseFloat(avgWeightGrams) * 1000;
    }
    try {
      // Step 1: create the detail row
      const detailRes = await fetch(`/api/transfers/${header.id}/details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!detailRes.ok) {
        const data = await detailRes.json();
        setSwitchError(data.error ?? "שגיאה בשמירת שורת ההעברה");
        setSwitchSaving(false);
        setSwitchDialogOpen(true);
        return;
      }
      const detailData = await detailRes.json();
      // Step 2: record the fish switch
      const switchRes = await fetch("/api/fish-switching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transferDetailId: detailData.id,
          fromStrainId,
          toStrainId: switchReplacementStrainId,
        }),
      });
      if (!switchRes.ok) {
        // Non-fatal: the detail row was saved, log the issue but don't roll back
        console.error("fish-switching record failed:", await switchRes.json());
      }
      // Success: reload and reset form
      await reloadDetails();
      resetForm();
      setAddOpen(false);
      setPendingSwitchStrainId(null);
    } catch {
      setSwitchError("שגיאת תקשורת");
      setSwitchSaving(false);
      setSwitchDialogOpen(true);
    } finally {
      setSwitchSaving(false);
    }
  }

  // --- תמותה staged rows (item #8, spec page 19) ---

  function parseMortalityCause(notes: string | null): { cause: string; other: string } {
    if (!notes) return { cause: "", other: "" };
    if (notes.startsWith("אחר: ")) return { cause: "אחר", other: notes.slice(5) };
    if (MORTALITY_CAUSES.includes(notes)) return { cause: notes, other: "" };
    // Unrecognized free text (e.g. from before this cause-list existed) — treat as
    // "אחר" with the original text preserved rather than silently dropping it.
    return { cause: "אחר", other: notes };
  }

  function detailToMortalityRow(d: Detail): MortalityRow {
    const { cause, other } = parseMortalityCause(d.notes);
    return {
      localId: d.id,
      isNew: false,
      isLocked: true,
      markedForDelete: false,
      fishStrainId: d.fishStrainId,
      fishCountInput: d.fishCount != null ? String(d.fishCount) : "",
      avgWeightKgInput: d.avgWeightGrams != null ? String(d.avgWeightGrams / 1000) : "",
      transferTime: d.transferTime ? d.transferTime.slice(0, 16) : nowLocal(),
      mortalityCause: cause,
      otherNotes: other,
    };
  }

  const mortalityIdCounter = useRef(0);
  function newMortalityRow(): MortalityRow {
    mortalityIdCounter.current += 1;
    return {
      localId: `new-${mortalityIdCounter.current}`,
      isNew: true,
      isLocked: false,
      markedForDelete: false,
      fishStrainId: "",
      fishCountInput: "",
      avgWeightKgInput: "",
      transferTime: nowLocal(),
      mortalityCause: "",
      otherNotes: "",
    };
  }

  // Spec page 19: "אם מזינים פרטי בריכה ותאריך שכבר דווח בהם על תמותה - כל פרטי הדיווח
  // הקודם מאותו יום יוצגו במסך במצב לא זמין לעריכה. אם זה הדיווח הראשון ביום תוצג בחלק
  // השני רק שורה ריקה מוכנה לדיווח." — existing rows load locked; a header with no rows
  // yet (first report of the day) starts with one empty editable row.
  const [mortalityRows, setMortalityRows] = useState<MortalityRow[]>(() =>
    isMortality
      ? initialDetails.length > 0
        ? initialDetails.map(detailToMortalityRow)
        : [newMortalityRow()]
      : []
  );
  const [mortalitySaving, setMortalitySaving] = useState(false);
  const [mortalitySaveError, setMortalitySaveError] = useState<string | null>(null);

  function addMortalityRow() {
    setMortalityRows((prev) => [...prev, newMortalityRow()]);
  }

  function updateMortalityRow(localId: string, patch: Partial<MortalityRow>) {
    setMortalityRows((prev) => prev.map((r) => (r.localId === localId ? { ...r, ...patch } : r)));
  }

  function unlockMortalityRow(localId: string) {
    updateMortalityRow(localId, { isLocked: false });
  }

  // מחק (spec): a brand-new unsaved row is simply removed — there's nothing on the
  // server to protect. An existing row is only *staged* for deletion; the actual
  // DELETE happens at שמירה, inside the rollback transaction.
  function stageDeleteMortalityRow(localId: string) {
    setMortalityRows((prev) => {
      const row = prev.find((r) => r.localId === localId);
      if (row?.isNew) return prev.filter((r) => r.localId !== localId);
      return prev.map((r) => (r.localId === localId ? { ...r, markedForDelete: true } : r));
    });
  }

  function undoDeleteMortalityRow(localId: string) {
    updateMortalityRow(localId, { markedForDelete: false });
  }

  const liveMortalityRows = mortalityRows.filter((r) => !r.markedForDelete);
  const mortalityFishCount = liveMortalityRows.reduce(
    (sum, r) => sum + (parseInt(r.fishCountInput, 10) || 0),
    0
  );
  const mortalityTotalWeightKg = liveMortalityRows.reduce((sum, r) => {
    const count = parseInt(r.fishCountInput, 10) || 0;
    const avgKg = parseFloat(r.avgWeightKgInput) || 0;
    return sum + count * avgKg;
  }, 0);

  function mortalityRowToPayload(row: MortalityRow) {
    const notes = row.mortalityCause === "אחר" ? `אחר: ${row.otherNotes}`.trim() : row.mortalityCause;
    return {
      fishStrainId: row.fishStrainId,
      destPondId: virtualPondId as string,
      fishCount: parseInt(row.fishCountInput, 10),
      avgWeightGrams: parseFloat(row.avgWeightKgInput) * 1000,
      transferTime: row.transferTime,
      notes,
    };
  }

  async function saveMortalityBatch() {
    setMortalitySaveError(null);

    // Spec: don't allow saving with missing fields on any row — point at the problem
    // instead of silently dropping a row or guessing at its values.
    for (const row of liveMortalityRows) {
      if (
        !row.fishStrainId ||
        !row.fishCountInput ||
        !row.avgWeightKgInput ||
        !row.mortalityCause ||
        !row.transferTime
      ) {
        setMortalitySaveError("יש למלא את כל השדות בכל השורות (או למחוק שורה חסרה) לפני שמירה");
        return;
      }
      if (row.mortalityCause === "אחר" && !row.otherNotes.trim()) {
        setMortalitySaveError('יש לפרט את סיבת התמותה כאשר נבחר "אחר"');
        return;
      }
      if ((parseInt(row.fishCountInput, 10) || 0) <= 0 || (parseFloat(row.avgWeightKgInput) || 0) <= 0) {
        setMortalitySaveError("מספר דגים ומשקל ממוצע חייבים להיות גדולים מאפס");
        return;
      }
    }
    if (!virtualPondId) {
      setMortalitySaveError("לא נמצאה בריכה וירטואלית לקליטת תמותה. פנה למנהל המערכת.");
      return;
    }

    const creates = mortalityRows.filter((r) => r.isNew && !r.markedForDelete).map(mortalityRowToPayload);
    const updates = mortalityRows
      .filter((r) => !r.isNew && !r.markedForDelete)
      .map((r) => ({ id: r.localId, ...mortalityRowToPayload(r) }));
    const deleteIds = mortalityRows.filter((r) => !r.isNew && r.markedForDelete).map((r) => r.localId);

    if (creates.length === 0 && updates.length === 0 && deleteIds.length === 0) {
      setMortalitySaveError("אין שינויים לשמור");
      return;
    }

    setMortalitySaving(true);
    try {
      const res = await fetch(`/api/transfers/${header.id}/details/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creates, updates, deleteIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMortalitySaveError(data.error ?? "שגיאה בשמירת הדיווח");
        return;
      }
      const reloadRes = await fetch(`/api/transfers/${header.id}/details`);
      if (reloadRes.ok) {
        const fresh: Detail[] = await reloadRes.json();
        setDetails(fresh);
        // Re-lock everything — a freshly-saved row is now "previously reported" per spec.
        setMortalityRows(fresh.length > 0 ? fresh.map(detailToMortalityRow) : [newMortalityRow()]);
      }
    } catch {
      setMortalitySaveError("שגיאת תקשורת");
    } finally {
      setMortalitySaving(false);
    }
  }

  // Computed display values per row based on transfer type
  function rowFishCountDisplay(d: Detail): string {
    if (isWeighable) {
      if (!d.totalWeightKg || !d.avgWeightGrams) return "—";
      return String(Math.round((d.totalWeightKg * 1000) / d.avgWeightGrams));
    }
    return d.fishCount != null ? String(d.fishCount) : "—";
  }

  function rowAvgWeightDisplay(d: Detail): string {
    if (!d.avgWeightGrams) return isWeighable ? "טרם נשקל" : "—";
    return `${(d.avgWeightGrams / 1000).toFixed(3)} ק"ג`;
  }

  function rowTotalWeightDisplay(d: Detail): string {
    if (isWeighable) {
      return d.totalWeightKg != null ? `${d.totalWeightKg.toFixed(1)} ק"ג` : "—";
    }
    // קניה: computed from fishCount × avgWeightGrams
    if (!d.fishCount || !d.avgWeightGrams) return "—";
    return `${((d.fishCount * d.avgWeightGrams) / 1000).toFixed(1)} ק"ג`;
  }

  // Column SET + ORDER per transfer type — matches the prototype's tfRenderHeader()
  // exactly (2026-06-29 weighing/transfers UI audit), which differs from the previous
  // ad-hoc order this component used (e.g. אמצעי העברה/מספר רכב now lead the row for
  // קניה/דילול/פירוק/שיווק, and average-weight is placed before count, not after).
  // Header/row stay in lockstep automatically since both are derived from this list.
  type ColumnDef = {
    key: string;
    label: string;
    className?: string;
    render: (d: Detail, forClosed?: boolean) => React.ReactNode;
  };

  function getColumns(): ColumnDef[] {
    const transferMeansCol: ColumnDef = {
      key: "means",
      label: "אמצעי העברה",
      className: "px-3 py-3 text-sm text-gray-500",
      render: (d, forClosed) => {
        if (editingMeansId === d.id) {
          return (
            <select
              value={editMeansType}
              onChange={(e) => setEditMeansType(e.target.value as "פנימי" | "חיצוני" | "")}
              className="border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
              autoFocus
            >
              <option value="">— ללא —</option>
              <option value="פנימי">פנימי</option>
              <option value="חיצוני">חיצוני</option>
            </select>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5">
            {d.transferMeans?.meansType ?? "—"}
            {/* Closed rows (חלק ג') are fully read-only — the only way to change anything
                on them is "עריכה" (reopen to טיוטא, spec page 23), not an inline edit
                while still marked closed. Per Dean (2026-06-29): no editing of any kind,
                including this, while a row is in the closed section. */}
            {!forClosed && canEdit && !isFinished && (
              <button
                onClick={() => startEditMeans(d)}
                className="text-gray-400 hover:text-brand-600 text-[11px] underline"
                title="עדכון אמצעי העברה"
              >
                ערוך
              </button>
            )}
          </span>
        );
      },
    };

    const vehicleCol: ColumnDef = {
      key: "vehicle",
      label: "מספר רכב",
      className: "px-3 py-3 text-sm text-gray-500 font-mono text-xs",
      render: (d) => {
        if (editingMeansId === d.id) {
          return (
            <div className="flex items-center gap-1.5">
              {editMeansType === "פנימי" && (
                <select
                  value={editInternalTankId}
                  onChange={(e) => setEditInternalTankId(e.target.value)}
                  className="border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">— בחר טנק —</option>
                  {tanks.map((t) => <option key={t.id} value={t.id}>{t.code}</option>)}
                </select>
              )}
              {editMeansType === "חיצוני" && (
                <input
                  type="text"
                  value={editExternalVehicleCode}
                  onChange={(e) => setEditExternalVehicleCode(e.target.value)}
                  placeholder="מזהה רכב"
                  className="border border-gray-300 rounded px-1.5 py-1 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              )}
              <button
                onClick={() => saveEditMeans(d.id)}
                disabled={editMeansSaving}
                className="text-brand-600 hover:text-brand-700 text-[11px] font-medium disabled:opacity-50"
              >
                {editMeansSaving ? "שומר..." : "שמור"}
              </button>
              <button
                onClick={cancelEditMeans}
                disabled={editMeansSaving}
                className="text-gray-400 hover:text-gray-600 text-[11px]"
              >
                ביטול
              </button>
              {editMeansError && <span className="text-red-500 text-[11px]">{editMeansError}</span>}
            </div>
          );
        }
        return tankLabel(d.transferMeans, tanks);
      },
    };

    const fishCol: ColumnDef = {
      key: "fish",
      label: "סוג דג",
      className: "px-3 py-3 text-sm text-gray-700",
      render: (d) => strainLabel(d.fishStrain),
    };

    const avgCol: ColumnDef = {
      key: "avg",
      label: "משקל ממוצע",
      className: "px-3 py-3 text-sm",
      render: (d) => (
        <span className={!d.avgWeightGrams && isWeighable ? "text-amber-500 italic" : "text-gray-600"}>
          {rowAvgWeightDisplay(d)}
        </span>
      ),
    };

    const countCol: ColumnDef = {
      key: "count",
      label: "מספר דגים",
      className: "px-3 py-3 text-sm text-gray-600",
      render: (d) => rowFishCountDisplay(d),
    };

    const totalCol: ColumnDef = {
      key: "total",
      label: "משקל כולל",
      className: "px-3 py-3 text-sm font-medium text-gray-900",
      render: (d) => rowTotalWeightDisplay(d),
    };

    const timeCol: ColumnDef = {
      key: "time",
      // Mortality uses "שעת ההתרחשות" (time of occurrence) instead of "שעת ההעברה"
      // (transfer time) — there's no transfer for fish that died (spec page 19).
      label: isMortality ? "שעת הוצאה" : "שעת ההעברה",
      className: "px-3 py-3 text-sm text-gray-500",
      render: (d) =>
        d.transferTime
          ? (() => { const _t = new Date(d.transferTime); return `${String(_t.getHours()).padStart(2,"0")}:${String(_t.getMinutes()).padStart(2,"0")}`; })()
          : "—",
    };

    const destPondCol: ColumnDef = {
      key: "destPond",
      label: "בריכת יעד",
      className: "px-3 py-3 text-sm",
      render: (d) => d.destPond.name,
    };

    const stageCol: ColumnDef = {
      key: "stage",
      label: "שלב באיכלוס",
      className: "px-3 py-3 text-sm text-gray-500",
      render: (d) => d.populationCode?.code ?? "—",
    };

    const causeCol: ColumnDef = {
      key: "cause",
      label: "סיבת תמותה",
      className: "px-3 py-3 text-sm text-gray-500",
      render: (d) => d.notes ?? "—",
    };

    if (isMortality) {
      return [fishCol, avgCol, countCol, totalCol, timeCol, causeCol];
    }
    if (header.transferType === "קניה") {
      return [transferMeansCol, vehicleCol, fishCol, avgCol, countCol, totalCol, timeCol, destPondCol, stageCol];
    }
    // דילול / פירוק / שיווק — average before TOTAL before count (prototype order differs
    // from קניה's average/count/total).
    return [transferMeansCol, vehicleCol, fishCol, avgCol, totalCol, countCol, timeCol, destPondCol, stageCol];
  }

  // Closed rows section uses shortened column headers with green styling (prototype).
  // Open rows table uses the same full column list but normal gray headers.
  const CLOSED_COLS_LABELS: Record<string, string> = {
    means: "אמצעי",
    vehicle: "רכב",
    fish: "דג",
    avg: "ממוצע (גר')",
    total: 'משקל (ק"ג)',
    count: "כמות",
    time: "שעה",
    destPond: "בריכת יעד",
    stage: "שלב",
    cause: "סיבה",
  };

  function TableHead({ forClosed }: { forClosed?: boolean }) {
    const cols = getColumns();
    if (forClosed) {
      // Green-tinted header matching prototype #e8fdf4 / #065f46 / #bbf7d0
      return (
        <thead>
          <tr style={{ background: "#e8fdf4", borderBottom: "2px solid #bbf7d0" }}>
            {cols.map((c) => (
              <th
                key={c.key}
                style={{ padding: "8px 8px", fontWeight: 700, color: "#065f46", whiteSpace: "nowrap", textAlign: "right", fontSize: "11px" }}
              >
                {CLOSED_COLS_LABELS[c.key] ?? c.label}
              </th>
            ))}
            {isWeighable && (
              <th style={{ padding: "8px 8px", fontWeight: 700, color: "#065f46", whiteSpace: "nowrap", fontSize: "11px" }}>שקילה</th>
            )}
            {canEdit && !isFinished && (
              <th style={{ padding: "8px 6px", fontWeight: 700, color: "#065f46", textAlign: "center", fontSize: "11px" }}>✎</th>
            )}
          </tr>
        </thead>
      );
    }
    return (
      <thead>
        <tr style={{ background: "#12243d", color: "white" }}>
          {cols.map((c) => (
            <th key={c.key} style={{ padding: "9px 10px", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap", fontSize: 11, letterSpacing: "0.3px" }}>{c.label}</th>
          ))}
          {isWeighable && (
            <th style={{ padding: "9px 10px", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap", fontSize: 11 }}>שקילת סלים</th>
          )}
          {canEdit && <th style={{ padding: "9px 6px" }} colSpan={2} />}
        </tr>
      </thead>
    );
  }

  function TableRow({ d, forClosed }: { d: Detail; forClosed?: boolean }) {
    const cols = getColumns();
    // Prototype: open rows #fafeff, closed rows plain white on green bg table
    const rowBg = forClosed ? "white" : (isMortality ? "#fff5f5" : "#fafeff");
    return (
      <tr style={{ background: rowBg }} className={forClosed ? "hover:bg-green-50/30" : "hover:bg-gray-50"}>
        {cols.map((c) => (
          <td key={c.key} className={c.className ?? "px-3 py-3 text-sm text-gray-700"}>
            {c.render(d, forClosed)}
          </td>
        ))}
        {isWeighable && (
          <td className="px-3 py-3">
            {d.weighings.length > 0 && forClosed ? (
              // Closed rows (חלק ג') are fully read-only — per Dean (2026-06-29), no editing
              // of any kind while a row is closed, including opening WeighingModal to view/edit
              // baskets. Reopen via "עריכה" first if changes are needed.
              <span
                title="הטנק סגור — לא ניתן לערוך שקילה. יש לפתוח מחדש את הרשומה לעריכה."
                className="text-gray-500 text-xs font-medium inline-flex items-center gap-1"
              >
                ⚖️ שקילה ({d.weighings.length})
              </span>
            ) : d.weighings.length > 0 ? (
              <button
                onClick={() => goToWeighingScreen(d)}
                title="שקילת סלי טנק"
                className="text-brand-600 hover:text-brand-700 text-xs font-medium inline-flex items-center gap-1"
              >
                ⚖️ שקילה ({d.weighings.length})
              </button>
            ) : canEdit && !forClosed ? (
              <button
                onClick={() => goToWeighingScreen(d)}
                title="שקילת סלי טנק"
                className="text-gray-400 hover:text-brand-600 text-xs inline-flex items-center gap-1"
              >
                ⚖️ שקול
              </button>
            ) : (
              <span className="text-gray-300 text-xs">—</span>
            )}
          </td>
        )}
        {!forClosed && canEdit && (
          <>
            <td className="px-2 py-3">
              <button
                onClick={() => closeRow(d.id)}
                disabled={closingId === d.id || !canCloseRow(d)}
                title={!canCloseRow(d) ? "יש למלא את כל השדות הנדרשים לפני סגירה" : undefined}
                style={{ background: "#059669" }}
                className={BTN_BLUE}
              >
                {/* Mortality rows use "סגירת רשומה" (close record) instead of "סגירת טנק"
                    (close tank) — there's no tank involved in a mortality report, matching
                    the prototype's tfRenderHeader() column label for תמותה. */}
                {closingId === d.id ? "סוגר..." : isMortality ? "סגירת רשומה" : "סגירת טנק"}
              </button>
            </td>
            <td className="px-2 py-3">
              <button onClick={() => deleteDetail(d.id)} className="text-red-400 hover:text-red-600 text-xs px-1">
                מחק
              </button>
            </td>
          </>
        )}
        {forClosed && canEdit && !isFinished && (
          <td className="px-2 py-3 text-center">
            {/* Prototype: pencil SVG icon only, green border (#6ee7b7), no text */}
            <button
              onClick={() => reopenRow(d.id)}
              disabled={closingId === d.id}
              title="עריכה — פתח שורה לעריכה"
              style={{ background: "none", border: "1.5px solid #6ee7b7", borderRadius: 6, padding: "4px 7px", cursor: "pointer", color: "#059669", display: "inline-flex", alignItems: "center" }}
            >
              {closingId === d.id ? (
                <span className="text-xs">...</span>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              )}
            </button>
          </td>
        )}
      </tr>
    );
  }

  // תמותה gets its own dedicated render — fully staged-save model per spec page 19
  // (Dean approved "build fully per spec" 2026-06-29, item #8). This intentionally
  // bypasses the shared add-form/draft-rows/closed-rows JSX below: that model (immediate
  // POST/PATCH/DELETE per action, separate "open tanks"/"closed tanks" sections) doesn't
  // match the spec for this screen — there is no per-row close button for תמותה (the
  // "סגירת רשומה" label added in task #175 to match the prototype's column header
  // contradicts the spec text here, which describes lock/ערוך/מחק/שמור instead of a
  // close action — flagged to Dean, the shared code below still contains that now-dead
  // branch since it never executes for isMortality, kept only to avoid touching the
  // other transfer types' working code).
  if (isMortality) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          {/* Summary bar — prototype .tf-summary-bar / .tf-sum-cell / .tf-sum-lbl / .tf-sum-val */}
          <div className="tf-summary-bar" style={{ borderRadius: 8 }}>
            <div className="tf-sum-cell">
              <div className="tf-sum-lbl">דגים מתים</div>
              <div className="tf-sum-val">{mortalityFishCount}</div>
            </div>
            <div className="tf-sum-cell">
              <div className="tf-sum-lbl">סה&quot;כ ק&quot;ג</div>
              <div className="tf-sum-val">{mortalityTotalWeightKg.toFixed(1)}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                isFinished ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              {isFinished ? "הסתיימה" : "טיוטה"}
            </span>
            {!isFinished && canEdit && (
              <button onClick={saveMortalityBatch} disabled={mortalitySaving} className={`${BTN} mr-auto`}>
                {mortalitySaving ? "שומר..." : "שמור"}
              </button>
            )}
          </div>
          {mortalitySaveError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{mortalitySaveError}</p>
          )}
        </div>

        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                פירוט תמותת דגים בבריכה ({liveMortalityRows.length})
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {header.transferType} · {header.transferType === "קניה" && header.supplierName ? `ספק: ${header.supplierName}` : header.sourcePondName} ·{" "}
                {new Date(header.transferDate).toLocaleDateString("he-IL")} · מחזור{" "}
                <span className="font-mono">{header.cycleCode}</span>
              </p>
            </div>
            {!isFinished && canEdit && (
              <button onClick={addMortalityRow} className={BTN}>
                + הוסף שורה
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#12243d", color: "white" }}>
                  <th style={{ padding: "9px 10px", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap", fontSize: 11 }}>סוג דג</th>
                  <th style={{ padding: "9px 10px", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap", fontSize: 11 }}>{'משקל ממוצע (גרם)'}</th>
                  <th style={{ padding: "9px 10px", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap", fontSize: 11 }}>מספר דגים</th>
                  <th style={{ padding: "9px 10px", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap", fontSize: 11 }}>{'משקל כולל (ק"ג)'}</th>
                  <th style={{ padding: "9px 10px", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap", fontSize: 11 }}>שעת ההתרחשות</th>
                  <th style={{ padding: "9px 10px", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap", fontSize: 11 }}>סיבת תמותה</th>
                  {canEdit && !isFinished && <th style={{ padding: "9px 6px" }} colSpan={2} />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mortalityRows.map((row) => {
                  const count = parseInt(row.fishCountInput, 10) || 0;
                  const avgKg = parseFloat(row.avgWeightKgInput) || 0;
                  const totalKg = count * avgKg;
                  const strain = fishStrains.find((s) => s.id === row.fishStrainId);

                  if (row.markedForDelete) {
                    return (
                      <tr key={row.localId} className="bg-red-50/40 text-gray-400">
                        <td className="px-3 py-3 text-sm line-through" colSpan={6}>
                          {strain ? strainLabel(strain) : "שורה"} — מסומנת למחיקה (תימחק בשמירה)
                        </td>
                        {canEdit && !isFinished && (
                          <td className="px-2 py-3" colSpan={2}>
                            <button
                              onClick={() => undoDeleteMortalityRow(row.localId)}
                              className="text-brand-600 hover:text-brand-700 text-xs underline"
                            >
                              בטל מחיקה
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  }

                  if (row.isLocked) {
                    return (
                      <tr key={row.localId} className="hover:bg-gray-50">
                        <td className="px-3 py-3 text-sm text-gray-700">{strain ? strainLabel(strain) : "—"}</td>
                        <td className="px-3 py-3 text-sm text-gray-600">{avgKg ? `${avgKg.toFixed(3)} ק"ג` : "—"}</td>
                        <td className="px-3 py-3 text-sm text-gray-600">{count || "—"}</td>
                        <td className="px-3 py-3 text-sm font-medium text-gray-900">
                          {totalKg ? `${totalKg.toFixed(1)} ק"ג` : "—"}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-500">
                          {row.transferTime
                            ? (() => { const _t = new Date(row.transferTime); return `${String(_t.getHours()).padStart(2,"0")}:${String(_t.getMinutes()).padStart(2,"0")}`; })()
                            : "—"}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-500">
                          {row.mortalityCause === "אחר" ? `אחר: ${row.otherNotes}` : row.mortalityCause || "—"}
                        </td>
                        {canEdit && !isFinished && (
                          <>
                            <td className="px-2 py-3">
                              <button onClick={() => unlockMortalityRow(row.localId)} style={{ background: "#2271B2" }} className={BTN_BLUE}>
                                ערוך
                              </button>
                            </td>
                            <td className="px-2 py-3">
                              <button
                                onClick={() => stageDeleteMortalityRow(row.localId)}
                                className="text-red-400 hover:text-red-600 text-xs px-1"
                              >
                                מחק
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  }

                  // Unlocked: editable inputs (a brand-new row, or a previously-locked row
                  // after pressing ערוך)
                  return (
                    <tr key={row.localId} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <select
                          value={row.fishStrainId}
                          onChange={(e) => updateMortalityRow(row.localId, { fishStrainId: e.target.value })}
                          disabled={isFinished || !canEdit}
                          className={INPUT}
                        >
                          <option value="">— בחר זן —</option>
                          {fishStrains.map((s) => (
                            <option key={s.id} value={s.id}>
                              {strainLabel(s)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={row.avgWeightKgInput}
                          onChange={(e) => updateMortalityRow(row.localId, { avgWeightKgInput: e.target.value })}
                          disabled={isFinished || !canEdit}
                          className={INPUT}
                          placeholder="0.000"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="1"
                          value={row.fishCountInput}
                          onChange={(e) => updateMortalityRow(row.localId, { fishCountInput: e.target.value })}
                          disabled={isFinished || !canEdit}
                          className={INPUT}
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-3 text-sm font-medium text-gray-900">
                        {totalKg ? `${totalKg.toFixed(1)} ק"ג` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div style={{ display:"flex", gap:3 }}>
                          <input
                            type="date"
                            value={row.transferTime.slice(0,10)}
                            onChange={(e) => updateMortalityRow(row.localId, { transferTime: `${e.target.value}T${row.transferTime.slice(11,16)||"00:00"}` })}
                            disabled={isFinished || !canEdit}
                            className={INPUT}
                            style={{ flex:1 }}
                          />
                          <input
                            type="text"
                            value={row.transferTime.slice(11,16)}
                            onChange={(e) => updateMortalityRow(row.localId, { transferTime: `${row.transferTime.slice(0,10)}T${e.target.value}` })}
                            placeholder="HH:mm"
                            maxLength={5}
                            disabled={isFinished || !canEdit}
                            className={INPUT}
                            style={{ width:68 }}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 space-y-1">
                        <select
                          value={row.mortalityCause}
                          onChange={(e) => updateMortalityRow(row.localId, { mortalityCause: e.target.value })}
                          disabled={isFinished || !canEdit}
                          className={INPUT}
                        >
                          <option value="">— בחר סיבה —</option>
                          {MORTALITY_CAUSES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        {row.mortalityCause === "אחר" && (
                          <input
                            type="text"
                            value={row.otherNotes}
                            onChange={(e) => updateMortalityRow(row.localId, { otherNotes: e.target.value })}
                            disabled={isFinished || !canEdit}
                            className={INPUT}
                            placeholder="פירוט..."
                          />
                        )}
                      </td>
                      {canEdit && !isFinished && (
                        <>
                          <td className="px-2 py-3">
                            <button disabled style={{ background: "#2271B2" }} className={`${BTN_BLUE} opacity-40 cursor-not-allowed`}>
                              ערוך
                            </button>
                          </td>
                          <td className="px-2 py-3">
                            <button
                              onClick={() => stageDeleteMortalityRow(row.localId)}
                              className="text-red-400 hover:text-red-600 text-xs px-1"
                            >
                              מחק
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* הערות חופשיות על אירוע התמותה — header-level notes (unchanged, immediate save) */}
        <section className="border-t border-gray-200 pt-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">הערות חופשיות על אירוע התמותה</label>
          <textarea
            value={headerNotes}
            onChange={(e) => setHeaderNotes(e.target.value)}
            disabled={isFinished || !canEdit}
            rows={3}
            className={INPUT}
            placeholder="הוסף הערות כלליות על אירוע התמותה..."
          />
          {canEdit && !isFinished && (
            <button
              onClick={saveHeaderNotes}
              disabled={notesSaving}
              className="mt-2 text-xs text-brand-600 hover:text-brand-700 disabled:opacity-50"
            >
              {notesSaving ? "שומר..." : "שמור הערות"}
            </button>
          )}
          {notesFeedback && (
            <div className={`mt-1 text-xs ${notesFeedback.includes("✓") ? "text-green-600" : "text-red-600"}`}>
              {notesFeedback}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary bar + action buttons (Section B) */}
      <div className="space-y-2">
        {/* Summary bar — prototype .tf-summary-bar / .tf-sum-cell / .tf-sum-lbl / .tf-sum-val */}
        <div className="tf-summary-bar" style={{ borderRadius: 8 }}>
          <div className="tf-sum-cell">
            <div className="tf-sum-lbl">טנקים</div>
            <div className="tf-sum-val">{summaryTanks}</div>
          </div>
          <div className="tf-sum-cell">
            <div className="tf-sum-lbl">סה&quot;כ ק&quot;ג</div>
            <div className="tf-sum-val">{summaryWeightKg.toFixed(1)}</div>
          </div>
        </div>

        {/* Status chip + save buttons */}
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
            isFinished ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
          }`}>
            {isFinished ? "הסתיימה" : "טיוטה"}
          </span>

          {!isFinished && canEdit && (
            <div className="mr-auto flex gap-2">
              {draftRows.length > 0 ? (
                <button onClick={handleSaveDraft} disabled={flushingDeletes} className={BTN_OUTLINE}>
                  {flushingDeletes ? "שומר..." : "שמור כטיוטה"}
                </button>
              ) : (
                <button
                  onClick={handleFinalize}
                  disabled={finalizeSaving || flushingDeletes || liveDetails.length === 0}
                  className={BTN}
                >
                  {finalizeSaving ? "מסכם..." : "סכם העברה"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {finalizeError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{finalizeError}</p>
      )}
      {closeError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{closeError}</p>
      )}

      {/* ── Part B — Draft / open tank rows ── */}
      <section>
        {/* Section header — prototype: .tf-rows-section with .tf-rows-title = "➕ שקילת טנקים" (dark navy bar) */}
        <div className="tf-rows-section" style={{ marginBottom: 0, borderRadius: "14px 14px 0 0" }}>
          <div
            className="tf-rows-title"
            style={{ background: "#12243d", color: "white", borderRadius: 0, fontSize: 12, padding: "10px 16px", letterSpacing: "0.5px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>
                {"➕ שקילת טנקים"}
                <span style={{ marginRight: 8, opacity: 0.7 }}>({draftRows.length})</span>
              </div>
              {/* Item #3 (Dean, 2026-06-29): keep חלק א' context visible here too */}
              <p style={{ fontSize: 11, marginTop: 2, color: "rgba(255,255,255,0.6)", fontWeight: 400 }}>
                {header.transferType} · {header.transferType === "קניה" && header.supplierName ? `ספק: ${header.supplierName}` : header.sourcePondName} ·{" "}
                {new Date(header.transferDate).toLocaleDateString("he-IL")} · מחזור{" "}
                <span style={{ fontFamily: "monospace" }}>{header.cycleCode}</span>
              </p>
            </div>
            {!isFinished && canEdit && (
              <button
                onClick={addOpen ? () => { setAddOpen(false); resetForm(); } : openAddForm}
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", color: "white", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}
              >
                {addOpen ? "ביטול" : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    הוסף טנק
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Add-row form */}
        {addOpen && canEdit && (
          <form onSubmit={addDetail} className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Strain */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">סוג דג <span className="text-red-500">*</span></label>
                <select value={fishStrainId} onChange={(e) => setFishStrainId(e.target.value)} required className={INPUT}>
                  <option value="">— בחר זן —</option>
                  {fishStrains.map((s) => (
                    <option key={s.id} value={s.id}>{strainLabel(s)}</option>
                  ))}
                </select>
              </div>

              {/* Dest pond — תמותה auto-routes to the virtual receiving pond, no manual pick.
                  Closed ponds still appear (item #1: status visible in the search) — picking
                  one surfaces the warning below and blocks submission (item #4). */}
              {!isMortality && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">בריכת יעד <span className="text-red-500">*</span></label>
                  <PondCombobox
                    ponds={destPondOptions}
                    value={destPondId}
                    onChange={setDestPondId}
                    required
                    className={INPUT}
                    labelExtra={(p) =>
                      destPondRequiresActiveCycle && !p.hasActiveCycle ? "(ללא מחזור פעיל)" : null
                    }
                  />
                  {(() => {
                    const chosenDest = destPondOptions.find((p) => p.id === destPondId);
                    if (!chosenDest || !destPondRequiresActiveCycle || chosenDest.hasActiveCycle) return null;
                    return (
                      <p className="text-xs text-amber-600 mt-1">
                        לבריכה זו אין מחזור גידול פעיל — לא ניתן להוסיף שורה עד שיפתח מחזור
                      </p>
                    );
                  })()}
                </div>
              )}

              {/* אמצעי העברה — moved up (Dean, 2026-06-29, item #5) to appear right after
                  fish-type + dest-pond, ahead of the weight/time/population fields below.
                  Not relevant for תמותה (fish that died were never transported). */}
              {!isMortality && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">אמצעי העברה</label>
                  <select
                    value={meansType}
                    onChange={(e) => setMeansType(e.target.value as "פנימי" | "חיצוני" | "")}
                    className={INPUT}
                  >
                    <option value="">— ללא —</option>
                    <option value="פנימי">פנימי</option>
                    <option value="חיצוני">חיצוני</option>
                  </select>
                </div>
              )}

              {/* טנק פנימי / מזהה רכב — conditional on אמצעי העברה, moved up alongside it */}
              {!isMortality && meansType === "פנימי" && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">טנק פנימי</label>
                  <select value={internalTankId} onChange={(e) => setInternalTankId(e.target.value)} className={INPUT}>
                    <option value="">— בחר טנק —</option>
                    {tanks.map((t) => (
                      <option key={t.id} value={t.id}>{t.code}</option>
                    ))}
                  </select>
                </div>
              )}
              {!isMortality && meansType === "חיצוני" && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">מזהה רכב</label>
                  <input
                    type="text"
                    value={externalVehicleCode}
                    onChange={(e) => setExternalVehicleCode(e.target.value)}
                    className={INPUT}
                    placeholder="למשל: IL 123 456"
                  />
                </div>
              )}

              {/* Weight inputs — branched by transfer type */}
              {isWeighable ? (
                <>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">{'משקל כולל (ק"ג)'} <span className="text-red-500">*</span></label>
                    <input
                      type="number" step="0.1" min="0"
                      value={totalWeightKg}
                      onChange={(e) => setTotalWeightKg(e.target.value)}
                      className={INPUT} placeholder="0.0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">{'משקל ממוצע (ק"ג)'}</label>
                    <input
                      type="text" readOnly disabled
                      value="ייקבע אחרי שקילת סלים"
                      className={INPUT}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">מספר דגים</label>
                    <input
                      type="number" min="1"
                      value={fishCount}
                      onChange={(e) => setFishCount(e.target.value)}
                      className={INPUT} placeholder="0"
                    />
                  </div>
                  <div>
                    {/* avgWeightGrams state holds the user-entered value in KG; converted to
                        grams (×1000) only at submit time, since avgWeightGrams is stored in
                        grams server-side. Step/placeholder use gram-level precision (0.001). */}
                    <label className="block text-xs text-gray-600 mb-1">{'משקל ממוצע (ק"ג)'}</label>
                    <input
                      type="number" step="0.001" min="0"
                      value={avgWeightGrams}
                      onChange={(e) => setAvgWeightGrams(e.target.value)}
                      className={INPUT} placeholder="0.000"
                    />
                  </div>
                </>
              )}

              {/* Transfer time */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">שעת ההעברה</label>
                <div style={{ display:"flex", gap:4 }}>
                  <input
                    type="date"
                    value={transferTime.slice(0,10)}
                    onChange={(e) => setTransferTime(`${e.target.value}T${transferTime.slice(11,16)||"00:00"}`)}
                    className={INPUT}
                    style={{ flex:1 }}
                  />
                  <input
                    type="text"
                    value={transferTime.slice(11,16)}
                    onChange={(e) => setTransferTime(`${transferTime.slice(0,10)}T${e.target.value}`)}
                    placeholder="HH:mm"
                    maxLength={5}
                    className={INPUT}
                    style={{ width:68 }}
                  />
                </div>
              </div>

              {/* Population code / שלב באיכלוס — not relevant for תמותה */}
              {!isMortality && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">שלב באיכלוס</label>
                  <select
                    value={isShiuuk && shiuukPopCode ? shiuukPopCode.id : populationCodeId}
                    onChange={(e) => { if (!isShiuuk) setPopulationCodeId(e.target.value); }}
                    disabled={isShiuuk}
                    className={INPUT}
                  >
                    <option value="">— ללא —</option>
                    {populationCodes.map((pc) => (
                      <option key={pc.id} value={pc.id}>{pc.code}</option>
                    ))}
                  </select>
                  {isShiuuk && <p className="text-xs text-gray-400 mt-0.5">נעול אוטומטית לשיווק</p>}
                </div>
              )}

              {/* אמצעי העברה + טנק/רכב moved up next to dest-pond (item #5) — see above,
                  right after the dest-pond block. Not duplicated here. */}

              {/* Notes — תמותה: spec page 19 requires "לבחור מתוך רשימה" (select from a
                  list), not free text. "אחר" reveals a free-text follow-up. */}
              {isMortality ? (
                <div className="col-span-2 space-y-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      סיבת תמותה <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={mortalityCause}
                      onChange={(e) => setMortalityCause(e.target.value)}
                      className={INPUT}
                    >
                      <option value="">— בחר סיבה —</option>
                      {MORTALITY_CAUSES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {mortalityCause === "אחר" && (
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">פירוט</label>
                      <input
                        type="text"
                        value={rowNotes}
                        onChange={(e) => setRowNotes(e.target.value)}
                        className={INPUT}
                        placeholder="פרט את הנסיבות, תסמינים, טיפולים שניתנו..."
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="col-span-2">
                  <label className="block text-xs text-gray-600 mb-1">הערות</label>
                  <input
                    type="text"
                    value={rowNotes}
                    onChange={(e) => setRowNotes(e.target.value)}
                    className={INPUT}
                  />
                </div>
              )}
            </div>

            {/* Computed weight preview for קניה — avgWeightGrams input is now entered in KG,
                so no /1000 conversion is needed here (it was a grams-input before). */}
            {!isWeighable && fishCount && avgWeightGrams && (
              <p className="text-xs text-gray-500">
                {'משקל כולל משוער: '}
                <strong>{(parseInt(fishCount, 10) * parseFloat(avgWeightGrams)).toFixed(1)} ק&quot;ג</strong>
              </p>
            )}

            {addError && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{addError}</p>}

            <div className="flex gap-2">
              <button type="submit" disabled={addSaving} className={BTN}>
                {addSaving ? "שומר..." : "הוסף שורה"}
              </button>
              <button type="button" onClick={() => { setAddOpen(false); resetForm(); }} className={BTN_OUTLINE}>
                ביטול
              </button>
            </div>
          </form>
        )}

        {/* Draft rows table — prototype: .tf-table-wrap / .tf-table, under the dark nav header */}
        {draftRows.length > 0 ? (
          <div className="tf-table-wrap" style={{ background: "white", borderRight: "1px solid #e5e7eb", borderLeft: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb", borderRadius: "0 0 14px 14px" }}>
            <table className="tf-table">
              <TableHead />
              <tbody>
                {draftRows.map((d) => <TableRow key={d.id} d={d} />)}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 px-4 py-8 text-center" style={{ background: "white", border: "1px solid #e5e7eb", borderTop: "none", borderRadius: "0 0 14px 14px" }}>
            {isFinished ? "כל הטנקים סגורים" : "עדיין אין טנקים — לחץ \"הוסף טנק\" כדי להתחיל"}
          </p>
        )}
      </section>

      {/* ── Part C — Closed tank rows ── */}
      {closedRows.length > 0 && (
        <section>
          {/* Divider strip — exact prototype HTML: linear-gradient(135deg,#1B3A2B,#2C7A52) */}
          <div style={{ background: "linear-gradient(135deg,#1B3A2B,#2C7A52)", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ color: "white", fontSize: "11px", fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase" }}>✅ טנקים סגורים</div>
            <div style={{ background: "rgba(255,255,255,0.15)", color: "white", fontSize: "11px", fontWeight: 700, padding: "2px 10px", borderRadius: 10 }}>
              {closedRows.length} שורות
            </div>
          </div>
          {/* Closed rows table — prototype: #f0fdf4 bg, border #bbf7d0 */}
          <div style={{ background: "#f0fdf4", border: "2px solid #bbf7d0", borderTop: "none", borderRadius: "0 0 14px 14px", overflowX: "auto", minHeight: 60, marginBottom: 14 }}>
            <table className="tf-table" style={{ minWidth: 700 }}>
              <TableHead forClosed />
              <tbody>
                {closedRows.map((d) => (
                  <tr key={d.id} style={{ borderBottom: "1px solid #d1fae5" }}>
                    {getColumns().map((c) => (
                      <td key={c.key} className={c.className ?? "px-3 py-3 text-sm text-gray-700"} style={{ background: "white" }}>
                        {c.render(d, true)}
                      </td>
                    ))}
                    {isWeighable && (
                      <td className="px-3 py-3" style={{ background: "white" }}>
                        {d.weighings.length > 0 ? (
                          <span
                            title="הטנק סגור — לא ניתן לערוך שקילה. יש לפתוח מחדש את הרשומה לעריכה."
                            className="text-gray-500 text-xs font-medium inline-flex items-center gap-1"
                          >
                            ⚖️ שקילה ({d.weighings.length})
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    )}
                    {canEdit && !isFinished && (
                      <td className="px-2 py-3 text-center" style={{ background: "white" }}>
                        {/* Prototype .tf-edit-row-btn: white bg, blue border #93c5fd, pencil SVG */}
                        <button
                          onClick={() => reopenRow(d.id)}
                          disabled={closingId === d.id}
                          title="עריכה — פתח שורה לעריכה"
                          className="tf-edit-row-btn"
                        >
                          {closingId === d.id ? (
                            <span style={{ fontSize: 11 }}>...</span>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          )}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* הערות חופשיות על אירוע התמותה — mortality-only header note, spec page 19 */}
      {isMortality && (
        <section className="border-t border-gray-200 pt-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            הערות חופשיות על אירוע התמותה
          </label>
          <textarea
            value={headerNotes}
            onChange={(e) => setHeaderNotes(e.target.value)}
            disabled={isFinished || !canEdit}
            rows={3}
            className={INPUT}
            placeholder="הוסף הערות כלליות על אירוע התמותה..."
          />
          {canEdit && !isFinished && (
            <button
              onClick={saveHeaderNotes}
                         disabled={notesSaving}
              className="mt-2 text-xs text-brand-600 hover:text-brand-700 disabled:opacity-50"
            >
              {notesSaving ? "שומר..." : "שמור הערות"}
            </button>
          )}
          {notesFeedback && (
            <div className={`mt-1 text-xs ${notesFeedback.includes("✓") ? "text-green-600" : "text-red-600"}`}>
              {notesFeedback}
            </div>
          )}
        </section>
      )}

      {weighingDetailId && (
        <WeighingModal
          transferId={header.id}
          detailId={weighingDetailId}
          onClose={(savedAvg) => handleWeighingClose(weighingDetailId, savedAvg)}
        />
      )}

      {/* Finalize confirm overlay — matches prototype .tf-confirm-overlay / .tf-confirm-box.
          Slides up from the bottom (items-end), dark-navy header, teal summary bar,
          subtotal rows per destPond+fishId group (prototype tfSaveAll() grouping logic),
          grand total row in #12243d, "שמור העברה" + "חזרה לעריכה" buttons. */}
      {finalizeConfirmOpen && (() => {
        // Sort rows by destPond + fishStrain (matching prototype sort), then time
        const sorted = [...closedRows].sort((a, b) => {
          const ka = `${a.destPondId}_${a.fishStrainId}`;
          const kb = `${b.destPondId}_${b.fishStrainId}`;
          if (ka !== kb) return ka < kb ? -1 : 1;
          return (a.transferTime ?? "") < (b.transferTime ?? "") ? -1 : 1;
        });
        // Build rows + subtotal rows (green .subtotal-row per destPond+fishStrain group)
        type ConfirmRow = { type: "data"; d: (typeof sorted)[0]; avgGrams: number | null; total: number | null } | { type: "subtotal"; label: string; fishCount: number; weight: number };
        const tableRows: ConfirmRow[] = [];
        let lastGroup: string | null = null;
        let groupFish = 0, groupWeight = 0;
        sorted.forEach((d) => {
          const avgKg = d.avgWeightGrams ? d.avgWeightGrams / 1000 : null;
          const total = d.totalWeightKg ?? (d.fishCount && avgKg ? d.fishCount * avgKg : null);
          const groupKey = `${d.destPond.name} / ${strainLabel(d.fishStrain)}`;
          if (lastGroup !== null && groupKey !== lastGroup) {
            tableRows.push({ type: "subtotal", label: lastGroup, fishCount: groupFish, weight: groupWeight });
            groupFish = 0; groupWeight = 0;
          }
          lastGroup = groupKey;
          groupFish += d.fishCount ?? 0;
          groupWeight += total ?? 0;
          tableRows.push({ type: "data", d, avgGrams: d.avgWeightGrams ?? null, total });
        });
        if (lastGroup !== null) tableRows.push({ type: "subtotal", label: lastGroup, fishCount: groupFish, weight: groupWeight });
        // Grand totals
        const totalFish = closedRows.reduce((s, d) => s + (d.fishCount ?? 0), 0);
        const totalWeight = closedRows.reduce((s, d) => {
          const avgKg = d.avgWeightGrams ? d.avgWeightGrams / 1000 : 0;
          return s + (d.totalWeightKg ?? ((d.fishCount ?? 0) * avgKg));
        }, 0);
        const typeEmoji = header.transferType === "קניה" ? "🛒" : header.transferType === "דילול" ? "💧" : header.transferType === "פירוק" ? "🔓" : header.transferType === "שיווק" ? "📦" : "🔄";
        const srcLabel = header.transferType === "קניה" && header.supplierName ? `ספק: ${header.supplierName}` : header.sourcePondName;
        const dateHe = new Date(header.transferDate).toLocaleDateString("he-IL");
        return (
          <div
            className="fixed inset-0 z-[60] flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.55)" }}
            onClick={(e) => { if (e.target === e.currentTarget && !finalizeSaving) setFinalizeConfirmOpen(false); }}
          >
            <div style={{ background: "white", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 -8px 40px rgba(0,0,0,0.3)" }}>
              {/* Header */}
              <div style={{ background: "#1B3A2B", color: "white", padding: "14px 18px 12px", borderRadius: "20px 20px 0 0", position: "sticky", top: 0, zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{typeEmoji} {`סיכום העברת ${header.transferType}`}</h3>
                  <p style={{ fontSize: 12, opacity: 0.75 }}>בדוק את הנתונים לפני שמירה</p>
                </div>
                <div style={{ fontSize: 30, opacity: 0.85 }}>✅</div>
              </div>
              {/* Body */}
              <div style={{ padding: "14px 16px 0" }}>
                {/* Summary header bar — teal right border, green bg */}
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2744", marginBottom: 8, padding: "8px 10px", background: "#f0fdf4", borderRadius: 7, borderRight: "3px solid #2BAEA6" }}>
                  {`תאריך: `}<strong>{dateHe}</strong>{` | מקור: `}<strong>{srcLabel}</strong>
                </div>
                <div style={{ overflowX: "auto", marginBottom: 10 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 560 }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9" }}>
                        <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#1a2744", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", fontSize: 11 }}>אמצעי העברה</th>
                        <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#1a2744", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", fontSize: 11 }}>מספר רכב</th>
                        <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#1a2744", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", fontSize: 11 }}>סוג דג</th>
                        <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#1a2744", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", fontSize: 11 }}>משקל ממוצע (גרם)</th>
                        <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#1a2744", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", fontSize: 11 }}>מספר דגים</th>
                        <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#1a2744", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", fontSize: 11 }}>{'סה"כ משקל (ק"ג)'}</th>
                        <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#1a2744", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", fontSize: 11 }}>בריכת יעד</th>
                        <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#1a2744", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", fontSize: 11 }}>שלב באכלוס</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((row, i) => {
                        if (row.type === "subtotal") {
                          return (
                            <tr key={`sub-${i}`} style={{ background: "#f0fdf4" }}>
                              <td colSpan={4} style={{ padding: "7px 10px", fontWeight: 700, color: "#15803d", borderTop: "1.5px solid #bbf7d0", borderBottom: "1.5px solid #bbf7d0", fontSize: 11, textAlign: "right" }}>
                                {`סה"כ — ${row.label}`}
                              </td>
                              <td style={{ padding: "7px 10px", fontWeight: 700, color: "#15803d", borderTop: "1.5px solid #bbf7d0", borderBottom: "1.5px solid #bbf7d0", fontSize: 11 }}>{row.fishCount.toLocaleString("he-IL")}</td>
                              <td style={{ padding: "7px 10px", fontWeight: 700, color: "#15803d", borderTop: "1.5px solid #bbf7d0", borderBottom: "1.5px solid #bbf7d0", fontSize: 11 }}>{row.weight.toFixed(2)}</td>
                              <td colSpan={2} style={{ borderTop: "1.5px solid #bbf7d0", borderBottom: "1.5px solid #bbf7d0" }} />
                            </tr>
                          );
                        }
                        const { d, avgGrams, total } = row;
                        return (
                          <tr key={d.id}>
                            <td style={{ padding: "7px 10px", borderBottom: "1px solid #f3f4f6", fontSize: 12, whiteSpace: "nowrap" }}>{d.transferMeans?.meansType ?? "—"}</td>
                            <td style={{ padding: "7px 10px", borderBottom: "1px solid #f3f4f6", fontSize: 12, whiteSpace: "nowrap", fontFamily: "monospace" }}>{tankLabel(d.transferMeans, tanks)}</td>
                            <td style={{ padding: "7px 10px", borderBottom: "1px solid #f3f4f6", fontSize: 12, whiteSpace: "nowrap" }}>{strainLabel(d.fishStrain)}</td>
                            <td style={{ padding: "7px 10px", borderBottom: "1px solid #f3f4f6", fontSize: 12 }}>{avgGrams ?? "—"}</td>
                            <td style={{ padding: "7px 10px", borderBottom: "1px solid #f3f4f6", fontSize: 12 }}>{d.fishCount?.toLocaleString("he-IL") ?? "—"}</td>
                            <td style={{ padding: "7px 10px", borderBottom: "1px solid #f3f4f6", fontSize: 12 }}>{total ? total.toFixed(2) : "—"}</td>
                            <td style={{ padding: "7px 10px", borderBottom: "1px solid #f3f4f6", fontSize: 12, whiteSpace: "nowrap" }}>{d.destPond.name}</td>
                            <td style={{ padding: "7px 10px", borderBottom: "1px solid #f3f4f6", fontSize: 12, whiteSpace: "nowrap" }}>{d.populationCode?.code ?? "—"}</td>
                          </tr>
                        );
                      })}
                      {/* Grand total row — dark navy #12243d */}
                      <tr style={{ background: "#12243d", color: "white" }}>
                        <td colSpan={4} style={{ padding: "8px 10px", fontWeight: 700, fontSize: 12 }}>{'סה"כ כולל'}</td>
                        <td style={{ padding: "8px 10px", fontWeight: 900, fontSize: 13 }}>{totalFish.toLocaleString("he-IL")}</td>
                        <td style={{ padding: "8px 10px", fontWeight: 900, fontSize: 13 }}>{totalWeight.toFixed(2)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tbody>
                  </table>
                </div>
                {finalizeError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2 mb-3">{finalizeError}</p>
                )}
              </div>
              {/* Actions */}
              <div style={{ display: "flex", gap: 10, padding: "12px 16px 20px", position: "sticky", bottom: 0, background: "white", borderTop: "1px solid #f3f4f6" }}>
                <button
                  onClick={commitFinalize}
                  disabled={finalizeSaving}
                  style={{ flex: 2, padding: 13, background: finalizeSaving ? "#6b7280" : "#1B3A2B", color: "white", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: finalizeSaving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  {finalizeSaving ? "שומר..." : (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" style={{ marginLeft: 6 }}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                      שמור העברה
                    </>
                  )}
                </button>
                <button
                  onClick={() => setFinalizeConfirmOpen(false)}
                  disabled={finalizeSaving}
                  style={{ flex: 1, padding: 13, background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 500, fontFamily: "inherit", cursor: "pointer" }}
                >
                  חזרה לעריכה
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* החלפת דגים dialog (spec page 42)
          Shown when the user selects a fish strain that is not on the pond's
          roster (i.e., not among strains from prior קניה transfers in this cycle).
          Three options: cancel | switch to a roster strain | proceed anyway with a note. */}
      {switchDialogOpen && (() => {
        const pendingStrain = fishStrains.find((s) => s.id === (pendingSwitchStrainId ?? fishStrainId));
        const rosterStrains = fishStrains.filter((s) => pondRosterStrainIds.includes(s.id));
        return (
          <div
            className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget && !switchSaving) handleSwitchCancel(); }}
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
              {/* Header */}
              <div className="bg-amber-600 text-white px-5 py-4 rounded-t-2xl">
                <h2 className="text-base font-bold">החלפת דגים</h2>
                <p className="text-xs opacity-90 mt-0.5">
                  {`לפי הרישום, דג ${pendingStrain ? strainLabel(pendingStrain) : "—"} אינו נמצא בבריכה ${header.sourcePondName}. כיצד להמשיך?`}
                </p>
              </div>
              <div className="p-5 space-y-4">
                {/* Option 1: ביטול */}
                <button
                  onClick={handleSwitchCancel}
                  disabled={switchSaving}
                  className="w-full text-right border border-gray-300 rounded-xl px-4 py-3 text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  <span className="font-semibold block text-gray-800">ביטול בחירת הדג</span>
                  <span className="text-xs text-gray-500">{`ביטול בחירת ${pendingStrain ? strainLabel(pendingStrain) : "הדג"} ובחירת דג אחר`}</span>
                </button>
                {/* Option 2: החלפת דג — pick a replacement from the roster */}
                <form onSubmit={handleSwitchAndSave} className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 space-y-2">
                  <p className="text-sm font-semibold text-gray-800">החלפת הדג בדג אחר מהבריכה</p>
                  <p className="text-xs text-gray-600">
                    {`בחר את הדג שכן נמצא בבריכה ${header.sourcePondName} להחליף אותו:`}
                  </p>
                  <select
                    value={switchReplacementStrainId}
                    onChange={(e) => setSwitchReplacementStrainId(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    disabled={switchSaving}
                  >
                    <option value="">— בחר דג חלופי —</option>
                    {rosterStrains.map((s) => (
                      <option key={s.id} value={s.id}>{strainLabel(s)}</option>
                    ))}
                  </select>
                  {switchError && (
                    <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{switchError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={switchSaving || !switchReplacementStrainId}
                    className="w-full py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 disabled:opacity-50 transition-colors"
                  >
                    {switchSaving ? "שומר..." : "בצע החלפה ושמור שורה"}
                  </button>
                </form>
                {/* Option 3: בצע בכל זאת */}
                <button
                  onClick={handleSwitchProceedAnyway}
                  disabled={switchSaving}
                  className="w-full text-right border border-gray-200 rounded-xl px-4 py-3 text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  <span className="font-semibold block text-gray-800">בצע בכל זאת ללא החלפת דג</span>
                  <span className="text-xs text-amber-700">⚠️ בחירה זו עשויה ליצור פערים ברישום המלאי — תתווסף הערה אוטומטית לשורה</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
