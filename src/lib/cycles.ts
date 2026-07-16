import { prisma } from "./db";
import { checkFishBalance, type FishBalanceResult } from "./business-rules";

/** The two virtual pond types are not real ponds and never carry a growth cycle. */
export function isVirtualPondType(pondTypeName: string): boolean {
  return pondTypeName.includes("וירטואלית");
}

/** Spec convention: a cycle's user-facing label is "<pond code> <open date>" so it's
 * unambiguous which physical cycle is being referred to across screens. */
export function formatCycleLabel(pondCode: string | null, openedAt: Date): string {
  const date = openedAt.toLocaleDateString("he-IL");
  return pondCode ? `${pondCode} ${date}` : date;
}

/**
 * Fish balance for a cycle, per מסמך אפיון מודול תפעול בריכות "סגירת מחזור גידול":
 * incoming = קניה transfers into this cycle's pond.
 * outgoing = דילול/פירוק/שיווק transfers out of this cycle's pond.
 * mortality = תמותה records.
 * The ±100 tolerance check itself lives in business-rules.ts (shared with tests).
 */
export async function getCycleFishBalance(cycleId: string): Promise<
  FishBalanceResult & { incoming: number; outgoing: number; mortality: number }
> {
  const details = await prisma.fishTransferDetail.findMany({
    where: { header: { cycleId } },
    select: { fishCount: true, header: { select: { transferType: true } } },
  });

  let incoming = 0;
  let outgoing = 0;
  let mortality = 0;
  for (const d of details) {
    const count = d.fishCount ?? 0;
    switch (d.header.transferType) {
      case "קניה":
        incoming += count;
        break;
      case "דילול":
      case "פירוק":
      case "שיווק":
        outgoing += count;
        break;
      case "תמותה":
        mortality += count;
        break;
    }
  }

  const balance = checkFishBalance({ incoming, outgoing, mortality });
  return { ...balance, incoming, outgoing, mortality };
}

/** True if any reported transfer on this cycle falls before `date`. Used to block moving
 * a cycle's open date later than reports that already exist, per spec constraint. */
export async function hasTransfersBefore(cycleId: string, date: Date): Promise<boolean> {
  const count = await prisma.fishTransferHeader.count({
    where: { cycleId, transferDate: { lt: date } },
  });
  return count > 0;
}

/** True if any reported transfer on this cycle falls after `date`. Used to block closing
 * a cycle earlier than reports that already exist. */
export async function hasTransfersAfter(cycleId: string, date: Date): Promise<boolean> {
  const count = await prisma.fishTransferHeader.count({
    where: { cycleId, transferDate: { gt: date } },
  });
  return count > 0;
}

/** True if `pondId` has any cycle whose [openedAt, closedAt ?? now) range overlaps
 * [rangeStart, rangeEnd ?? now), excluding `excludeCycleId` (the cycle being edited). */
export async function hasOverlappingCycle(
  pondId: string,
  rangeStart: Date,
  rangeEnd: Date | null,
  excludeCycleId?: string
): Promise<boolean> {
  const others = await prisma.growthCycle.findMany({
    where: { pondId, ...(excludeCycleId ? { id: { not: excludeCycleId } } : {}) },
    select: { id: true, openedAt: true, closedAt: true },
  });
  const end = rangeEnd ?? new Date(8640000000000000); // open-ended -> "infinite" future
  for (const c of others) {
    const otherEnd = c.closedAt ?? new Date(8640000000000000);
    if (rangeStart < otherEnd && c.openedAt < end) return true;
  }
  return false;
}
