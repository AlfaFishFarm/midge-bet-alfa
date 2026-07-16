import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { bestAccessForModule, meetsRequirement, AccessLevel } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import DeliveryFormClient from "./DeliveryFormClient";

// הפקת תעודת משלוח — spec v4 p.1954-2135
// Accessible to workers + managers. Part D (sign/finalize) is manager-only.
// ?id=X   → edit existing draft
// ?view=1 → read-only view of a finalized certificate
export default async function DeliveryNewPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; view?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const level = bestAccessForModule(user.permissions, "תפעול");
  if (!meetsRequirement(level, AccessLevel.VIEW_ONLY)) {
    return (
      <main className="p-6" dir="rtl">
        <p className="text-red-600">אין לך הרשאה לגשת לעמוד זה.</p>
      </main>
    );
  }

  const { id: deliveryId, view } = await searchParams;
  const isManager = meetsRequirement(level, AccessLevel.DOMAIN_MANAGE);
  const viewOnly = view === "1";

  const [clients, workers, carriers] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, contactInfo: true },
    }),
    prisma.worker.findMany({
      where: { active: true },
      orderBy: [{ firstName: "asc" }],
      include: { workerRoles: { include: { role: true } } },
    }),
    prisma.carrier.findMany({
      where: { active: true },
      include: { clients: { select: { clientId: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  // Match the current user to a Worker record via userAccountId
  const currentWorker = workers.find((w) => w.userAccountId === user.id) ?? null;

  // Load existing delivery if editing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let existingDelivery: any = null;
  if (deliveryId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    existingDelivery = await (prisma.delivery as any).findUnique({
      where: { id: deliveryId },
      include: { details: true, client: true },
    });
  }

  const serializedWorkers = workers.map((w) => ({
    id: w.id,
    name: [w.firstName, w.lastName].filter(Boolean).join(" "),
    isManager: w.workerRoles.some(
      (wr) => wr.role.name.includes("מנהל") || wr.role.name.includes("הנהלה")
    ),
    hasSignature: !!(w as any).digitalSignature,
  }));

  const serializedCarriers = carriers.map((c) => ({
    id: c.id,
    name: c.name,
    licensePlate: c.licensePlate,
    driverPhone: c.driverPhone,
    clientIds: c.clients.map((cc) => cc.clientId),
  }));

  const serializedClients = clients.map((c) => ({
    id: c.id,
    name: c.name,
    contactInfo: c.contactInfo,
  }));

  return (
    <div style={{ background: "#F2EDE3", minHeight: "calc(100vh - 54px)" }} dir="rtl">
      <div style={{ padding: "20px 16px 60px", maxWidth: "760px", margin: "0 auto", width: "100%" }}>
        <DeliveryFormClient
          clients={serializedClients}
          workers={serializedWorkers}
          carriers={serializedCarriers}
          currentWorkerId={currentWorker?.id ?? null}
          isManager={isManager}
          existingDelivery={existingDelivery}
          viewOnly={viewOnly}
        />
      </div>
    </div>
  );
}
