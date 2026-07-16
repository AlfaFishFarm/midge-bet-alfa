import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

// Spec page 14: all roles can view transfers; VIEW_ONLY can view but not edit.
// Writes require OPERATIONS (day-to-day data entry).

const TRANSFER_TYPES = ["קניה", "דילול", "פירוק", "שיווק", "תמותה"] as const;

const createTransferSchema = z.object({
  // For קניה: server auto-sets sourcePondId to מחסן ראשי — pondId is optional.
  pondId: z.string().min(1).optional(),
  transferDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  transferType: z.enum(TRANSFER_TYPES),
  supplierId: z.string().min(1).optional(),
  notes: z.string().optional(),
});

export const POST = withModuleAccess(
  "תפעול",
  AccessLevel.OPERATIONS,
  async (req: NextRequest, { user }) => {
    const body = await req.json().catch(() => null);
    const parsed = createTransferSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "נתונים לא תקינים", details: parsed.error.flatten() }, { status: 400 });
    }
    const { pondId, transferDate, transferType, supplierId, notes } = parsed.data;

    const date = new Date(transferDate);
    // transferDate is date-only (parsed as midnight UTC), but a cycle's openedAt
    // is a full timestamp (e.g. opened at 14:00). Comparing openedAt <= midnight
    // would wrongly reject a transfer on the very day the pond was opened
    // whenever it was opened later than 00:00 that day. Use "before the start of
    // the next calendar day" instead, so any opening time on transferDate itself
    // (or earlier) counts as already open.
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    // For קניה: source pond is always מחסן ראשי (code "Main").
    let resolvedPondId: string;
    if (transferType === "קניה") {
      const mainWarehouse = await prisma.pond.findFirst({ where: { code: "Main" } });
      if (!mainWarehouse) {
        return NextResponse.json({ error: "מחסן ראשי לא נמצא — פנה למנהל המערכת" }, { status: 500 });
      }
      resolvedPondId = mainWarehouse.id;
      if (!supplierId) {
        return NextResponse.json({ error: "יש לבחור ספק עבור העברת קניה" }, { status: 422 });
      }
    } else {
      if (!pondId) {
        return NextResponse.json({ error: "יש לבחור בריכת מקור" }, { status: 400 });
      }
      resolvedPondId = pondId;
    }

    // Resolve the active cycle for this pond on the given date.
    const cycle = await prisma.growthCycle.findFirst({
      where: {
        pondId: resolvedPondId,
        openedAt: { lt: nextDay },
        OR: [{ closedAt: null }, { closedAt: { gte: date } }],
      },
    });

    if (!cycle) {
      return NextResponse.json(
        { error: "לא נמצא מחזור גידול פתוח לבריכה זו בתאריך שנבחר — פתח מחזור גידול תחילה" },
        { status: 422 }
      );
    }

    try {
      const header = await prisma.fishTransferHeader.create({
        data: {
          cycleId: cycle.id,
          sourcePondId: resolvedPondId,
          transferType,
          transferDate: date,
          status: "טיוטא",
          supplierId: supplierId ?? null,
          notes: notes ?? null,
        },
      });

      await writeAudit({
        userId: user.id,
        username: user.username,
        action: "create",
        entityType: "FishTransferHeader",
        entityId: header.id,
        after: { ...header, cycleId: cycle.id },
      });

      return NextResponse.json({ id: header.id }, { status: 201 });
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
        // Unique constraint: a draft already exists for this pond+date+cycle — find and return it.
        const existing = await prisma.fishTransferHeader.findFirst({
          where: { cycleId: cycle.id, sourcePondId: resolvedPondId, transferDate: date },
        });
        if (existing) {
          return NextResponse.json({ id: existing.id, existing: true }, { status: 200 });
        }
      }
      throw err;
    }
  }
);

export const GET = withModuleAccess(
  "תפעול",
  AccessLevel.VIEW_ONLY,
  async (_req: NextRequest) => {
    const headers = await prisma.fishTransferHeader.findMany({
      include: {
        sourcePond: { select: { code: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { transferDate: "desc" },
      take: 100,
    });
    return NextResponse.json(headers);
  }
);
