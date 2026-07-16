import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

const createDetailSchema = z.object({
  fishStrainId: z.string().min(1),
  destPondId: z.string().min(1),
  fishCount: z.number().int().positive().optional(),
  avgWeightGrams: z.number().positive().optional(),
  // totalWeightKg: manual entry for דילול/פירוק/שיווק; computed display-only for קניה (not stored for קניה)
  totalWeightKg: z.number().positive().optional(),
  transferTime: z.string().optional(),
  populationCodeId: z.string().optional(),
  // Transfer means fields — API creates TransferMeans record internally (1:1 per detail row).
  meansType: z.enum(["פנימי", "חיצוני"]).optional(),
  internalTankId: z.string().optional(),
  externalVehicleCode: z.string().optional(),
  notes: z.string().optional(),
  // סיבת תמותה — only relevant for transferType=תמותה rows
  causeOfDeath: z.string().optional(),
});

function headerId(req: NextRequest) {
  const segments = req.nextUrl.pathname.split("/");
  return segments[segments.length - 2];
}

export const GET = withModuleAccess(
  "תפעול",
  AccessLevel.VIEW_ONLY,
  async (req: NextRequest) => {
    const id = headerId(req);
    const details = await prisma.fishTransferDetail.findMany({
      where: { headerId: id },
      include: {
        fishStrain: { select: { id: true, englishName: true, latinName: true } },
        destPond: { select: { id: true, code: true, name: true } },
        populationCode: { select: { id: true, code: true } },
        transferMeans: {
          select: { id: true, meansType: true, internalTankId: true, externalVehicleCode: true },
        },
        weighings: { select: { id: true, date: true } },
      },
      orderBy: { id: "asc" },
    });
    return NextResponse.json(details);
  }
);

export const POST = withModuleAccess(
  "תפעול",
  AccessLevel.OPERATIONS,
  async (req: NextRequest, { user }) => {
    const id = headerId(req);
    const body = await req.json().catch(() => null);
    const parsed = createDetailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "נתונים לא תקינים", details: parsed.error.flatten() }, { status: 400 });
    }

    const header = await prisma.fishTransferHeader.findUnique({ where: { id } });
    if (!header) return NextResponse.json({ error: "העברה לא נמצאה" }, { status: 404 });

    // Create TransferMeans record 1:1 with this detail row (if means data provided).
    let transferMeansId: string | null = null;
    if (parsed.data.meansType) {
      const means = await prisma.transferMeans.create({
        data: {
          date: header.transferDate,
          meansType: parsed.data.meansType,
          internalTankId: parsed.data.internalTankId ?? null,
          externalVehicleCode: parsed.data.externalVehicleCode ?? null,
        },
      });
      transferMeansId = means.id;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let detail: Record<string, unknown>;
    try {
      detail = await (prisma.fishTransferDetail as any).create({
        data: {
          headerId: id,
          fishStrainId: parsed.data.fishStrainId,
          destPondId: parsed.data.destPondId,
          fishCount: parsed.data.fishCount ?? null,
          avgWeightGrams: parsed.data.avgWeightGrams ?? null,
          totalWeightKg: parsed.data.totalWeightKg ?? null,
          transferTime: parsed.data.transferTime ? new Date(parsed.data.transferTime) : null,
          populationCodeId: parsed.data.populationCodeId ?? null,
          transferMeansId,
          notes: parsed.data.notes ?? null,
          causeOfDeath: parsed.data.causeOfDeath ?? null,
          status: "טיוטא",
        },
      });
    } catch (err) {
      console.error("[detail POST] prisma error:", err);
      return NextResponse.json({ error: "שגיאה בשמירת שורת העברה" }, { status: 500 });
    }

    await writeAudit({
      userId: user.id,
      username: user.username,
      action: "create",
      entityType: "FishTransferDetail",
      entityId: detail.id as string,
      after: { ...detail, transferMeansId },
    });

    return NextResponse.json({ id: detail.id }, { status: 201 });
  }
);
