import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";

function strainLabel(s: { englishName: string | null; latinName: string }) {
  return s.englishName ?? s.latinName;
}

function computeCycleCode(pondCode: string | null, openedAt: Date): string {
  const d = new Date(openedAt);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return pondCode ? `${pondCode}-${yyyy}${mm}${dd}` : `${yyyy}${mm}${dd}`;
}

function getIds(req: NextRequest) {
  const segments = req.nextUrl.pathname.split("/");
  // .../api/transfers/{id}/details/{detailId}/weigh-context
  const weighContextIdx = segments.length - 1;
  return {
    headerId: segments[weighContextIdx - 3],
    detailId: segments[weighContextIdx - 1],
  };
}

// Read-only bundle for the weighing MODAL (opened over the transfers screen per spec —
// "רצוי שיהיה חלון קופץ מעל למסך ההעברות ולא מסך נפרד"). Mirrors exactly what the old
// dedicated weighing screen's page.tsx fetched server-side via Prisma, but exposed as an
// API route so the modal (opened from within TransferDetailManager, already a client
// component) can fetch it itself instead of receiving it as server-component props.
export const GET = withModuleAccess(
  "תפעול",
  AccessLevel.VIEW_ONLY,
  async (req: NextRequest) => {
    const { headerId, detailId } = getIds(req);

    const header = await prisma.fishTransferHeader.findUnique({
      where: { id: headerId },
      include: {
        sourcePond: { select: { id: true, code: true, name: true } },
        cycle: { select: { id: true, openedAt: true } },
      },
    });
    if (!header) return NextResponse.json({ error: "העברה לא נמצאה" }, { status: 404 });

    const detail = await prisma.fishTransferDetail.findUnique({
      where: { id: detailId },
      include: {
        fishStrain: { select: { englishName: true, latinName: true } },
        transferMeans: { select: { meansType: true, internalTankId: true } },
        weighings: { select: { id: true } },
      },
    });
    if (!detail || detail.headerId !== header.id) {
      return NextResponse.json({ error: "שורת העברה לא נמצאה" }, { status: 404 });
    }

    const tank =
      detail.transferMeans?.meansType === "פנימי" && detail.transferMeans.internalTankId
        ? await prisma.tank.findUnique({ where: { id: detail.transferMeans.internalTankId } })
        : null;

    // A weighing triggered from the transfers screen is always tank-linked (a basket of
    // fish weighed for a specific tank inside a transfer), so per spec it must be filed
    // under "שקילת אפיון טנק" (tank characterization) — not the field-monitoring type.
    const weightTypes = await prisma.weightType.findMany({ orderBy: { name: "asc" } });
    const tankCharWeighTypeId =
      weightTypes.find((wt) => wt.name.includes("אפיון טנק"))?.id ?? weightTypes[0]?.id ?? "";

    const cycleCode = computeCycleCode(header.sourcePond.code, header.cycle.openedAt);

    let weighingId: string | null = null;
    let existingBaskets: {
      id: string;
      basketSeq: number;
      emptyWetWeight: number;
      weightWithFish: number;
      fishCount: number;
      notes: string | null;
    }[] = [];

    if (detail.weighings[0]) {
      const weighing = await prisma.fishWeighingHeader.findUnique({
        where: { id: detail.weighings[0].id },
        include: { baskets: { orderBy: { basketSeq: "asc" } } },
      });
      if (weighing) {
        weighingId = weighing.id;
        existingBaskets = weighing.baskets.map((b) => ({
          id: b.id,
          basketSeq: b.basketSeq,
          emptyWetWeight: b.emptyWetWeight,
          weightWithFish: b.weightWithFish,
          fishCount: b.fishCount,
          notes: b.notes,
        }));
      }
    }

    return NextResponse.json({
      transferId: header.id,
      detailId: detail.id,
      weighingId,
      pondId: header.sourcePondId,
      weightTypeId: tankCharWeighTypeId,
      date: header.transferDate.toISOString().slice(0, 10),
      tankId: tank?.id ?? null,
      tankCode: tank?.code ?? null,
      pondName: header.sourcePond.name,
      cycleCode,
      fishLabel: strainLabel(detail.fishStrain),
      existingBaskets,
    });
  }
);
