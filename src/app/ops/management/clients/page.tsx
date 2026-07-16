import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { bestAccessForModule, meetsRequirement, AccessLevel } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import ClientsClient from "./ClientsClient";

// "ניהול לקוחות" tile on /ops/management. Built 2026-06-24 per spec pages
// 10-13 (חלק א: בחירת לקוח, חלק ב: עדכון פרטי לקוח + אנשי קשר + מובילים
// משויכים). Spec: "זמין לצפיה לכל המנהלים - אך רק למנהלי תחום ואדמיניסטרציה
// יש אפשרות לעדכן פרטים". Fixed 2026-06-27: read stays at VIEW_ONLY, write
// tightened from OPERATIONS to DOMAIN_MANAGE.
// Visual pass 2026-07-02: page uses #F2EDE3 background + max-width 680px,
// matching the delivery-cert-screen pattern from the prototype.
export default async function ClientsManagementPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const level = bestAccessForModule(user.permissions, "תפעול");
  if (!meetsRequirement(level, AccessLevel.VIEW_ONLY)) {
    return (
      <main className="p-6">
        <p className="text-red-600">אין לך הרשאה לצפות בעמוד זה.</p>
      </main>
    );
  }
  const canEdit = meetsRequirement(level, AccessLevel.DOMAIN_MANAGE);

  const [clientsRaw, allCarriers] = await Promise.all([
    prisma.client.findMany({
      include: {
        contacts: { where: { active: true }, orderBy: { name: "asc" } },
        carriers: { include: { carrier: true }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.carrier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const clients = clientsRaw.map((c) => ({
    id: c.id,
    name: c.name,
    address: c.address,
    contactInfo: c.contactInfo,
    notes: c.notes,
    contacts: c.contacts.map((ct) => ({
      id: ct.id,
      name: ct.name,
      phone: ct.phone,
      role: ct.role,
    })),
    carriers: c.carriers
      .filter((cc) => cc.carrier.active)
      .map((cc) => ({
        id: cc.carrier.id,
        name: cc.carrier.name,
        licensePlate: cc.carrier.licensePlate,
        vehicleDetails: cc.carrier.vehicleDetails,
        driverPhone: cc.carrier.driverPhone,
      })),
  }));

  const carrierOptions = allCarriers.map((c) => ({
    id: c.id,
    name: c.name,
    licensePlate: c.licensePlate,
  }));

  return (
    // Prototype: .form-screen { background:#F2EDE3 } / .form-screen-inner { max-width:680px; padding:20px 16px 44px }
    <div style={{ background: "#F2EDE3", minHeight: "calc(100vh - 54px)" }} dir="rtl">
      <div style={{ flex: 1, padding: "20px 16px 44px", maxWidth: "680px", margin: "0 auto", width: "100%" }}>
        <ClientsClient clients={clients} carrierOptions={carrierOptions} canEdit={canEdit} />
      </div>
    </div>
  );
}
