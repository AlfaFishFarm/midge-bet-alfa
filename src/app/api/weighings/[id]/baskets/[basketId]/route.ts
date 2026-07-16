import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

const patchBasketSchema = z.object({
  emptyWetWeight: z.number().nonnegative().optional(),
  weightWithFish: z.number().positive().optional(),
  fishCount: z.number().int().positive().optional(),
  notes: z.string().nullable().optional(),
});

function getIds(req: NextRequest) {
  const segments = req.nextUrl.pathname.split("/");
  // /api/weighings/[id]/baskets/[basketId]
  return { weighingId: segments[segments.length - 3], basketId: segments[segments.length - 1] };
}

export const PATCH = withModuleAccess(
  "תפעול",
  AccessLevel.OPERATIONS,
  async (req: NextRequest, { user }) => {
    const { weighingId, basketId } = getIds(req);
    const body = await req.json().catch(() => null);
    const parsed = patchBasketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "נתונים לא תקינים" }, { status: 400 });
    }

    const basket = await prisma.fishWeighingBasketDetail.findUnique({ where: { id: basketId } });
    if (!basket || basket.headerId !== weighingId) {
      return NextResponse.json({ error: "סל לא נמצא" }, { status: 404 });
    }

    const before = { ...basket };
    const d = parsed.data;
    const updated = await prisma.fishWeighingBasketDetail.update({
      where: { id: basketId },
      data: {
        ...(d.emptyWetWeight !== undefined && { emptyWetWeight: d.emptyWetWeight }),
        ...(d.weightWithFish !== undefined && { weightWithFish: d.weightWithFish }),
        ...(d.fishCount !== undefined && { fishCount: d.fishCount }),
        ...(d.notes !== undefined && { notes: d.notes }),
      },
    });

    await writeAudit({
      userId: user.id,
      username: user.username,
      action: "update",
      entityType: "FishWeighingBasketDetail",
      entityId: basketId,
      before,
      after: updated,
    });

    return NextResponse.json({ id: updated.id });
  }
);

export const DELETE = withModuleAccess(
  "תפעול",
  AccessLevel.OPERATIONS,
  async (req: NextRequest, { user }) => {
    const { weighingId, basketId } = getIds(req);

    const basket = await prisma.fishWeighingBasketDetail.findUnique({ where: { id: basketId } });
    if (!basket || basket.headerId !== weighingId) {
      return NextResponse.json({ error: "סל לא נמצא" }, { status: 404 });
    }

    await prisma.fishWeighingBasketDetail.delete({ where: { id: basketId } });

    await writeAudit({
      userId: user.id,
      username: user.username,
      action: "delete",
      entityType: "FishWeighingBasketDetail",
      entityId: basketId,
      before: basket,
    });

    return NextResponse.json({ ok: true });
  }
);
