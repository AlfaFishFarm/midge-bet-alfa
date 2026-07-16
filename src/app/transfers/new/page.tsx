import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { bestAccessForModule, meetsRequirement, AccessLevel } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { isVirtualPondType } from "@/lib/cycles";
import NewTransferForm from "./NewTransferForm";

export default async function NewTransferPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const level = bestAccessForModule(user.permissions, "תפעול");
  if (!meetsRequirement(level, AccessLevel.OPERATIONS)) {
    return (
      <main className="p-6">
        <p className="text-red-600">אין לך הרשאה ליצור העברות.</p>
      </main>
    );
  }

  const [
    pondsRaw, suppliers, existingDrafts,
    populationCodes, weightTypes, tanks, fishStrains, virtualPond, shivukPond,
  ] = await Promise.all([
    // Single richer pond query — includes pondType + active-cycle status.
    prisma.pond.findMany({
      include: {
        pondType: { select: { name: true } },
        growthCycles: { where: { closedAt: null }, select: { id: true, openedAt: true }, take: 1 },
      },
      orderBy: [{ code: "asc" }, { name: "asc" }],
    }),
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.fishTransferHeader.findMany({
      where: { status: "טיוטא" },
      include: { sourcePond: { select: { id: true, name: true } } },
      orderBy: { transferDate: "desc" },
      take: 20,
    }),
    prisma.populationCode.findMany({ orderBy: { code: "asc" } }),
    prisma.weightType.findMany({ orderBy: { name: "asc" } }),
    prisma.tank.findMany({ select: { id: true, code: true }, orderBy: { code: "asc" } }),
    prisma.fishStrain.findMany({ orderBy: { latinName: "asc" } }),
    prisma.pond.findFirst({ where: { pondType: { name: { contains: "וירטואלית" } } } }),
    prisma.pond.findFirst({ where: { pondType: { name: "מחסן שיווק" } } }),
  ]);

  const allPonds = pondsRaw.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    pondTypeName: p.pondType.name,
    hasActiveCycle: p.growthCycles.length > 0,
    activeCycleCode: p.growthCycles[0] ? computeCycleCode(p.code, p.growthCycles[0].openedAt) : null,
  }));

  const physicalPonds = allPonds.filter((p) => !isVirtualPondType(p.pondTypeName));

  return (
    <NewTransferForm
      ponds={physicalPonds}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
      existingDrafts={existingDrafts.map((d) => ({
        id: d.id,
        transferType: d.transferType,
        transferDate: d.transferDate.toISOString(),
        sourcePondId: d.sourcePond.id,
        sourcePondName: d.sourcePond.name,
      }))}
      fishStrains={fishStrains}
      allPonds={allPonds}
      populationCodes={populationCodes}
      weightTypes={weightTypes}
      tanks={tanks}
      virtualPondId={virtualPond?.id ?? ""}
      shivukPondId={shivukPond?.id ?? ""}
    />
  );
}

// Mirrors the helper used in /transfers/[id]/page.tsx and /transfers/page.tsx.
function computeCycleCode(pondCode: string | null, openedAt: Date): string {
  const d = new Date(openedAt);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return pondCode ? `${pondCode}-${yyyy}${mm}${dd}` : `${yyyy}${mm}${dd}`;
}
