import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { bestAccessForModule, meetsRequirement, AccessLevel, hasManagerRole } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import DeliveriesClient from "./DeliveriesClient";

// ניהול תעודות משלוח — spec v4 p.1318-1370
// Managers only (DOMAIN_MANAGE). Two tabs:
//   1. פתוחות  — status טיוטא → approve (→ /ops/deliveries/new?id=X) or cancel (→ מבוטל)
//   2. סגורות  — status הופק  → date-range filter, view or cancel
export default async function DeliveriesManagementPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const level = bestAccessForModule(user.permissions, "תפעול");
  // Spec p31: screen access for ניהול תחום + הנהלה + מנהל צופה (read) — i.e. any
  // manager-type role, at any level. Regular workers are blocked (Dean's ruling
  // 2026-07-19: "כמו באיפיון"). Action endpoints stay level-gated server-side.
  if (!meetsRequirement(level, AccessLevel.VIEW_ONLY) || !hasManagerRole(user.permissions, "תפעול")) {
    return (
      <main className="p-6" dir="rtl">
        <p className="text-red-600">אין לך הרשאה לצפות בעמוד זה. המסך זמין למנהלים בלבד.</p>
      </main>
    );
  }

  // Load open (draft) deliveries
  const openDeliveries = await prisma.delivery.findMany({
    where: { status: { in: ["טיוטא", "ממתין לאישור"] } },
    include: {
      client: { select: { id: true, name: true } },
      details: { select: { quantity: true } },
    },
    orderBy: { date: "desc" },
  });

  // Load closed deliveries for the past 7 days as initial data
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const closedDeliveries = await prisma.delivery.findMany({
    where: { status: "הופק", date: { gte: weekAgo } },
    include: {
      client: { select: { id: true, name: true } },
      details: { select: { quantity: true } },
    },
    orderBy: { date: "desc" },
  });

  function serializeDeliveries(
    deliveries: (typeof openDeliveries | typeof closedDeliveries)[number][]
  ) {
    return deliveries.map((d) => ({
      id: d.id,
      date: d.date.toISOString(),
      clientName: d.client?.name ?? (d as any).clientName ?? "לקוח מזדמן",
      totalQuantity: d.details.reduce((sum, det) => sum + det.quantity, 0),
      status: d.status,
    }));
  }

  return (
    <div style={{ background: "#F2EDE3", minHeight: "calc(100vh - 54px)" }} dir="rtl">
      <div style={{ padding: "20px 16px 44px", maxWidth: "900px", margin: "0 auto", width: "100%" }}>
        <DeliveriesClient
          initialOpen={serializeDeliveries(openDeliveries)}
          initialClosed={serializeDeliveries(closedDeliveries)}
        />
      </div>
    </div>
  );
}
