"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientOption {
  id: string;
  name: string;
  contactInfo: string;
}

interface WorkerOption {
  id: string;
  name: string;
  isManager: boolean;
  hasSignature: boolean;
}

interface CarrierOption {
  id: string;
  name: string;
  licensePlate: string | null;
  driverPhone: string | null;
  clientIds: string[];
}

interface AvailableTank {
  id: string;
  headerId: string;
  fishTypeName: string;
  totalWeightKg: number | null;
  fishCount: number | null;
  avgWeightGrams: number | null;
  destPondName: string;
  sourcePondName: string;
  tankCode: string | null;
  vehicleCode: string | null;
  transferDate: string;
}

interface DetailRow {
  id?: string;
  transferDetailId?: string;
  fishTypeDescription: string;
  sourcePondName?: string;
  quantity: number;
  unit?: string;
  grossNet?: string;
}

interface Props {
  clients: ClientOption[];
  workers: WorkerOption[];
  carriers: CarrierOption[];
  currentWorkerId: string | null;
  isManager: boolean;
  // Spec p32 manual mode: pond + fish pickers from lists + not-in-pond warning
  openPonds: { id: string; code: string; name: string }[];
  pondFish: Record<string, string[]>; // pondId → fishStrainIds recorded in its open cycle
  fishStrains: { id: string; label: string }[];
  existingDelivery: {
    id: string;
    clientId: string | null;
    date: string;
    producerWorkerId?: string | null;
    managerId?: string | null;
    carrierId?: string | null;
    driverName?: string | null;
    loadingTime?: string | null;
    vetApprovalRef?: string | null;
    notes?: string | null;
    status: string;
    certNumber?: string | null;
    details: DetailRow[];
    client?: { name: string; contactInfo: string } | null;
  } | null;
  viewOnly: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: "20px 20px 16px",
      marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#2BAEA6", marginBottom: 14, letterSpacing: 0.3 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #d1d5db",
  fontSize: 14, fontFamily: "inherit", background: "#fff", color: "#1a2744", boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

const thStyle: React.CSSProperties = {
  padding: "9px 10px", fontSize: 12, fontWeight: 700, color: "white",
  textAlign: "right", borderBottom: "none",
};

const tdStyle: React.CSSProperties = {
  padding: "9px 10px", fontSize: 13, color: "#1a2744", verticalAlign: "middle",
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function DeliveryFormClient({
  clients, workers, carriers, currentWorkerId, isManager, existingDelivery, viewOnly,
  openPonds, pondFish, fishStrains,
}: Props) {
  const router = useRouter();
  const isNew = !existingDelivery;
  const isFinalized = existingDelivery?.status === "הופק";
  const isPending = existingDelivery?.status === "ממתין לאישור";
  // Non-managers cannot edit a pending-approval delivery
  const readOnly = viewOnly || isFinalized || (isPending && !isManager);

  const todayStr = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(
    existingDelivery ? existingDelivery.date.slice(0, 10) : todayStr
  );
  const [clientId, setClientId] = useState(existingDelivery?.clientId ?? "");
  const [occasionalClient, setOccasionalClient] = useState(!existingDelivery?.clientId);
  const [occasionalClientName, setOccasionalClientName] = useState((existingDelivery as any)?.clientName ?? "");

  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [availableTanks, setAvailableTanks] = useState<AvailableTank[]>([]);
  const [tanksLoading, setTanksLoading] = useState(false);
  const [selectedTankIds, setSelectedTankIds] = useState<Set<string>>(new Set());
  const [tankVehicleHint, setTankVehicleHint] = useState<string | null>(null);

  const [details, setDetails] = useState<DetailRow[]>(existingDelivery?.details ?? []);
  // Spec p32: fish chosen that is not registered as grown in the chosen pond →
  // warning + explicit approval before keeping the value.
  const [fishWarning, setFishWarning] = useState<{ idx: number; strainId: string; strainLabel: string } | null>(null);

  const [producerWorkerId, setProducerWorkerId] = useState(
    (existingDelivery as any)?.producerWorkerId ?? currentWorkerId ?? ""
  );
  const [carrierId, setCarrierId] = useState((existingDelivery as any)?.carrierId ?? "");
  const [occasionalDriver, setOccasionalDriver] = useState(
    !(existingDelivery as any)?.carrierId && !!(existingDelivery as any)?.driverName
  );
  const [driverName, setDriverName] = useState((existingDelivery as any)?.driverName ?? "");
  // Initialized empty and filled in useEffect below — computing nowTimeStr() in
  // the initializer runs on BOTH server render and client hydration; when the
  // minute ticks over between them React throws a hydration-mismatch error.
  const [loadingTime, setLoadingTime] = useState<string>(
    (existingDelivery as any)?.loadingTime ?? ""
  );
  const [editingTime, setEditingTime] = useState(false);
  const [orderRef, setOrderRef] = useState((existingDelivery as any)?.orderRef ?? "");
  const [vetApprovalRef, setVetApprovalRef] = useState(existingDelivery?.vetApprovalRef ?? "");
  const [notes, setNotes] = useState((existingDelivery as any)?.notes ?? "");
  const [managerId, setManagerId] = useState(
    (existingDelivery as any)?.managerId ?? (isManager ? currentWorkerId ?? "" : "")
  );

  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  // Set after the first successful POST on a new form. Without it, a failed
  // finalize (e.g. missing driver) left a draft behind and the NEXT click
  // POSTed again — creating a duplicate delivery instead of updating the first.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Live clock — set immediately on mount (client-only, avoids hydration mismatch)
  // then auto-updates every 30s for new records, stops when user clicks to edit
  useEffect(() => {
    if (!isNew || editingTime || readOnly) return;
    setLoadingTime(nowTimeStr());
    const timer = setInterval(() => setLoadingTime(nowTimeStr()), 30000);
    return () => clearInterval(timer);
  }, [isNew, editingTime, readOnly]);

  const loadTanks = useCallback(async () => {
    setTanksLoading(true);
    try {
      const res = await fetch("/api/deliveries/tanks");
      if (res.ok) setAvailableTanks(await res.json());
    } finally {
      setTanksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "auto" && !readOnly) loadTanks();
  }, [mode, readOnly, loadTanks]);

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;
  const selectedCarrier = carriers.find((c) => c.id === carrierId) ?? null;
  const managerWorkers = workers.filter((w) => w.isManager);

  const sortedCarriers = [...carriers].sort((a, b) => {
    const aFor = clientId && a.clientIds.includes(clientId) ? 0 : 1;
    const bFor = clientId && b.clientIds.includes(clientId) ? 0 : 1;
    return aFor - bFor;
  });

  const selectedTanks = availableTanks.filter((t) => selectedTankIds.has(t.id));
  const unselectedTanks = availableTanks.filter((t) => !selectedTankIds.has(t.id));

  // In read-only view the table always renders the saved details, so the total
  // must come from them too — `mode` defaults to "auto" and would show 0.0.
  const totalWeight = mode === "auto" && !readOnly
    ? selectedTanks.reduce((s, t) => s + (t.totalWeightKg ?? 0), 0)
    : details.reduce((s, d) => s + d.quantity, 0);

  const autoDetails: DetailRow[] = selectedTanks.map((t) => ({
    transferDetailId: t.id,
    fishTypeDescription: t.fishTypeName,
    sourcePondName: t.sourcePondName,
    quantity: t.totalWeightKg ?? 0,
    unit: "ק\"ג",
    grossNet: "נטו",
  }));

  async function handleSave(finalizeAfter = false) {
    setError("");
    setSaving(true);
    try {
      const activeDetails = mode === "auto" ? autoDetails : details;
      const payload = {
        clientId: occasionalClient ? undefined : clientId || undefined,
        clientName: occasionalClient ? occasionalClientName || undefined : undefined,
        date,
        producerWorkerId: producerWorkerId || undefined,
        managerId: isManager ? managerId || undefined : undefined,
        carrierId: occasionalDriver ? undefined : carrierId || undefined,
        driverName: occasionalDriver ? driverName || undefined : undefined,
        loadingTime: loadingTime || undefined,
        vetApprovalRef: vetApprovalRef || undefined,
        notes: notes || undefined,
        details: activeDetails,
      };

      let deliveryId = existingDelivery?.id ?? createdId ?? undefined;

      if (!deliveryId) {
        const res = await fetch("/api/deliveries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "שגיאה בשמירה"); }
        deliveryId = (await res.json()).id as string;
        setCreatedId(deliveryId);
      } else {
        const res = await fetch(`/api/deliveries/${deliveryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "שגיאה בשמירה"); }
      }

      if (finalizeAfter && deliveryId) {
        setFinalizing(true);
        const res = await fetch(`/api/deliveries/${deliveryId}/finalize`, { method: "POST" });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "שגיאה בהפקה"); }
        setSuccess("תעודת המשלוח הופקה בהצלחה!");
        setTimeout(() => router.push("/ops/management/deliveries"), 1500);
      } else {
        setSuccess(isNew ? "תעודה נשמרה בטיוטא" : "תעודה עודכנה");
        if (isNew && deliveryId) router.push(`/ops/deliveries/new?id=${deliveryId}`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setSaving(false);
      setFinalizing(false);
    }
  }


  async function handleSubmitForApproval() {
    setError("");
    setSaving(true);
    try {
      // First save any pending edits
      const activeDetails = mode === "auto" ? autoDetails : details;
      const payload = {
        clientId: occasionalClient ? undefined : clientId || undefined,
        clientName: occasionalClient ? occasionalClientName || undefined : undefined,
        orderRef: orderRef || undefined,
        date,
        producerWorkerId: producerWorkerId || undefined,
        managerId: isManager ? managerId || undefined : undefined,
        carrierId: occasionalDriver ? undefined : carrierId || undefined,
        driverName: occasionalDriver ? driverName || undefined : undefined,
        loadingTime: loadingTime || undefined,
        vetApprovalRef: vetApprovalRef || undefined,
        notes: notes || undefined,
        details: activeDetails,
      };

      let deliveryId = existingDelivery?.id ?? createdId ?? undefined;
      if (!deliveryId) {
        const res = await fetch("/api/deliveries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "שגיאה בשמירה"); }
        deliveryId = (await res.json()).id as string;
        setCreatedId(deliveryId);
      } else {
        const res = await fetch(`/api/deliveries/${deliveryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "שגיאה בשמירה"); }
      }

      // Then submit for approval
      const res = await fetch(`/api/deliveries/${deliveryId}/submit`, { method: "POST" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "שגיאה בהעברה לאישור"); }
      setSuccess("התעודה הועברה לאישור מנהל!");
      setTimeout(() => router.push("/ops/management/deliveries"), 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setSaving(false);
    }
  }

  function addDetailRow() {
    setDetails((prev) => [...prev, { fishTypeDescription: "", quantity: 0, unit: "ק\"ג", grossNet: "נטו" }]);
  }
  function updateDetail(idx: number, field: keyof DetailRow, value: string | number) {
    setDetails((prev) => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  }
  function removeDetail(idx: number) {
    setDetails((prev) => prev.filter((_, i) => i !== idx));
  }

  // ─── Print / export certificate ───────────────────────────────────────────────
  // Opens the server-generated PDF in a new tab.
  // The server fetches the delivery data and renders it with Puppeteer.
  // On Android, the browser's native share button → WhatsApp Business.
  function handlePrintCertificate() {
    if (!existingDelivery?.id) return;
    window.open(`/api/deliveries/${existingDelivery.id}/pdf`, "_blank");
  }

  const statusBadge = existingDelivery ? ({
    "טיוטא":           { label: "טיוטא",          bg: "#f3f4f6", color: "#374151" },
    "ממתין לאישור":    { label: "ממתין לאישור",   bg: "#fef3c7", color: "#92400e" },
    "הופק":            { label: "הופק",            bg: "#dcfce7", color: "#15803d" },
    "מבוטל":           { label: "מבוטל",           bg: "#fee2e2", color: "#991b1b" },
  } as Record<string, { label: string; bg: string; color: string }>)[existingDelivery.status] : null;

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
        <Link
          href="/ops/management/deliveries"
          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 14, color: "#2BAEA6", fontWeight: 600, textDecoration: "none" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          חזרה
        </Link>
        <div style={{ fontSize: 11, color: "#9ca3af" }}>
          ניהול תפעול
          <span style={{ margin: "0 5px" }}>›</span>
          ניהול תעודות משלוח
          <span style={{ margin: "0 5px" }}>›</span>
          <span style={{ color: "#1a2744", fontWeight: 600 }}>
            {isNew ? "תעודת משלוח חדשה" : "עריכת תעודת משלוח"}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a2744", margin: 0 }}>
          {isNew ? "תעודת משלוח חדשה" : "הפקת תעודת משלוח"}
        </h1>
        {statusBadge && (
          <span style={{ padding: "3px 12px", borderRadius: 99, fontSize: 13, fontWeight: 700, background: statusBadge.bg, color: statusBadge.color }}>
            {statusBadge.label}
          </span>
        )}
      </div>

      {/* ══ חלק א: פרטי לקוח ════════════════════════════════ */}
      <Section title="חלק א — פרטי לקוח ותאריך">
        {/* לקוח first — full width, matching prototype order */}
        <Field label="לכבוד (לקוח)">
          {readOnly ? (
            <div style={{ ...inputStyle, background: "#f9f6f0", color: "#1a2744" }}>
              {(selectedClient?.name ?? occasionalClientName) || "לקוח מזדמן"}
            </div>
          ) : (
            <select
              value={occasionalClient ? "__occasional__" : clientId}
              onChange={(e) => {
                if (e.target.value === "__occasional__") {
                  setOccasionalClient(true); setClientId("");
                  // spec: "אם הלקוח הוא לקוח מזדמן — ברירת המחדל תהיה נהג מזדמן"
                  setOccasionalDriver(true); setCarrierId("");
                } else {
                  setOccasionalClient(false); setClientId(e.target.value);
                }
              }}
              style={selectStyle}
            >
              <option value="">-- בחר לקוח --</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="__occasional__">לקוח מזדמן</option>
            </select>
          )}
        </Field>

        {occasionalClient && !readOnly && (
          <Field label="שם לקוח מזדמן">
            <input
              type="text" value={occasionalClientName} placeholder="הזן שם לקוח"
              onChange={(e) => setOccasionalClientName(e.target.value)}
              style={inputStyle}
            />
          </Field>
        )}

        {selectedClient && (
          <Field label="ח.פ. / פרטי קשר">
            <div style={{ ...inputStyle, background: "#f9f6f0", fontSize: 13, color: "#6b7280" }}>
              {selectedClient.contactInfo || "—"}
            </div>
          </Field>
        )}

        {/* תאריך below client — matches prototype row 2 layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="תאריך">
            <input
              type="date" value={date} disabled={readOnly}
              onChange={(e) => setDate(e.target.value)}
              style={{ ...inputStyle, opacity: readOnly ? 0.7 : 1 }}
            />
          </Field>
          <Field label="מספר הזמנה (אופציונלי)">
            <input
              type="text"
              value={orderRef}
              disabled={readOnly}
              onChange={(e) => setOrderRef(e.target.value)}
              placeholder="מספר הזמנה מהלקוח..."
              style={{ ...inputStyle, opacity: readOnly ? 0.7 : 1 }}
            />
          </Field>
        </div>
      </Section>

      {/* ══ חלק ב: פרטי משלוח ═══════════════════════════════ */}
      <Section title="חלק ב — פרטי משלוח">
        {!readOnly && (
          <div style={{ display: "flex", gap: 0, marginBottom: 16, borderRadius: 8, overflow: "hidden", border: "1.5px solid #e5e7eb", width: "fit-content" }}>
            <button
              onClick={() => setMode("auto")}
              style={{ padding: "6px 18px", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", border: "none", background: mode === "auto" ? "#1B3A2B" : "#f3f4f6", color: mode === "auto" ? "white" : "#6b7280", transition: "all .15s" }}
            >
              ⚙️ אוטומטי
            </button>
            <button
              onClick={() => setMode("manual")}
              style={{ padding: "6px 18px", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", border: "none", background: mode === "manual" ? "#1B3A2B" : "#f3f4f6", color: mode === "manual" ? "white" : "#6b7280", transition: "all .15s" }}
            >
              ✏️ ידני
            </button>
          </div>
        )}

        {/* AUTO mode */}
        {mode === "auto" && !readOnly && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                רשימת טנקים שנסגרו וטרם נשלחו — לחץ על טנק להוספה לתעודה:
              </div>
              <button
                onClick={loadTanks} disabled={tanksLoading}
                style={{ background: "#1B3A2B", color: "white", border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 700, fontFamily: "inherit", cursor: tanksLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 5 }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                {tanksLoading ? "טוען..." : "רענן"}
              </button>
            </div>

            {/* Available tanks */}
            <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 10, background: "#f9fafb", marginBottom: 16, overflow: "hidden" }}>
              {availableTanks.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                  {tanksLoading ? "טוען טנקים..." : "אין טנקי שיווק מוכנים — בצע תחילה העברת שיווק"}
                </div>
              ) : unselectedTanks.length === 0 ? (
                <div style={{ padding: "14px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>כל הטנקים נבחרו</div>
              ) : (
                <div style={{ maxHeight: 220, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#12243d" }}>
                        <th style={{ ...thStyle, width: 32 }}>#</th>
                        <th style={thStyle}>מספר טנק</th>
                        <th style={thStyle}>סוג דג</th>
                        <th style={thStyle}>בריכת מקור</th>
                        <th style={{ ...thStyle, textAlign: "center", width: 100 }}>משקל (ק"ג)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unselectedTanks.map((t, i) => (
                        <tr
                          key={t.id}
                          onClick={() => {
                          setSelectedTankIds((prev) => { const n = new Set(prev); n.add(t.id); return n; });
                          if (t.vehicleCode) {
                            const match = carriers.find((c) => c.licensePlate === t.vehicleCode);
                            if (match && !carrierId) { setCarrierId(match.id); setOccasionalDriver(false); }
                            else if (!match) { setTankVehicleHint(t.vehicleCode); }
                          }
                        }}
                          style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#e8f7f6")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                        >
                          <td style={{ ...tdStyle, color: "#9ca3af" }}>{i + 1}</td>
                          <td style={tdStyle}>{t.tankCode ?? "—"}</td>
                          <td style={tdStyle}>{t.fishTypeName}</td>
                          <td style={tdStyle}>{t.sourcePondName}</td>
                          <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700 }}>{t.totalWeightKg?.toFixed(1) ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Selected tanks */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "#4b6180", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
              טנקים שנבחרו לתעודה זו
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 440 }}>
                <thead>
                  <tr style={{ background: "#12243d" }}>
                    <th style={{ ...thStyle, width: 32 }}>#</th>
                    <th style={thStyle}>מספר טנק</th>
                    <th style={thStyle}>סוג דג</th>
                    <th style={thStyle}>בריכת מקור</th>
                    <th style={{ ...thStyle, textAlign: "center", width: 100 }}>משקל (ק"ג)</th>
                    <th style={{ ...thStyle, textAlign: "center", width: 50 }}>הסר</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTanks.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", fontStyle: "italic" }}>
                        לא נבחרו טנקים — לחץ על טנק ברשימה למעלה להוספה
                      </td>
                    </tr>
                  ) : selectedTanks.map((t, i) => (
                    <tr key={t.id} style={{ borderBottom: "1px solid #f3f4f6", background: "white" }}>
                      <td style={{ ...tdStyle, color: "#9ca3af" }}>{i + 1}</td>
                      <td style={tdStyle}>{t.tankCode ?? "—"}</td>
                      <td style={tdStyle}>{t.fishTypeName}</td>
                      <td style={tdStyle}>{t.sourcePondName}</td>
                      <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700 }}>{t.totalWeightKg?.toFixed(1) ?? "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <button
                          onClick={() => setSelectedTankIds((prev) => { const n = new Set(prev); n.delete(t.id); return n; })}
                          style={{ background: "none", border: "none", color: "#E8544A", cursor: "pointer", fontSize: 17, lineHeight: 1 }}
                          title="הסר טנק"
                        >✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#e1f5ee", fontWeight: 700 }}>
                    <td colSpan={2} style={{ ...tdStyle, color: "#0F6E56", fontSize: 12 }}>סה"כ</td>
                    <td style={{ ...tdStyle, textAlign: "center", color: "#6b7280", fontSize: 12 }}>{selectedTanks.length} טנקים</td>
                    <td />
                    <td style={{ ...tdStyle, textAlign: "center", color: "#0F6E56", fontWeight: 900, fontSize: 15 }}>{totalWeight.toFixed(1)} ק"ג</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        {/* MANUAL mode */}
        {(mode === "manual" || readOnly) && (
          <>
            {details.length === 0 && !readOnly ? (
              <div style={{ color: "#9ca3af", fontSize: 13, marginBottom: 10 }}>לא נוספו שורות פירוט.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 10, minWidth: 440 }}>
                  <thead>
                    <tr style={{ background: "#12243d" }}>
                      <th style={{ ...thStyle, width: 32 }}>#</th>
                      <th style={thStyle}>מספר טנק</th>
                      <th style={thStyle}>סוג דג</th>
                      <th style={thStyle}>בריכת מקור</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>משקל (ק"ג)</th>
                      {!readOnly && <th style={{ ...thStyle, textAlign: "center", width: 50 }}>הסר</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {details.map((d, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ ...tdStyle, color: "#9ca3af" }}>{idx + 1}</td>
                        <td style={tdStyle}>
                          {readOnly ? (d.transferDetailId ?? "—") : (
                            <input
                              value={d.transferDetailId ?? ""}
                              onChange={(e) => updateDetail(idx, "transferDetailId", e.target.value)}
                              style={{ ...inputStyle, padding: "5px 8px" }}
                              placeholder="מס׳ טנק"
                            />
                          )}
                        </td>
                        <td style={tdStyle}>
                          {readOnly ? d.fishTypeDescription : (
                            <select
                              value={fishStrains.find((f) => f.label === d.fishTypeDescription)?.id ?? ""}
                              onChange={(e) => {
                                const strain = fishStrains.find((f) => f.id === e.target.value);
                                if (!strain) { updateDetail(idx, "fishTypeDescription", ""); return; }
                                // Spec p32: if the fish is not registered as grown in the
                                // chosen pond — warn and ask for explicit approval.
                                const pond = openPonds.find((p) => p.name === d.sourcePondName);
                                const registered = pond ? (pondFish[pond.id] ?? []).includes(strain.id) : true;
                                if (pond && !registered) {
                                  setFishWarning({ idx, strainId: strain.id, strainLabel: strain.label });
                                } else {
                                  updateDetail(idx, "fishTypeDescription", strain.label);
                                }
                              }}
                              style={{ ...selectStyle, padding: "5px 8px" }}
                            >
                              <option value="">בחר דג...</option>
                              {fishStrains.map((f) => (
                                <option key={f.id} value={f.id}>{f.label}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {readOnly ? (d.sourcePondName ?? "—") : (
                            <select
                              value={openPonds.find((p) => p.name === d.sourcePondName)?.id ?? ""}
                              onChange={(e) => {
                                const pond = openPonds.find((p) => p.id === e.target.value);
                                updateDetail(idx, "sourcePondName", pond?.name ?? "");
                                // Fish already chosen? re-check it against the new pond (spec p32).
                                const strain = fishStrains.find((f) => f.label === d.fishTypeDescription);
                                if (pond && strain && !(pondFish[pond.id] ?? []).includes(strain.id)) {
                                  setFishWarning({ idx, strainId: strain.id, strainLabel: strain.label });
                                }
                              }}
                              style={{ ...selectStyle, padding: "5px 8px" }}
                            >
                              <option value="">בחר בריכה...</option>
                              {openPonds.map((p) => (
                                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          {readOnly ? d.quantity : (
                            <input
                              type="number" min="0" step="0.1" value={d.quantity}
                              onChange={(e) => updateDetail(idx, "quantity", parseFloat(e.target.value) || 0)}
                              style={{ ...inputStyle, padding: "5px 8px", width: 90, textAlign: "center" }}
                            />
                          )}
                        </td>
                        {!readOnly && (
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            <button
                              onClick={() => removeDetail(idx)}
                              style={{ background: "none", border: "none", color: "#E8544A", cursor: "pointer", fontSize: 17 }}
                            >✕</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#e1f5ee", fontWeight: 700 }}>
                      <td colSpan={4} style={{ ...tdStyle, color: "#0F6E56", fontSize: 12 }}>סה"כ משקל</td>
                      <td style={{ ...tdStyle, textAlign: "center", color: "#0F6E56", fontWeight: 900, fontSize: 15 }}>{totalWeight.toFixed(1)} ק"ג</td>
                      {!readOnly && <td />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {!readOnly && (
              <button
                onClick={addDetailRow}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px dashed #2BAEA6", background: "#f0fdf4", color: "#15803d", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", width: "100%" }}
              >
                + הוסף שורה
              </button>
            )}
          </>
        )}
      </Section>

      {/* ══ חלק ג: פרטי מבצע ונהג ═══════════════════════════ */}
      <Section title="חלק ג — פרטי מבצע ונהג">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

          {/* שם המבצע */}
          <Field label="שם המבצע">
            {readOnly ? (
              <div style={{ ...inputStyle, background: "#f9f6f0" }}>
                {workers.find((w) => w.id === producerWorkerId)?.name ?? "—"}
              </div>
            ) : (
              <select value={producerWorkerId} onChange={(e) => setProducerWorkerId(e.target.value)} style={selectStyle}>
                <option value="">-- בחר --</option>
                {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            )}
          </Field>

          {/* שעת העמסה */}
          <Field label="שעת העמסה">
            {readOnly ? (
              <div style={{ ...inputStyle, background: "#f9f6f0" }}>{loadingTime || "—"}</div>
            ) : editingTime ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="time" value={loadingTime}
                  onChange={(e) => setLoadingTime(e.target.value)}
                  onBlur={() => setEditingTime(false)}
                  autoFocus
                  style={{ ...inputStyle, flex: 1, width: "auto" }}
                />
                <button
                  onClick={() => setEditingTime(false)}
                  style={{ background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 6, padding: "7px 10px", cursor: "pointer", fontSize: 12, color: "#374151", fontFamily: "inherit" }}
                >
                  אישור
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  onClick={() => setEditingTime(true)}
                  title="לחץ לעריכה ידנית"
                  style={{ background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 8, padding: "9px 16px", fontSize: 15, fontWeight: 700, color: "#15803d", minWidth: 70, textAlign: "center", cursor: "pointer", flex: 1 }}
                >
                  {loadingTime}
                </div>
                <button
                  onClick={() => setEditingTime(true)}
                  title="ערוך שעה"
                  style={{ background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 6, padding: "7px 10px", cursor: "pointer", fontSize: 13, color: "#6b7280" }}
                >✏️</button>
              </div>
            )}
          </Field>

          {/* שם הנהג */}
          <Field label="שם הנהג">
            {readOnly ? (
              <div style={{ ...inputStyle, background: "#f9f6f0" }}>
                {selectedCarrier ? selectedCarrier.name : driverName || "—"}
              </div>
            ) : (
              <select
                value={occasionalDriver ? "__occasional__" : carrierId}
                onChange={(e) => {
                  if (e.target.value === "__occasional__") { setOccasionalDriver(true); setCarrierId(""); }
                  else { setOccasionalDriver(false); setCarrierId(e.target.value); }
                }}
                style={selectStyle}
              >
                <option value="">-- בחר נהג --</option>
                {sortedCarriers.map((c) => {
                  const isClientDriver = !!(clientId && c.clientIds.includes(clientId));
                  return (
                    <option key={c.id} value={c.id}>
                      {isClientDriver ? "★ " : ""}{c.name}{c.licensePlate ? ` (${c.licensePlate})` : ""}
                    </option>
                  );
                })}
                <option value="__occasional__">נהג מזדמן</option>
              </select>
            )}
          </Field>

          {/* מספר רישוי */}
          <Field label="מספר רישוי">
            <div style={{ ...inputStyle, background: "#f9f6f0", color: selectedCarrier?.licensePlate ? "#1a2744" : "#9ca3af" }}>
              {selectedCarrier?.licensePlate ?? (tankVehicleHint && !occasionalDriver ? tankVehicleHint : occasionalDriver ? "נהג מזדמן" : "— אוטומטי מהנהג —")}
            </div>
            {tankVehicleHint && !selectedCarrier && !occasionalDriver && (
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>
                מהעברת שיווק — לא נמצא נהג תואם ברשימה
              </div>
            )}
          </Field>
        </div>

        {occasionalDriver && !readOnly && (
          <Field label="שם נהג מזדמן">
            <input
              type="text" value={driverName} placeholder="הזן שם נהג"
              onChange={(e) => setDriverName(e.target.value)}
              style={inputStyle}
            />
          </Field>
        )}

        <Field label="מספר תעודת בריאות (אופציונלי)">
          <input
            type="text" value={vetApprovalRef} disabled={readOnly}
            onChange={(e) => setVetApprovalRef(e.target.value)}
            placeholder="מספר תעודת בריאות"
            style={{ ...inputStyle, opacity: readOnly ? 0.7 : 1 }}
          />
        </Field>

        <Field label="הערות (אופציונלי)">
          <textarea
            value={notes} disabled={readOnly} rows={2}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="הערות לתעודה..."
            style={{ ...inputStyle, resize: "vertical", opacity: readOnly ? 0.7 : 1 }}
          />
        </Field>
      </Section>

      {/* ══ חלק ד: אחראי וחתימה (מנהלים בלבד) ══════════════ */}
      {(isManager || existingDelivery?.status === "הופק") && (
        <Section title="חלק ד — אחראי וחתימה (מנהלים בלבד)">
          <Field label="שם אחראי">
            {readOnly || !isManager ? (
              <div style={{ ...inputStyle, background: "#f9f6f0" }}>
                {workers.find((w) => w.id === managerId)?.name ?? "—"}
              </div>
            ) : (
              <select value={managerId} onChange={(e) => setManagerId(e.target.value)} style={selectStyle}>
                <option value="">-- בחר אחראי --</option>
                {managerWorkers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}{w.hasSignature ? " ✓ חתימה" : " ⚠ אין חתימה"}
                  </option>
                ))}
              </select>
            )}
          </Field>

          {managerId && managerWorkers.find((w) => w.id === managerId)?.hasSignature && (
            <Field label="חתימה דיגיטלית">
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8, background: "#f9f6f0", display: "inline-block" }}>
                <img
                  src={`/api/admin/workers/${managerId}/signature`}
                  alt="חתימת אחראי"
                  style={{ maxHeight: 72, maxWidth: 220, objectFit: "contain" }}
                />
              </div>
            </Field>
          )}

          {managerWorkers.find((w) => w.id === managerId) &&
           !managerWorkers.find((w) => w.id === managerId)?.hasSignature && !readOnly && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fef3c7", fontSize: 13, color: "#92400e" }}>
              ⚠ לעובד זה אין חתימה דיגיטלית. יש להוסיף חתימה לפרופיל לפני הפקת התעודה.
            </div>
          )}
        </Section>
      )}

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#fee2e2", color: "#991b1b", fontSize: 14, marginBottom: 16 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#dcfce7", color: "#166534", fontSize: 14, marginBottom: 16 }}>
          {success}
        </div>
      )}

      {/* ══ כפתורי פעולה ════════════════════════════════════════════════ */}
      {readOnly && existingDelivery?.status === "הופק" && (
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 8 }}>
          <button
            onClick={handlePrintCertificate}
            style={{
              padding: "11px 28px", borderRadius: 9, border: "none",
              background: "#0F6E56", color: "#fff", fontSize: 15, fontWeight: 700,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
            }}
          >
            📄 שמור PDF
          </button>
        </div>
      )}
      {!readOnly && (
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 8 }}>
          <button
            onClick={() => router.push("/ops/management/deliveries")}
            style={{ padding: "10px 22px", borderRadius: 9, border: "1.5px solid #d1d5db", background: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "#374151" }}
          >
            ביטול
          </button>

          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            style={{ padding: "10px 22px", borderRadius: 9, border: "1.5px solid #2BAEA6", background: "#fff", color: "#2BAEA6", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
          >
            {saving && !finalizing ? "שומר..." : "שמור טיוטה"}
          </button>

          {!isManager && (
            <button
              onClick={handleSubmitForApproval}
              style={{ padding: "10px 22px", borderRadius: 9, border: "none", background: saving ? "#6ee7b7" : "#059669", color: "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}
            >
              {saving ? "שולח..." : "סגירה והעברה לאישור"}
            </button>
          )}


          {isManager && (
            <button
              onClick={() => handleSave(true)}
              disabled={saving || finalizing}
              style={{ padding: "10px 22px", borderRadius: 9, border: "none", background: saving || finalizing ? "#6ee7b7" : "#10b981", color: "#fff", fontSize: 14, fontWeight: 700, cursor: saving || finalizing ? "not-allowed" : "pointer" }}
            >
              {finalizing ? "מפיק..." : saving ? "שומר..." : "שמור והפק תעודה"}
            </button>
          )}
        </div>
      )}

      {/* Spec p32: fish not registered as grown in the chosen pond — warn + require approval.
          "זה אומר שיש פער בין הרישום באפליקציה והגידול בפועל - שצריך להשלים" */}
      {fishWarning && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setFishWarning(null); }}
        >
          <div style={{ background: "white", borderRadius: 14, maxWidth: 420, width: "100%", padding: "20px 22px", boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }} dir="rtl">
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#b45309" }}>⚠️ דג לא רשום בבריכה</h3>
            <p style={{ fontSize: 13.5, color: "#374151", margin: "10px 0 4px", lineHeight: 1.6 }}>
              הדג <strong>{fishWarning.strainLabel}</strong> אינו רשום כמגודל בבריכה שנבחרה.
              ייתכן שיש פער בין הרישום באפליקציה לבין הגידול בפועל — שצריך להשלים.
            </p>
            <p style={{ fontSize: 13.5, color: "#374151", margin: "0 0 14px" }}>האם להמשיך בכל זאת?</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-start" }}>
              <button
                onClick={() => {
                  updateDetail(fishWarning.idx, "fishTypeDescription", fishWarning.strainLabel);
                  setFishWarning(null);
                }}
                style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#d97706", color: "white", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
              >
                אישור — המשך
              </button>
              <button
                onClick={() => {
                  // Not approved — clear the fish so an unapproved value can't linger in the row.
                  updateDetail(fishWarning.idx, "fishTypeDescription", "");
                  setFishWarning(null);
                }}
                style={{ padding: "8px 18px", borderRadius: 8, border: "1.5px solid #d1d5db", background: "white", color: "#374151", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
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
