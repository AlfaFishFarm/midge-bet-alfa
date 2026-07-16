import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";

/**
 * GET /api/pond-status?date=YYYY-MM-DD&fishStrainId=...&stageId=...
 *
 * Returns computed fish inventory per (pond, fishStrain) combination,
 * calculated from:
 *   - FishTransferDetails (incoming to pond and outgoing from pond)
 *   - FishTransferHeader.transferType = "תמותה" rows (mortality)
 *   - FishWeighingHeader (last weighing date + avg weight)
 *
 * Spec (v5): aggregate from FishTransferDetails + FishDeathDetails + FishSwitching.
 * We use FishTransferDetail where destPondId = pond for incoming,
 * and FishTransferDetail where sourcePond (via header) = pond for outgoing.
 * תמותה transfers: header.transferType = "תמותה" — treated as outgoing.
 */

export const GET = withModuleAccess(
  "תפעול",
  AccessLevel.VIEW_ONLY,
  async (req: NextRequest) => {
    const { searchParams } = req.nextUrl;
    const dateParam = searchParams.get("date");
    const fishStrainId = searchParams.get("fishStrainId") || undefined;

    // Default date = today (start of day in Israel time, but we use UTC midnight)
    const asOf = dateParam ? new Date(dateParam + "T23:59:59.999Z") : new Date();

    // 1. Get all open (or closed-after-asOf) growth cycles up to asOf
    const cycles = await prisma.growthCycle.findMany({
      where: {
        openedAt: { lte: asOf },
        OR: [{ closedAt: null }, { closedAt: { gt: asOf } }],
      },
      include: {
        pond: { select: { id: true, name: true, code: true, areaDunam: true } },
      },
    });

    if (cycles.length === 0) return NextResponse.json([]);

    const cycleIds = cycles.map((c) => c.id);
    const pondCycleMap = new Map(cycles.map((c) => [c.pondId, c]));

    // 2. All transfer details up to asOf for these cycles
    const allDetails = await prisma.fishTransferDetail.findMany({
      where: {
        header: {
          cycleId: { in: cycleIds },
          transferDate: { lte: asOf },
          status: { not: "מחיקה" },
        },
        ...(fishStrainId ? { fishStrainId } : {}),
      },
      include: {
        header: { select: { transferType: true, sourcePondId: true, cycleId: true } },
        fishStrain: { select: { id: true, latinName: true, englishName: true } },
        destPond: { select: { id: true } },
        populationCode: { select: { code: true } },
      },
    });

    // 3. Last weighing per (pond, fishStrain) — for avg weight display
    const weighings = await prisma.fishWeighingHeader.findMany({
      where: {
        cycleId: { in: cycleIds },
        date: { lte: asOf },
      },
      include: {
        baskets: true,
        transferDetail: { select: { fishStrainId: true } },
      },
      orderBy: { date: "desc" },
    });

    // Build a map of last weighing per (pondId, fishStrainId)
    const lastWeighing = new Map<string, { date: Date; avgWeightGrams: number }>();
    for (const w of weighings) {
      const strainId = w.transferDetail?.fishStrainId;
      if (!strainId || !w.pondId) continue;
      const key = `${w.pondId}:${strainId}`;
      if (lastWeighing.has(key)) continue; // already have a newer one (ordered desc)
      // compute weighted avg from baskets
      let totalFish = 0;
      let totalWeightGrams = 0;
      for (const b of w.baskets) {
        const netWeight = b.weightWithFish - b.emptyWetWeight;
        totalFish += b.fishCount;
        totalWeightGrams += netWeight;
      }
      if (totalFish > 0) {
        lastWeighing.set(key, { date: w.date, avgWeightGrams: totalWeightGrams / totalFish });
      }
    }

    // 4. Aggregate fish count per (pondId, fishStrainId)
    type PondFishKey = string; // `${pondId}:${fishStrainId}`
    const inventory = new Map<
      PondFishKey,
      {
        pondId: string;
        pondName: string;
        pondCode: string | null;
        areaDunam: number | null;
        cycleId: string;
        priorityCycleCode: string | null;
        openedAt: Date;
        fishStrainId: string;
        fishStrainName: string;
        populationStage: string | null;
        incoming: number;
        outgoing: number;
      }
    >();

    for (const d of allDetails) {
      const cycle = cycles.find((c) => c.id === d.header.cycleId);
      if (!cycle) continue;
      const transferType = d.header.transferType;
      const sourcePondId = d.header.sourcePondId;

      // INCOMING: this detail's destPond is a pond we're tracking
      const destCycle = pondCycleMap.get(d.destPondId);
      if (destCycle && transferType !== "תמותה") {
        const key: PondFishKey = `${d.destPondId}:${d.fishStrainId}`;
        const existing = inventory.get(key);
        const count = d.fishCount ?? 0;
        if (existing) {
          existing.incoming += count;
        } else {
          inventory.set(key, {
            pondId: d.destPondId,
            pondName: destCycle.pond.name,
            pondCode: destCycle.pond.code,
            areaDunam: destCycle.pond.areaDunam ?? null,
            cycleId: destCycle.id,
            priorityCycleCode: destCycle.priorityCycleCode,
            openedAt: destCycle.openedAt,
            fishStrainId: d.fishStrainId,
            fishStrainName: d.fishStrain.latinName,
            populationStage: d.populationCode?.code ?? null,
            incoming: count,
            outgoing: 0,
          });
        }
      }

      // OUTGOING: this detail's sourcePond is a pond we're tracking
      const srcCycle = pondCycleMap.get(sourcePondId);
      if (srcCycle) {
        const key: PondFishKey = `${sourcePondId}:${d.fishStrainId}`;
        const existing = inventory.get(key);
        const count = d.fishCount ?? 0;
        if (existing) {
          existing.outgoing += count;
        } else {
          // Edge case: fish were transferred out but never recorded as incoming (shouldn't happen normally)
          inventory.set(key, {
            pondId: sourcePondId,
            pondName: srcCycle.pond.name,
            pondCode: srcCycle.pond.code,
            areaDunam: srcCycle.pond.areaDunam ?? null,
            cycleId: srcCycle.id,
            priorityCycleCode: srcCycle.priorityCycleCode,
            openedAt: srcCycle.openedAt,
            fishStrainId: d.fishStrainId,
            fishStrainName: d.fishStrain.latinName,
            populationStage: d.populationCode?.code ?? null,
            incoming: 0,
            outgoing: count,
          });
        }
      }
    }

    // 5. Build result rows
    const rows = Array.from(inventory.values()).map((inv) => {
      const fishCount = Math.max(0, inv.incoming - inv.outgoing);
      const weighKey = `${inv.pondId}:${inv.fishStrainId}`;
      const wData = lastWeighing.get(weighKey);
      const avgWeightGrams = wData?.avgWeightGrams ?? null;
      const lastWeighingDate = wData?.date ?? null;
      const biomassKg = fishCount > 0 && avgWeightGrams ? (fishCount * avgWeightGrams) / 1000 : null;
      const areaDunam = inv.areaDunam ?? null;
      const densityPerDunam = areaDunam && fishCount > 0 ? fishCount / areaDunam : null;
      const loadKgPerDunam = areaDunam && biomassKg ? biomassKg / areaDunam : null;

      // Cycle code = pondCode + openedAt date (no time)
      const dateStr = inv.openedAt.toISOString().slice(0, 10).replace(/-/g, "");
      const cycleCode = `${inv.pondCode ?? inv.pondId}-${dateStr}`;

      const growthDays = Math.floor(
        (asOf.getTime() - inv.openedAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        pondId: inv.pondId,
        pondName: inv.pondName,
        pondCode: inv.pondCode,
        areaDunam,
        cycleId: inv.cycleId,
        cycleCode,
        priorityCycleCode: inv.priorityCycleCode,
        openedAt: inv.openedAt,
        growthDays,
        fishStrainId: inv.fishStrainId,
        fishStrainName: inv.fishStrainName,
        populationStage: inv.populationStage,
        fishCount,
        avgWeightGrams,
        lastWeighingDate,
        biomassKg,
        densityPerDunam,
        loadKgPerDunam,
      };
    });

    // Sort by pondName then fishStrainName
    rows.sort((a, b) => a.pondName.localeCompare(b.pondName, "he") || a.fishStrainName.localeCompare(b.fishStrainName));

    return NextResponse.json(rows);
  }
);
