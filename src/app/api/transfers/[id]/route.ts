import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

const patchSchema = z.object({
  status: z.enum(["טיוטא", "הסתיימה"]).optional(),
  notes: z.string().optional(),
});

export const GET = withModuleAccess(
  "תפעול",
  AccessLevel.VIEW_ONLY,
  async (req: NextRequest) => {
    const id = req.nextUrl.pathname.split("/").at(-1)!;
    const header = await prisma.fishTransferHeader.findUnique({
      where: { id },
      include: {
        sourcePond: { select: { id: true, code: true, name: true } },
        cycle: { select: { id: true, priorityCycleCode: true, openedAt: true } },
        details: {
          include: {
            fishStrain: { select: { id: true, englishName: true, latinName: true } },
            destPond: { select: { id: true, code: true, name: true } },
            populationCode: { select: { id: true, code: true } },
            weighings: { select: { id: true, date: true } },
          },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!header) return NextResponse.json({ error: "העברה לא נמצאה" }, { status: 404 });
    return NextResponse.json(header);
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

    const header = await prisma.fishTransferHeader.findUnique({ where: { id } });
    if (!header) return NextResponse.json({ error: "העברה לא נמצאה" }, { status: 404 });

    const before = { ...header };
    const updated = await prisma.fishTransferHeader.update({
      where: { id },
      data: {
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
      },
    });

    // When header is finalized (הסתיימה), cascade-close all detail rows so
    // they appear in the delivery-cert tanks query (requires ftd.status = "סגירה").
    if (parsed.data.status === "הסתיימה") {
      await prisma.fishTransferDetail.updateMany({
        where: { headerId: id },
        data: { status: "סגירה" },
      });
    }

    await writeAudit({
      userId: user.id,
      username: user.username,
      action: "update",
      entityType: "FishTransferHeader",
      entityId: id,
      before,
      after: updated,
    });

    return NextResponse.json({ id: updated.id });
  }
);
