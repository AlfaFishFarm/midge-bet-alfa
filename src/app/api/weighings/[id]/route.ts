import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

const patchSchema = z.object({
  staffName: z.string().optional(),
  notes: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const GET = withModuleAccess(
  "תפעול",
  AccessLevel.VIEW_ONLY,
  async (req: NextRequest) => {
    const id = req.nextUrl.pathname.split("/").at(-1)!;
    const weighing = await prisma.fishWeighingHeader.findUnique({
      where: { id },
      include: {
        pond: { select: { id: true, code: true, name: true } },
        weightType: { select: { id: true, name: true } },
        cycle: { select: { id: true, priorityCycleCode: true } },
        transferDetail: { select: { id: true, headerId: true } },
        baskets: {
          orderBy: { basketSeq: "asc" },
        },
      },
    });
    if (!weighing) return NextResponse.json({ error: "שקילה לא נמצאה" }, { status: 404 });
    return NextResponse.json(weighing);
  }
);

export const PATCH = withModuleAccess(
  "תפעול",
  AccessLevel.OPERATIONS,
  async (req: NextRequest, { user }) => {
    const id = req.nextUrl.pathname.split("/").at(-1)!;
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "נתונים לא תקינים" }, { status: 400 });
    }

    const weighing = await prisma.fishWeighingHeader.findUnique({ where: { id } });
    if (!weighing) return NextResponse.json({ error: "שקילה לא נמצאה" }, { status: 404 });

    const before = { ...weighing };
    const d = parsed.data;
    const updated = await prisma.fishWeighingHeader.update({
      where: { id },
      data: {
        ...(d.staffName !== undefined && { staffName: d.staffName }),
        ...(d.notes !== undefined && { notes: d.notes }),
        ...(d.date !== undefined && { date: new Date(d.date) }),
      },
    });

    await writeAudit({
      userId: user.id,
      username: user.username,
      action: "update",
      entityType: "FishWeighingHeader",
      entityId: id,
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
    const id = req.nextUrl.pathname.split("/").at(-1)!;
    const weighing = await prisma.fishWeighingHeader.findUnique({
      where: { id },
      include: { baskets: { select: { id: true } } },
    });
    if (!weighing) return NextResponse.json({ error: "שקילה לא נמצאה" }, { status: 404 });

    // Delete baskets first (cascade not defined in schema)
    await prisma.$transaction([
      prisma.fishWeighingBasketDetail.deleteMany({ where: { headerId: id } }),
      prisma.fishWeighingHeader.delete({ where: { id } }),
    ]);

    await writeAudit({
      userId: user.id,
      username: user.username,
      action: "delete",
      entityType: "FishWeighingHeader",
      entityId: id,
      before: weighing,
    });

    return NextResponse.json({ ok: true });
  }
);
