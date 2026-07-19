import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { bestAccessForModule, meetsRequirement, AccessLevel, hasManagerRole } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { isVirtualPondType } from "@/lib/cycles";
import OpenPoolClient from "./OpenPoolClient";

export default async function OpenPoolPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const level = bestAccessForModule(user.permissions, "תפעול");
  // Spec p24: screen access for manager-type roles incl. מנהל צופה (read-only view);
  // the open/close ACTIONS stay EXECUTIVE-gated in the API routes.
  if (!meetsRequirement(level, AccessLevel.EXECUTIVE) && !hasManagerRole(user.permissions, "תפעול")) {
    return (
      <main className="p-6">
        <p className="text-red-600">אין לך הרשאה לפתוח או לעדכן מחזורי גידול.</p>
      </main>
    );
  }

  const pondsRaw = await prisma.pond.findMany({
    include: {
      pondType: true,
      growthCycles: {
        where: { closedAt: null },
        orderBy: { openedAt: "desc" },
        take: 1,
        include: {
          _count: { select: { transfers: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const ponds = pondsRaw
    .filter((p) => !isVirtualPondType(p.pondType.name))
    .map((p) => {
      const openCycle = p.growthCycles[0] ?? null;
      return {
        id: p.id,
        name: p.name,
        code: p.code,
        openCycle: openCycle
          ? {
              id: openCycle.id,
              priorityCycleCode: openCycle.priorityCycleCode,
              openedAt: openCycle.openedAt.toISOString(),
              openNotes: openCycle.openNotes,
              hasTransfers: openCycle._count.transfers > 0,
            }
          : null,
      };
    });

  return (
    <main style={{ background: "#F2EDE3", minHeight: "calc(100vh - 54px)" }}>
      <OpenPoolClient ponds={ponds} />
    </main>
  );
}
