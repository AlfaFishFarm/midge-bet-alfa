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

  const [clients, workers, carriers, openCycles, fishStrains] = await Promise.all([
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
    // Spec p32 (manual mode): choose pond first, then fish type from a list —
    // ponds with an open growth cycle only.
    prisma.growthCycle.findMany({
      where: { closedAt: null },
      select: {
        pondId: true,
        openedAt: true,
        pond: { select: { id: true, code: true, name: true, pondType: { select: { name: true } } } },
      },
    }),
    prisma.fishStrain.findMany({ orderBy: { latinName: "asc" }, select: { id: true, englishName: true, latinName: true } }),
  ]);

  // Real (non-virtual, non-בור) ponds with an open cycle, for the manual-mode pond picker.
  const realOpenCycles = openCycles.filter(
    (c) => !c.pond.pondType.name.includes("וירטואלית") && c.pond.pondType.name !== "בור"
  );
  const openPonds = realOpenCycles
    .map((c) => ({ id: c.pond.id, code: c.pond.code ?? "", name: c.pond.name }))
    .sort((a, b) => a.code.localeCompare(b.code, "he"));

  // Per-pond fish strains recorded in the CURRENT open cycle (transfers whose
  // destination is the pond, on/after the cycle's open day) — drives the spec-p32
  // "fish not registered as grown in this pond" warning.
  const openPondIds = realOpenCycles.map((c) => c.pondId);
  const incomingDetails = openPondIds.length
    ? await prisma.fishTransferDetail.findMany({
        where: {
          destPondId: { in: openPondIds },
          header: { transferType: { in: ["קניה", "דילול", "פירוק"] } },
        },
        select: {
          destPondId: true,
          fishStrainId: true,
          header: { select: { transferDate: true } },
        },
      })
    : [];
  const openDayByPond = new Map(
    realOpenCycles.map((c) => {
      const d = new Date(c.openedAt);
      d.setHours(0, 0, 0, 0);
      return [c.pondId, d] as const;
    })
  );
  const pondFish: Record<string, string[]> = {};
  for (const d of incomingDetails) {
    const openDay = openDayByPond.get(d.destPondId);
    if (!openDay || d.header.transferDate < openDay) continue;
    (pondFish[d.destPondId] ??= []).push(d.fishStrainId);
  }
  for (const k of Object.keys(pondFish)) pondFish[k] = [...new Set(pondFish[k])];

  const serializedFishStrains = fishStrains.map((f) => ({
    id: f.id,
    label: f.englishName || f.latinName,
  }));

  // Match the current user to a Worker record via userAccountId
  const currentWorker = workers.find((w) => w.userAccountId === user.id) ?? null;

  // Load existing delivery if editing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let existingDelivery: any = null;
  if (deliveryId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await (prisma.delivery as any).findUnique({
      where: { id: deliveryId },
      include: { details: true, client: true },
    });
    if (raw) {
      // Serialize Date → ISO string so client component receives a plain string.
      // Strip pdfBlob — the stored certificate PDF (spec p32) must not be
      // shipped as a client-component prop.
      const { pdfBlob: _pdfBlob, ...rawRest } = raw;
      existingDelivery = {
        ...rawRest,
        date: raw.date instanceof Date
          ? raw.date.toISOString().slice(0, 10)
          : String(raw.date).slice(0, 10),
      };
    }
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
          openPonds={openPonds}
          pondFish={pondFish}
          fishStrains={serializedFishStrains}
        />
      </div>
    </div>
  );
}
