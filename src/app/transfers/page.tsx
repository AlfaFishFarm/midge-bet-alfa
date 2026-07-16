import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { bestAccessForModule, meetsRequirement, AccessLevel } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import TransfersListClient, { TransferRow } from "./TransfersListClient";

export default async function TransfersPage() {
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

  const canCreate = meetsRequirement(level, AccessLevel.OPERATIONS);

  // Fetch all transfer details (one row per detail in the prototype list).
  // Limit to 500 most recent headers to keep the query fast; filtering by date
  // happens client-side from these rows.
  const details = await prisma.fishTransferDetail.findMany({
    include: {
      header: {
        select: {
          id: true,
          transferType: true,
          transferDate: true,
          sourcePond: { select: { id: true, name: true } },
        },
      },
      fishStrain: { select: { latinName: true } },
      destPond: { select: { id: true, name: true } },
      populationCode: { select: { code: true } },
      transferMeans: {
        select: {
          meansType: true,
          externalVehicleCode: true,
          internalTank: { select: { code: true } },
        },
      },
      weighings: {
        select: {
          staffName: true,
          baskets: { select: { id: true } },
        },
        take: 1,
      },
    },
    orderBy: {
      header: { transferDate: "desc" },
    },
    take: 500,
  });

  // Build distinct source-pond + dest-pond + fish lists for filter dropdowns
  const srcPondMap = new Map<string, string>();
  const destPondMap = new Map<string, string>();
  const fishSet = new Set<string>();

  const rows: TransferRow[] = details.map((d) => {
    const transferDate = new Date(d.header.transferDate);
    const dateISO = `${transferDate.getFullYear()}-${String(transferDate.getMonth() + 1).padStart(2, "0")}-${String(transferDate.getDate()).padStart(2, "0")}`;

    const fishName = d.fishStrain.latinName;

    const srcId = d.header.sourcePond.id;
    const srcName = d.header.sourcePond.name;
    srcPondMap.set(srcId, srcName);

    const destId = d.destPond.id;
    const destName = d.destPond.name;
    destPondMap.set(destId, destName);

    fishSet.add(fishName);

    // Tank display: internal tank code or external vehicle code
    let tank = "—";
    if (d.transferMeans) {
      if (d.transferMeans.internalTank?.code) {
        tank = d.transferMeans.internalTank.code;
      } else if (d.transferMeans.externalVehicleCode) {
        tank = d.transferMeans.externalVehicleCode;
      }
    }

    // Basket count: number of baskets in the first weighing for this detail
    const basketCount = d.weighings[0]?.baskets?.length ?? null;

    // Staff name from the linked weighing
    const staffName = d.weighings[0]?.staffName ?? "";

    return {
      detailId: d.id,
      headerId: d.header.id,
      date: dateISO,
      action: d.header.transferType,
      fishName,
      srcPool: srcName,
      srcPoolId: srcId,
      destPool: destName,
      destPoolId: destId,
      tank,
      basketCount: basketCount > 0 ? basketCount : null,
      weight: d.totalWeightKg ?? null,
      count: d.fishCount ?? null,
      avg: d.avgWeightGrams ?? null,
      stage: d.populationCode?.code ?? "",
      staffName,
      notes: d.notes ?? "",
    };
  });

  const allSrcPonds = Array.from(srcPondMap.entries()).map(([id, name]) => ({ id, name }));
  const allDestPonds = Array.from(destPondMap.entries()).map(([id, name]) => ({ id, name }));
  const allFish = Array.from(fishSet).sort();

  return (
    <TransfersListClient
      rows={rows}
      canCreate={canCreate}
      allSrcPonds={allSrcPonds}
      allDestPonds={allDestPonds}
      allFish={allFish}
    />
  );
}
