import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { bestAccessForModule, meetsRequirement, AccessLevel } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import WeighingsClient from "./WeighingsClient";

export default async function WeighingsPage() {
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

  const include = {
    pond: { select: { id: true, code: true, name: true } },
    weightType: { select: { id: true, name: true } },
    cycle: { select: { id: true, priorityCycleCode: true, openedAt: true } },
    baskets: {
      select: {
        id: true,
        basketSeq: true,
        emptyWetWeight: true,
        weightWithFish: true,
        fishCount: true,
      },
      orderBy: { basketSeq: "asc" as const },
    },
  };

  const [fieldWeighings, netWeighings, weightTypes, pondsRaw] = await Promise.all([
    prisma.fishWeighingHeader.findMany({
      where: { weightType: { name: { contains: "שטח" } } },
      include,
      orderBy: { date: "desc" },
      take: 200,
    }),
    prisma.fishWeighingHeader.findMany({
      where: { weightType: { name: { contains: "רשת" } } },
      include,
      orderBy: { date: "desc" },
      take: 200,
    }),
    prisma.weightType.findMany({ orderBy: { name: "asc" } }),
    prisma.pond.findMany({
      include: {
        growthCycles: {
          where: { closedAt: null },
          select: { id: true, priorityCycleCode: true },
          take: 1,
        },
      },
      orderBy: [{ code: "asc" }, { name: "asc" }],
    }),
  ]);

  function serialize(rows: typeof fieldWeighings) {
    return rows.map((w) => ({
      ...w,
      date: w.date.toISOString(),
      cycle: w.cycle
        ? { ...w.cycle, openedAt: w.cycle.openedAt.toISOString() }
        : null,
    }));
  }

  const ponds = pondsRaw.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    hasActiveCycle: p.growthCycles.length > 0,
    activeCycleCode: p.growthCycles[0]?.priorityCycleCode ?? null,
  }));

  return (
    /* Full-screen layout — no padding, matches prototype weighing-form-screen */
    <main style={{ overflow: "hidden" }}>
      <WeighingsClient
        initialFieldWeighings={serialize(fieldWeighings)}
        initialNetWeighings={serialize(netWeighings)}
        weightTypes={weightTypes}
        ponds={ponds}
        canCreate={canCreate}
      />
    </main>
  );
}
