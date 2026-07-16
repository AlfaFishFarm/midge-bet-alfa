import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { bestAccessForModule, meetsRequirement, AccessLevel } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { isVirtualPondType, getCycleFishBalance } from "@/lib/cycles";
import ClosePoolClient from "./ClosePoolClient";

export default async function ClosePoolPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const level = bestAccessForModule(user.permissions, "תפעול");
  if (!meetsRequirement(level, AccessLevel.EXECUTIVE)) {
    return (
      <main className="p-6">
        <p className="text-red-600">אין לך הרשאה לסגור מחזורי גידול.</p>
      </main>
    );
  }

  const pondsRaw = await prisma.pond.findMany({
    include: {
      pondType: true,
      growthCycles: {
        orderBy: { openedAt: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const openCyclesWithoutPriority = await prisma.growthCycle.count({
    where: {
      closedAt: null,
      priorityCycleCode: null,
    },
  });
  const anyMissingPriority = openCyclesWithoutPriority > 0;

  const ponds = await Promise.all(
    pondsRaw
      .filter((p) => !isVirtualPondType(p.pondType.name))
      .map(async (p) => {
        const openCycle = p.growthCycles.find((c) => c.closedAt === null) ?? null;
        const lastClosedCycle = p.growthCycles.find((c) => c.closedAt !== null) ?? null;

        if (!openCycle && !lastClosedCycle) {
          return {
            id: p.id,
            name: p.name,
            code: p.code,
            status: "noCycle" as const,
            openCycleOpenedAt: null as string | null,
            lastClosedCycleClosedAt: null as string | null,
            cycle: null,
          };
        }

        if (openCycle) {
          const balance = await getCycleFishBalance(openCycle.id);
          return {
            id: p.id,
            name: p.name,
            code: p.code,
            status: "open" as const,
            openCycleOpenedAt: openCycle.openedAt.toISOString(),
            lastClosedCycleClosedAt: lastClosedCycle
              ? lastClosedCycle.closedAt!.toISOString()
              : null,
            cycle: {
              id: openCycle.id,
              priorityCycleCode: openCycle.priorityCycleCode,
              openedAt: openCycle.openedAt.toISOString(),
              closedAt: null,
              closeNotes: null,
              balance: {
                incoming: balance.incoming,
                outgoing: balance.outgoing,
                mortality: balance.mortality,
                difference: balance.difference,
                withinTolerance: balance.withinTolerance,
              },
            },
          };
        }

        const closed = lastClosedCycle!;
        return {
          id: p.id,
          name: p.name,
          code: p.code,
          status: "closed" as const,
          openCycleOpenedAt: null as string | null,
          lastClosedCycleClosedAt: closed.closedAt!.toISOString(),
          cycle: {
            id: closed.id,
            priorityCycleCode: closed.priorityCycleCode,
            openedAt: closed.openedAt.toISOString(),
            closedAt: closed.closedAt!.toISOString(),
            closeNotes: closed.closeNotes,
            balance: null,
          },
        };
      })
  );

  return (
    // Prototype: .form-screen { background: #F2EDE3; min-height: calc(100vh - 54px) }
    <main style={{ background: "#F2EDE3", minHeight: "calc(100vh - 54px)" }}>
      <ClosePoolClient ponds={ponds} anyMissingPriority={anyMissingPriority} />
    </main>
  );
}
