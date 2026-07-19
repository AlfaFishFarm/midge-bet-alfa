"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ConfirmDialog from "@/components/ConfirmDialog";
import ErrorBanner from "@/components/ErrorBanner";

// Clients management screen - spec v3 pages 10-13.
// No dedicated prototype screen (prototype shows "לקוחות - בקרוב" toast).
// Visual style follows the delivery-cert-screen pattern from the prototype:
// dark-green (#1B3A2B) section headers, white cards radius 14px, shadow 0 2px 10px rgba(0,0,0,0.07).
// Visual fidelity pass 2026-07-02.

interface ContactInfo {
  id: string;
  name: string;
  phone: string | null;
  role: string | null;
}

interface CarrierInfo {
  id: string;
  name: string;
  licensePlate: string | null;
  vehicleDetails: string | null;
  driverPhone: string | null;
}

interface ClientInfo {
  id: string;
  name: string;
  address: string;
  contactInfo: string;
  notes: string | null;
  contacts: ContactInfo[];
  carriers: CarrierInfo[];
}

interface CarrierOption {
  id: string;
  name: string;
  licensePlate: string | null;
}

interface Props {
  clients: ClientInfo[];
  carrierOptions: CarrierOption[];
  canEdit: boolean;
}

const NEW_CLIENT = "__new__";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1.5px solid #e5e7eb",
  borderRadius: "8px",
  fontSize: "13px",
  fontFamily: "inherit",
  color: "#1a2744",
  outline: "none",
  background: "white",
  boxSizing: "border-box",
};

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: "11px", fontWeight: 700, color: "#1B3A2B", letterSpacing: "1px",
      textTransform: "uppercase", marginBottom: "14px", paddingBottom: "8px",
      borderBottom: "2px solid #b7d4ba",
    }}>
      {label}
    </div>
  );
}

function Card({ children, bgColor }: { children: React.ReactNode; bgColor?: string }) {
  return (
    <div style={{
      background: bgColor || "white", borderRadius: "14px", padding: "16px 18px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.07)", marginBottom: "14px",
    }}>
      {children}
    </div>
  );
}

function FieldLabel({ children, req }: { children: React.ReactNode; req?: boolean }) {
  return (
    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "5px" }}>
      {children}
      {req && <span style={{ color: "#ef4444", marginRight: "3px" }}>*</span>}
    </label>
  );
}

async function postJson(url: string, method: string, body: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "שגיאה בשמירה");
  return data;
}

export default function ClientsClient({ clients, carrierOptions, canEdit }: Props) {
  const router = useRouter();

  const [selectedId, setSelectedId] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [notes, setNotes] = useState("");

  const [newContact, setNewContact] = useState({ name: "", phone: "", role: "" });
  const [linkCarrierId, setLinkCarrierId] = useState("");
  const [newCarrierOpen, setNewCarrierOpen] = useState(false);
  const [newCarrier, setNewCarrier] = useState({ name: "", licensePlate: "", vehicleDetails: "", driverPhone: "" });

  const [confirmDeleteContact, setConfirmDeleteContact] = useState<ContactInfo | null>(null);
  const [confirmUnlinkCarrier, setConfirmUnlinkCarrier] = useState<CarrierInfo | null>(null);

  const selectedClient = clients.find((c) => c.id === selectedId) ?? null;
  const isNew = selectedId === NEW_CLIENT;

  function selectClient(c: ClientInfo | null) {
    setError(null);
    setPickerOpen(false);
    if (!c) {
      setSelectedId(NEW_CLIENT);
      setName(""); setAddress(""); setContactInfo(""); setNotes("");
      return;
    }
    setSelectedId(c.id);
    setName(c.name);
    setAddress(c.address);
    setContactInfo(c.contactInfo);
    setNotes(c.notes ?? "");
  }

  const linkedCarrierIds = new Set(selectedClient?.carriers.map((c) => c.id) ?? []);
  const availableCarriers = carrierOptions.filter((c) => !linkedCarrierIds.has(c.id));

  async function handleSaveClient(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !address.trim() || !contactInfo.trim()) {
      setError("שם, כתובת ופרטי קשר הם שדות חובה");
      return;
    }
    setLoading(true);
    try {
      const body = { name, address, contactInfo, notes: notes || undefined };
      if (isNew) {
        const result = await postJson("/api/clients", "POST", body);
        router.refresh();
        setSelectedId(result.id);
      } else if (selectedClient) {
        await postJson(`/api/clients/${selectedClient.id}`, "PATCH", body);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאת תקשורת. נסה שוב.");
    } finally { setLoading(false); }
  }

  async function handleAddContact() {
    if (!selectedClient || !newContact.name.trim()) { setError("יש להזין שם איש קשר"); return; }
    setError(null); setLoading(true);
    try {
      await postJson(`/api/clients/${selectedClient.id}/contacts`, "POST", {
        name: newContact.name, phone: newContact.phone || undefined, role: newContact.role || undefined,
      });
      setNewContact({ name: "", phone: "", role: "" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאת תקשורת. נסה שוב.");
    } finally { setLoading(false); }
  }

  async function confirmDeactivateContact() {
    if (!selectedClient || !confirmDeleteContact) return;
    setLoading(true);
    try {
      await postJson(`/api/clients/${selectedClient.id}/contacts/${confirmDeleteContact.id}`, "PATCH", {
        name: confirmDeleteContact.name, phone: confirmDeleteContact.phone ?? undefined,
        role: confirmDeleteContact.role ?? undefined, active: false,
      });
      router.refresh(); setConfirmDeleteContact(null);
    } catch (err) {
      setConfirmDeleteContact(null);
      setError(err instanceof Error ? err.message : "שגיאת תקשורת. נסה שוב.");
    } finally { setLoading(false); }
  }

  async function handleLinkCarrier() {
    if (!selectedClient || !linkCarrierId) return;
    setError(null); setLoading(true);
    try {
      await postJson(`/api/clients/${selectedClient.id}/carriers`, "POST", { carrierId: linkCarrierId });
      setLinkCarrierId(""); router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאת תקשורת. נסה שוב.");
    } finally { setLoading(false); }
  }

  async function handleCreateAndLinkCarrier() {
    if (!selectedClient || !newCarrier.name.trim()) { setError("יש להזין שם מוביל"); return; }
    setError(null); setLoading(true);
    try {
      const created = await postJson("/api/carriers", "POST", {
        name: newCarrier.name, licensePlate: newCarrier.licensePlate || undefined,
        vehicleDetails: newCarrier.vehicleDetails || undefined, driverPhone: newCarrier.driverPhone || undefined,
      });
      await postJson(`/api/clients/${selectedClient.id}/carriers`, "POST", { carrierId: created.id });
      setNewCarrier({ name: "", licensePlate: "", vehicleDetails: "", driverPhone: "" });
      setNewCarrierOpen(false); router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאת תקשורת. נסה שוב.");
    } finally { setLoading(false); }
  }

  async function confirmUnlink() {
    if (!selectedClient || !confirmUnlinkCarrier) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${selectedClient.id}/carriers/${confirmUnlinkCarrier.id}`, { method: "DELETE" });
      if (!res.ok) {
        let msg = "שגיאה בהסרת הקישור — נסה שנית";
        try { const d = await res.json(); msg = d.error ?? msg; } catch {}
        setError(msg); setConfirmUnlinkCarrier(null);
        return;
      }
      router.refresh(); setConfirmUnlinkCarrier(null);
    } catch {
      setConfirmUnlinkCarrier(null); setError("שגיאת תקשורת. נסה שוב.");
    } finally { setLoading(false); }
  }

  const thStyle: React.CSSProperties = {
    padding: "8px 10px", textAlign: "right", fontWeight: 700,
    fontSize: "12px", color: "white", background: "#1B3A2B", whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
    padding: "8px 10px", borderBottom: "1px solid #f3f4f6", fontSize: "13px", color: "#374151",
  };
  const tdMuted: React.CSSProperties = { ...tdStyle, color: "#9ca3af" };

  return (
    <div dir="rtl">
      <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#6b7280", marginBottom: "16px", flexWrap: "wrap" }}>
        <Link href="/" style={{ color: "#6b7280", textDecoration: "none" }}>דף הבית</Link>
        <span>›</span>
        <Link href="/ops" style={{ color: "#6b7280", textDecoration: "none" }}>תפעול</Link>
        <span>›</span>
        <Link href="/ops/management" style={{ color: "#6b7280", textDecoration: "none" }}>ניהול תפעול</Link>
        <span>›</span>
        <span style={{ color: "#1A2B1F", fontWeight: 600 }}>ניהול לקוחות</span>
      </div>

      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <div style={{ fontSize: "22px", fontWeight: 900, color: "#1A2B1F", letterSpacing: "-0.3px" }}>ניהול לקוחות</div>
        <div style={{ fontSize: "13px", color: "#6B7A72", fontWeight: 500, marginTop: "4px" }}>עדכון פרטי לקוח, אנשי קשר ומובילים משויכים</div>
      </div>

      {error && (
        <div style={{ marginBottom: "14px" }}>
          <ErrorBanner message={error} onClose={() => setError(null)} />
        </div>
      )}

      <Card bgColor="#e8f0e9">
        <SectionHeader label="א. בחירת לקוח" />
        <FieldLabel>לכבוד (לקוח)</FieldLabel>
        <div style={{ position: "relative" }}>
          <button type="button" onClick={() => setPickerOpen((o) => !o)}
            style={{ ...inputStyle, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <span style={{ color: selectedId ? "#1a2744" : "#9ca3af" }}>
              {isNew ? "לקוח חדש" : selectedClient ? selectedClient.name : "— בחר לקוח —"}
            </span>
            <span style={{ color: "#6b7280" }}>&#9660;</span>
          </button>
          {pickerOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 0 }} onClick={() => setPickerOpen(false)} />
              <ul style={{
                position: "absolute", zIndex: 10, marginTop: "4px", width: "100%",
                background: "white", border: "1.5px solid #e5e7eb", borderRadius: "8px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)", maxHeight: "256px", overflowY: "auto",
                listStyle: "none", padding: 0, margin: 0,
              }}>
                {canEdit && (
                  <li>
                    <button type="button" onClick={() => selectClient(null)} style={{
                      width: "100%", textAlign: "right", padding: "10px 12px", fontSize: "13px",
                      fontWeight: 600, color: "#0F6E56", background: "transparent", border: "none",
                      borderBottom: "1px solid #f3f4f6", cursor: "pointer", fontFamily: "inherit",
                    }}>+ לקוח חדש</button>
                  </li>
                )}
                {clients.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => selectClient(c)} style={{
                      width: "100%", textAlign: "right", padding: "10px 12px", fontSize: "13px",
                      background: c.id === selectedId ? "#e8f0e9" : "transparent", border: "none",
                      borderBottom: "1px solid #f9fafb", cursor: "pointer", fontFamily: "inherit", color: "#1a2744",
                    }}>{c.name}</button>
                  </li>
                ))}
                {clients.length === 0 && (
                  <li style={{ padding: "12px", fontSize: "13px", color: "#9ca3af", textAlign: "center" }}>אין לקוחות במערכת</li>
                )}
              </ul>
            </>
          )}
        </div>
      </Card>

      {(selectedClient || isNew) && (
        <>
          <Card>
            <SectionHeader label={isNew ? "ב. לקוח חדש" : "ב. עדכון פרטי לקוח"} />
            <form onSubmit={handleSaveClient}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <FieldLabel req>שם לקוח / חברה</FieldLabel>
                  <input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} required
                    style={{ ...inputStyle, ...(!canEdit ? { background: "#f8fafc", color: "#6b7280" } : {}) }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#93c5fd"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }} />
                </div>
                <div>
                  <FieldLabel req>כתובת</FieldLabel>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} disabled={!canEdit} required
                    style={{ ...inputStyle, ...(!canEdit ? { background: "#f8fafc", color: "#6b7280" } : {}) }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#93c5fd"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }} />
                </div>
              </div>
              <div style={{ marginBottom: "12px" }}>
                <FieldLabel req>פרטי קשר</FieldLabel>
                <input value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} disabled={!canEdit} required
                  style={{ ...inputStyle, ...(!canEdit ? { background: "#f8fafc", color: "#6b7280" } : {}) }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#93c5fd"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }} />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <FieldLabel>הערות</FieldLabel>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} rows={2}
                  style={{ ...inputStyle, resize: "vertical", minHeight: "60px", ...(!canEdit ? { background: "#f8fafc", color: "#6b7280" } : {}) }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#93c5fd"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }} />
              </div>
              {canEdit && (
                <button type="submit" disabled={loading} style={{
                  background: loading ? "#9ca3af" : "#1B3A2B", color: "white", border: "none",
                  borderRadius: "8px", padding: "10px 20px", fontSize: "14px", fontWeight: 700,
                  fontFamily: "inherit", cursor: loading ? "not-allowed" : "pointer",
                }}>
                  {loading ? "שומר..." : isNew ? "צור לקוח" : "שמור שינויים"}
                </button>
              )}
            </form>
          </Card>

          {!isNew && selectedClient && (
            <>
              <Card>
                <SectionHeader label="אנשי קשר" />
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "420px" }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>שם</th>
                        <th style={thStyle}>טלפון</th>
                        <th style={thStyle}>תפקיד</th>
                        {canEdit && <th style={{ ...thStyle, width: "60px", textAlign: "center" }}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedClient.contacts.map((ct) => (
                        <tr key={ct.id}>
                          <td style={tdStyle}>{ct.name}</td>
                          <td style={tdMuted}>{ct.phone ?? "—"}</td>
                          <td style={tdMuted}>{ct.role ?? "—"}</td>
                          {canEdit && (
                            <td style={{ ...tdStyle, textAlign: "center" }}>
                              <button type="button" onClick={() => setConfirmDeleteContact(ct)}
                                style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontSize: "12px", fontFamily: "inherit" }}>
                                מחיקה
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {selectedClient.contacts.length === 0 && (
                        <tr><td colSpan={4} style={{ padding: "12px 10px", color: "#9ca3af", fontSize: "12px", textAlign: "center", fontStyle: "italic" }}>אין אנשי קשר</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {canEdit && (
                  <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #f3f4f6" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: "8px", alignItems: "end" }}>
                      <div>
                        <FieldLabel>שם איש קשר</FieldLabel>
                        <input placeholder="שם" value={newContact.name}
                          onChange={(e) => setNewContact((s) => ({ ...s, name: e.target.value }))} style={inputStyle}
                          onFocus={(e) => { e.currentTarget.style.borderColor = "#93c5fd"; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }} />
                      </div>
                      <div>
                        <FieldLabel>טלפון</FieldLabel>
                        <input placeholder="טלפון" value={newContact.phone}
                          onChange={(e) => setNewContact((s) => ({ ...s, phone: e.target.value }))} style={inputStyle}
                          onFocus={(e) => { e.currentTarget.style.borderColor = "#93c5fd"; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }} />
                      </div>
                      <div>
                        <FieldLabel>תפקיד</FieldLabel>
                        <input placeholder="תפקיד" value={newContact.role}
                          onChange={(e) => setNewContact((s) => ({ ...s, role: e.target.value }))} style={inputStyle}
                          onFocus={(e) => { e.currentTarget.style.borderColor = "#93c5fd"; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }} />
                      </div>
                      <button type="button" onClick={handleAddContact} disabled={loading}
                        style={{ background: "#1B3A2B", color: "white", border: "none", borderRadius: "8px", padding: "9px 16px", fontSize: "13px", fontWeight: 600, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" }}>
                        הוספה
                      </button>
                    </div>
                  </div>
                )}
              </Card>

              <Card>
                <SectionHeader label="מובילים משויכים ללקוח" />
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "520px" }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>שם המוביל</th>
                        <th style={thStyle}>מספר רישוי</th>
                        <th style={thStyle}>פרטי רכב</th>
                        <th style={thStyle}>טלפון נהג</th>
                        {canEdit && <th style={{ ...thStyle, width: "70px", textAlign: "center" }}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedClient.carriers.map((cr) => (
                        <tr key={cr.id}>
                          <td style={tdStyle}>{cr.name}</td>
                          <td style={tdMuted}>{cr.licensePlate ?? "—"}</td>
                          <td style={tdMuted}>{cr.vehicleDetails ?? "—"}</td>
                          <td style={tdMuted}>{cr.driverPhone ?? "—"}</td>
                          {canEdit && (
                            <td style={{ ...tdStyle, textAlign: "center" }}>
                              <button type="button" onClick={() => setConfirmUnlinkCarrier(cr)}
                                style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontSize: "12px", fontFamily: "inherit" }}>
                                הסרת שיוך
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {selectedClient.carriers.length === 0 && (
                        <tr><td colSpan={5} style={{ padding: "12px 10px", color: "#9ca3af", fontSize: "12px", textAlign: "center", fontStyle: "italic" }}>אין מובילים משויכים</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {canEdit && (
                  <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #f3f4f6" }}>
                    <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                      <select value={linkCarrierId} onChange={(e) => setLinkCarrierId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                        <option value="">בחר מוביל קיים לשיוך...</option>
                        {availableCarriers.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}{c.licensePlate ? ` (${c.licensePlate})` : ""}</option>
                        ))}
                      </select>
                      <button type="button" onClick={handleLinkCarrier} disabled={loading || !linkCarrierId}
                        style={{ background: !linkCarrierId ? "#9ca3af" : "#1B3A2B", color: "white", border: "none", borderRadius: "8px", padding: "9px 16px", fontSize: "13px", fontWeight: 600, fontFamily: "inherit", cursor: !linkCarrierId ? "not-allowed" : "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                        שיוך מוביל
                      </button>
                    </div>
                    <button type="button" onClick={() => setNewCarrierOpen((o) => !o)}
                      style={{ color: "#0F6E56", fontSize: "13px", fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: newCarrierOpen ? "10px" : 0 }}>
                      {newCarrierOpen ? "ביטול" : "+ מוביל חדש"}
                    </button>
                    {newCarrierOpen && (
                      <div style={{ background: "#f9fafb", borderRadius: "8px", padding: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <div>
                          <FieldLabel req>שם המוביל</FieldLabel>
                          <input placeholder="שם המוביל" value={newCarrier.name}
                            onChange={(e) => setNewCarrier((s) => ({ ...s, name: e.target.value }))} style={inputStyle}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "#93c5fd"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }} />
                        </div>
                        <div>
                          <FieldLabel>מספר רישוי</FieldLabel>
                          <input placeholder="מספר רישוי" value={newCarrier.licensePlate}
                            onChange={(e) => setNewCarrier((s) => ({ ...s, licensePlate: e.target.value }))} style={inputStyle}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "#93c5fd"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }} />
                        </div>
                        <div>
                          <FieldLabel>פרטי רכב</FieldLabel>
                          <input placeholder="פרטי רכב" value={newCarrier.vehicleDetails}
                            onChange={(e) => setNewCarrier((s) => ({ ...s, vehicleDetails: e.target.value }))} style={inputStyle}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "#93c5fd"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }} />
                        </div>
                        <div>
                          <FieldLabel>טלפון נהג</FieldLabel>
                          <input placeholder="טלפון נהג" value={newCarrier.driverPhone}
                            onChange={(e) => setNewCarrier((s) => ({ ...s, driverPhone: e.target.value }))} style={inputStyle}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "#93c5fd"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }} />
                        </div>
                        <button type="button" onClick={handleCreateAndLinkCarrier} disabled={loading}
                          style={{ gridColumn: "1 / -1", background: "#1B3A2B", color: "white", border: "none", borderRadius: "8px", padding: "10px", fontSize: "14px", fontWeight: 700, fontFamily: "inherit", cursor: loading ? "not-allowed" : "pointer" }}>
                          יצירה ושיוך
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!confirmDeleteContact}
        icon="🗑️"
        title="אישור מחיקת איש קשר"
        rows={[
          { label: "שם", value: confirmDeleteContact?.name ?? "—" },
          { label: "תפקיד", value: confirmDeleteContact?.role ?? "—" },
        ]}
        confirmLabel="מחיקה"
        loading={loading}
        onConfirm={confirmDeactivateContact}
        onCancel={() => setConfirmDeleteContact(null)}
      />

      <ConfirmDialog
        open={!!confirmUnlinkCarrier}
        icon="🚚"
        title="אישור הסרת שיוך מוביל"
        rows={[
          { label: "שם המוביל", value: confirmUnlinkCarrier?.name ?? "—" },
          { label: "מספר רישוי", value: confirmUnlinkCarrier?.licensePlate ?? "—" },
        ]}
        confirmLabel="הסרה"
        loading={loading}
        onConfirm={confirmUnlink}
        onCancel={() => setConfirmUnlinkCarrier(null)}
      />
    </div>
  );
}
