import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

// POST /api/fish-switching
// Creates a FishSwitching record linked to a transfer detail row.
// Called from the UI when the user selects a fish strain not on the pond's
// roster and chooses "החלפת דג" (spec page 42: "יש לעדכן בטבלת fishSwitching
// על פעולת החלפת זהות של דגים"). The record is saved only when the parent
// transfer detail already exists (the detail row must be created first, then
// this is called to register the switch event against it).
// Spec constraint: "העדכון יתבצע רק כאשר הישות של הפעולה שהביאה להחלפה תישמר"
// — so we write this after the detail is saved, not speculatively.

const createSwitchingSchema = z.object({
  transferDetailId: z.string().min(1),
  fromStrainId: z.string().min(1),
  toStrainId: z.string().min(1),
});

export const POST = withModuleAccess(
  "תפעול",
  AccessLevel.OPERATIONS,
  async (req: NextRequest, { user }) => {
    const body = await req.json().catch(() => null);
    const parsed = createSwitchingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { transferDetailId, fromStrainId, toStrainId } = parsed.data;

    // Verify the transfer detail exists and belongs to a non-finished transfer
    const detail = await prisma.fishTransferDetail.findUnique({
      where: { id: transferDetailId },
      include: { header: { select: { id: true, status: true } } },
    });
    if (!detail) {
      return NextResponse.json({ error: "שורת ההעברה לא נמצאה" }, { status: 404 });
    }
    if (detail.header.status === "הסתיימה") {
      return NextResponse.json(
        { error: "לא ניתן לרשום החלפת דג על העברה שכבר הסתיימה" },
        { status: 409 }
      );
    }

    // Verify both strains exist
    const [fromStrain, toStrain] = await Promise.all([
      prisma.fishStrain.findUnique({ where: { id: fromStrainId } }),
      prisma.fishStrain.findUnique({ where: { id: toStrainId } }),
    ]);
    if (!fromStrain || !toStrain) {
      return NextResponse.json({ error: "אחד מסוגי הדגים לא נמצא" }, { status: 404 });
    }

    // Remove any prior switching record for this detail before creating the new one
    // (a detail can only have one active switch event — if the user changed their mind
    // and picked a different replacement strain, we replace the old record).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).fishSwitching.deleteMany({ where: { transferDetailId } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const switching = await (prisma as any).fishSwitching.create({
      data: { transferDetailId, fromStrainId, toStrainId },
    });

    await writeAudit({
      userId: user.id,
      username: user.username,
      action: "create",
      entityType: "FishSwitching",
      entityId: switching.id,
      after: { transferDetailId, fromStrainId, toStrainId },
    });

    return NextResponse.json({ id: switching.id });
  }
);
