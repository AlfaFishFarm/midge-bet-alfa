import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

// Per Dean's explicit instruction (2026-06-27, "לא צריך את המשקל סל ריק!"): no separate
// empty/tare basket weight is collected — only the full (gross) basket weight, matching
// the HTML prototype (fish-farm-manager-v11) which has no tare-weight field anywhere.
// This reverses the same-day spec-following change above the diff (which had restored
// emptyWetWeight as מחובה); emptyWetWeight is now always stored as 0.
const addBasketSchema = z.object({
  weightWithFish: z.number().positive(),
  fishCount: z.number().int().positive(),
  notes: z.string().optional(),
});

function weighingId(req: NextRequest) {
  const segments = req.nextUrl.pathname.split("/");
  return segments[segments.length - 2]; // /api/weighings/[id]/baskets
}

export const GET = withModuleAccess(
  "תפעול",
  AccessLevel.VIEW_ONLY,
  async (req: NextRequest) => {
    const id = weighingId(req);
    const baskets = await prisma.fishWeighingBasketDetail.findMany({
      where: { headerId: id },
      orderBy: { basketSeq: "asc" },
    });
    return NextResponse.json(baskets);
  }
);

export const POST = withModuleAccess(
  "תפעול",
  AccessLevel.OPERATIONS,
  async (req: NextRequest, { user }) => {
    const id = weighingId(req);
    const body = await req.json().catch(() => null);
    const parsed = addBasketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "נתונים לא תקינים", details: parsed.error.flatten() }, { status: 400 });
    }

    const weighing = await prisma.fishWeighingHeader.findUnique({
      where: { id },
      include: { baskets: { select: { basketSeq: true }, orderBy: { basketSeq: "desc" }, take: 1 } },
    });
    if (!weighing) return NextResponse.json({ error: "שקילה לא נמצאה" }, { status: 404 });

    const nextSeq = (weighing.baskets[0]?.basketSeq ?? 0) + 1;

    const basket = await prisma.fishWeighingBasketDetail.create({
      data: {
        headerId: id,
        basketSeq: nextSeq,
        emptyWetWeight: 0,
        weightWithFish: parsed.data.weightWithFish,
        fishCount: parsed.data.fishCount,
        notes: parsed.data.notes ?? null,
      },
    });

    await writeAudit({
      userId: user.id,
      username: user.username,
      action: "create",
      entityType: "FishWeighingBasketDetail",
      entityId: basket.id,
      after: basket,
    });

    return NextResponse.json({ id: basket.id, basketSeq: basket.basketSeq }, { status: 201 });
  }
);
