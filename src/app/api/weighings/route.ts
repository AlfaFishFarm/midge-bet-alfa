import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

const createWeighingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/),
  pondId: z.string().min(1),
  weightTypeId: z.string().min(1),
  cycleId: z.string().optional(),
  transferDetailId: z.string().optional(),
  tankId: z.string().optional(),
  staffName: z.string().optional(),
  notes: z.string().optional(),
});

export const POST = withModuleAccess(
  "תפעול",
  AccessLevel.OPERATIONS,
  async (req: NextRequest, { user }) => {
    const body = await req.json().catch(() => null);
    const parsed = createWeighingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "נתונים לא תקינים", details: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    const date = new Date(d.date);

    // Per spec ("שקילות", line ~1686): the tank-characterization weighing window is
    // explicitly described as available ONLY from transfer reporting ("חלון זה זמין רק
    // מתוך דיווח העברות שיווק, דילול ופירוק") — never as a standalone creation flow. The
    // standalone /weighings screen never sends a tankId, so this also blocks any direct
    // API call attempting to create a tank-characterization weighing without one.
    const weightType = await prisma.weightType.findUnique({ where: { id: d.weightTypeId } });
    if (!weightType) {
      return NextResponse.json({ error: "סוג שקילה לא נמצא" }, { status: 400 });
    }
    // Guard: block "אפיון טנק" weighings that are NOT launched from a transfer at all
    // (i.e., no transferDetailId). When launched from the transfers screen with external
    // means (חיצוני), tankId is legitimately absent — the weighing is still transfer-linked.
    if (weightType.name.includes("אפיון") && !d.tankId && !d.transferDetailId) {
      return NextResponse.json(
        { error: "שקילת אפיון טנק ניתנת ליצירה רק מתוך מסך ההעברות (יש לבחור טנק)" },
        { status: 400 }
      );
    }

    // Same-tank-twice guard — spec page 20: "בדיקה: יש למנוע בחירת אותו טנק פעמיים". Done as an
    // explicit calendar-day range check rather than relying on the @@unique([date, pondId, tankId])
    // DB constraint, because `date` stores a full timestamp (date+time) — two sessions for the
    // same tank on the same day but different times would NOT collide on that constraint alone.
    if (d.tankId) {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      const existing = await prisma.fishWeighingHeader.findFirst({
        where: { tankId: d.tankId, pondId: d.pondId, date: { gte: dayStart, lte: dayEnd } },
      });
      if (existing) {
        return NextResponse.json(
          { error: "כבר קיימת שקילה לטנק זה באותו תאריך ובריכה — לא ניתן לשקול את אותו טנק פעמיים" },
          { status: 409 }
        );
      }
    }

    const weighing = await prisma.fishWeighingHeader.create({
      data: {
        date,
        pondId: d.pondId,
        weightTypeId: d.weightTypeId,
        cycleId: d.cycleId ?? null,
        transferDetailId: d.transferDetailId ?? null,
        tankId: d.tankId ?? null,
        staffName: d.staffName ?? null,
        notes: d.notes ?? null,
      },
    });

    await writeAudit({
      userId: user.id,
      username: user.username,
      action: "create",
      entityType: "FishWeighingHeader",
      entityId: weighing.id,
      after: weighing,
    });

    return NextResponse.json({ id: weighing.id }, { status: 201 });
  }
);

export const GET = withModuleAccess(
  "תפעול",
  AccessLevel.VIEW_ONLY,
  async (req: NextRequest) => {
    const { searchParams } = req.nextUrl;
    const weightTypeName = searchParams.get("typeName");
    const pondId = searchParams.get("pondId");

    const weighings = await prisma.fishWeighingHeader.findMany({
      where: {
        ...(pondId && { pondId }),
        ...(weightTypeName && { weightType: { name: { contains: weightTypeName } } }),
      },
      include: {
        pond: { select: { id: true, code: true, name: true } },
        weightType: { select: { id: true, name: true } },
        cycle: { select: { id: true, priorityCycleCode: true } },
        baskets: {
          select: {
            id: true,
            basketSeq: true,
            emptyWetWeight: true,
            weightWithFish: true,
            fishCount: true,
          },
          orderBy: { basketSeq: "asc" },
        },
      },
      orderBy: { date: "desc" },
      take: 200,
    });

    return NextResponse.json(weighings);
  }
);
