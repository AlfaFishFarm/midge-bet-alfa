import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

const WEIGHABLE_TYPES = ["דילול", "פירוק", "שיווק"];

const patchDetailSchema = z.object({
  fishStrainId: z.string().min(1).optional(),
  destPondId: z.string().min(1).optional(),
  fishCount: z.number().int().positive().nullable().optional(),
  avgWeightGrams: z.number().positive().nullable().optional(),
  // totalWeightKg: stored for דילול/פירוק/שיווק; computed display-only for קניה
  totalWeightKg: z.number().positive().nullable().optional(),
  transferTime: z.string().nullable().optional(),
  populationCodeId: z.string().nullable().optional(),
  transferMeansId: z.string().nullable().optional(),
  // Inline means — creates or updates the linked TransferMeans record
  meansType: z.enum(["פנימי", "חיצוני"]).optional(),
  internalTankId: z.string().nullable().optional(),
  externalVehicleCode: z.string().nullable().optional(),
  status: z.enum(["טיוטא", "סגירה"]).optional(),
  notes: z.string().nullable().optional(),
  causeOfDeath: z.string().nullable().optional(),
});

function getIds(req: NextRequest) {
  const segments = req.nextUrl.pathname.split("/");
  return { headerId: segments[segments.length - 3], detailId: segments[segments.length - 1] };
}

export const PATCH = withModuleAccess(
  "תפעול",
  AccessLevel.OPERATIONS,
  async (req: NextRequest, { user }) => {
    const { headerId, detailId } = getIds(req);
    const body = await req.json().catch(() => null);
    const parsed = patchDetailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "נתונים לא תקינים" }, { status: 400 });
    }

    const detail = await prisma.fishTransferDetail.findUnique({ where: { id: detailId } });
    if (!detail || detail.headerId !== headerId) {
      return NextResponse.json({ error: "פרט העברה לא נמצא" }, { status: 404 });
    }

    // Load header once — used for type-based validation and for TransferMeans creation
    const hdr = await prisma.fishTransferHeader.findUnique({
      where: { id: headerId },
      select: { transferType: true, transferDate: true },
    });
    if (!hdr) return NextResponse.json({ error: "העברה לא נמצאה" }, { status: 404 });

    const d = parsed.data;

    // totalWeightKg is computed display-only for קניה (fishCount × avgWeightGrams / 1000)
    if (d.totalWeightKg !== undefined && hdr.transferType === "קניה") {
      return NextResponse.json(
        { error: "משקל כולל מחושב אוטומטית עבור קניה" },
        { status: 422 }
      );
    }

    const before = { ...detail };

    // Resolve transferMeansId: inline meansType takes priority over explicit transferMeansId FK.
    let meansIdToSet: string | null | undefined = undefined;
    if (d.meansType) {
      if (detail.transferMeansId) {
        await prisma.transferMeans.update({
          where: { id: detail.transferMeansId },
          data: {
            meansType: d.meansType,
            internalTankId: d.internalTankId ?? null,
            externalVehicleCode: d.externalVehicleCode ?? null,
          },
        });
        meansIdToSet = detail.transferMeansId;
      } else {
        const means = await prisma.transferMeans.create({
          data: {
            date: hdr.transferDate,
            meansType: d.meansType,
            internalTankId: d.internalTankId ?? null,
            externalVehicleCode: d.externalVehicleCode ?? null,
          },
        });
        meansIdToSet = means.id;
      }
    } else if (d.transferMeansId !== undefined) {
      meansIdToSet = d.transferMeansId;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await (prisma.fishTransferDetail as any).update({
      where: { id: detailId },
      data: {
        ...(d.fishStrainId !== undefined && { fishStrainId: d.fishStrainId }),
        ...(d.destPondId !== undefined && { destPondId: d.destPondId }),
        ...(d.fishCount !== undefined && { fishCount: d.fishCount }),
        ...(d.avgWeightGrams !== undefined && { avgWeightGrams: d.avgWeightGrams }),
        ...(d.totalWeightKg !== undefined && { totalWeightKg: d.totalWeightKg }),
        ...(d.transferTime !== undefined && {
          transferTime: d.transferTime ? new Date(d.transferTime) : null,
        }),
        ...(d.populationCodeId !== undefined && { populationCodeId: d.populationCodeId }),
        ...(meansIdToSet !== undefined && { transferMeansId: meansIdToSet }),
        ...(d.status !== undefined && { status: d.status }),
        ...(d.notes !== undefined && { notes: d.notes }),
        ...(d.causeOfDeath !== undefined && { causeOfDeath: d.causeOfDeath }),
      },
    });

    await writeAudit({
      userId: user.id,
      username: user.username,
      action: "update",
      entityType: "FishTransferDetail",
      entityId: detailId,
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
    const { headerId, detailId } = getIds(req);

    const detail = await prisma.fishTransferDetail.findUnique({
      where: { id: detailId },
      include: { weighings: { select: { id: true } } },
    });
    if (!detail || detail.headerId !== headerId) {
      return NextResponse.json({ error: "פרט העברה לא נמצא" }, { status: 404 });
    }
    if (detail.weighings.length > 0) {
      return NextResponse.json(
        { error: "לא ניתן למחוק שורה שיש לה שקילות — מחק את השקילות תחילה" },
        { status: 409 }
      );
    }

    await prisma.fishTransferDetail.delete({ where: { id: detailId } });

    await writeAudit({
      userId: user.id,
      username: user.username,
      action: "delete",
      entityType: "FishTransferDetail",
      entityId: detailId,
      before: detail,
    });

    return NextResponse.json({ ok: true });
  }
);
