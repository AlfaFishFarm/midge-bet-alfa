import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { getCycleFishBalance, hasTransfersAfter, hasOverlappingCycle } from "@/lib/cycles";

const closeCycleSchema = z.object({
  priorityCycleCode: z.string().min(1).optional(),
  // Per Dean (2026-06-23): the page-9 mockup's date+time value counts as an
  // explicit spec requirement — close-date is a datetime-local value too.
  closedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "תאריך לא תקין"),
  closeNotes: z.string().optional(),
});

export const POST = withModuleAccess(
  "תפעול",
  AccessLevel.EXECUTIVE,
  async (req: NextRequest, { user }) => {
    const segments = req.nextUrl.pathname.split("/");
    const id = segments[segments.length - 2]; // /api/cycles/[id]/close

    const body = await req.json().catch(() => null);
    const parsed = closeCycleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "נתונים לא תקינים" }, { status: 400 });
    }
    const { priorityCycleCode, closedAt, closeNotes } = parsed.data;

    const cycle = await prisma.growthCycle.findUnique({ where: { id } });
    if (!cycle) return NextResponse.json({ error: "מחזור לא נמצא" }, { status: 404 });
    if (cycle.closedAt) {
      return NextResponse.json({ error: "מחזור זה כבר סגור" }, { status: 409 });
    }

    // Spec: priorityCycleCode is required at close if not already set.
    const finalCode = cycle.priorityCycleCode ?? priorityCycleCode;
    if (!finalCode) {
      return NextResponse.json(
        { error: "קוד Priority נדרש לסגירת מחזור — הזן קוד לפני הסגירה" },
        { status: 422 }
      );
    }
    // No-clear rule: if it was already set, ignore incoming value (don't allow override).
    if (cycle.priorityCycleCode && priorityCycleCode && priorityCycleCode !== cycle.priorityCycleCode) {
      return NextResponse.json(
        { error: "לא ניתן לשנות קוד Priority שכבר הוגדר" },
        { status: 422 }
      );
    }

    const closeDate = new Date(closedAt);
    if (closeDate < cycle.openedAt) {
      return NextResponse.json(
        { error: "תאריך סגירה לא יכול להיות לפני תאריך הפתיחה" },
        { status: 422 }
      );
    }
    if (closeDate > new Date()) {
      return NextResponse.json({ error: "תאריך סגירה לא יכול להיות בעתיד" }, { status: 422 });
    }

    const blocked = await hasTransfersAfter(id, closeDate);
    if (blocked) {
      return NextResponse.json(
        {
          error:
            "לא ניתן לסגור במועד זה — קיימות העברות מדווחות לאחר תאריך הסגירה שנבחר",
        },
        { status: 409 }
      );
    }

    // Spec page 8: close date must not fall within another cycle's range on the same pond.
    const overlap = await hasOverlappingCycle(cycle.pondId, cycle.openedAt, closeDate, id);
    if (overlap) {
      return NextResponse.json(
        {
          error: "תאריך הסגירה חופף למחזור גידול אחר באותה בריכה — בחר תאריך אחר",
        },
        { status: 409 }
      );
    }

    // Fish balance: warning only — do not block (per spec).
    const balance = await getCycleFishBalance(id);

    try {
      const updated = await prisma.growthCycle.update({
        where: { id },
        data: {
          closedAt: closeDate,
          closeNotes: closeNotes ?? null,
          ...(finalCode !== cycle.priorityCycleCode && { priorityCycleCode: finalCode }),
        },
      });

      await writeAudit({
        userId: user.id,
        username: user.username,
        action: "close_cycle",
        entityType: "GrowthCycle",
        entityId: id,
        before: { ...cycle },
        after: {
          ...updated,
          balanceSnapshot: {
            incoming: balance.incoming,
            outgoing: balance.outgoing,
            mortality: balance.mortality,
            difference: balance.difference,
            withinTolerance: balance.withinTolerance,
          },
        },
      });

      return NextResponse.json({
        id: updated.id,
        balanceWarning: balance.withinTolerance ? null : balance.difference,
      });
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        return NextResponse.json(
          { error: "קוד Priority זה כבר קיים במחזור אחר — בחר קוד ייחודי" },
          { status: 409 }
        );
      }
      throw err;
    }
  }
);

const editClosedCycleSchema = z.object({
  priorityCycleCode: z.string().min(1).optional(),
  closedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "תאריך לא תקין"),
  closeNotes: z.string().optional(),
});

// Spec page 7: "אם נבחרה בריכה סגורה: ישמש לעדכון פרטי סגירה" — selecting an
// already-closed pond switches the close-pool screen into edit mode for that
// cycle's close record (close date / priority code / notes). Missed on the
// first close-pool build (only pages 8-9 were used); added 2026-06-23 after
// Dean asked to re-verify all open/close conditions.
export const PATCH = withModuleAccess(
  "תפעול",
  AccessLevel.EXECUTIVE,
  async (req: NextRequest, { user }) => {
    const segments = req.nextUrl.pathname.split("/");
    const id = segments[segments.length - 2]; // /api/cycles/[id]/close

    const body = await req.json().catch(() => null);
    const parsed = editClosedCycleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "נתונים לא תקינים" }, { status: 400 });
    }
    const { priorityCycleCode, closedAt, closeNotes } = parsed.data;

    const cycle = await prisma.growthCycle.findUnique({ where: { id } });
    if (!cycle) return NextResponse.json({ error: "מחזור לא נמצא" }, { status: 404 });
    if (!cycle.closedAt) {
      return NextResponse.json(
        { error: "מחזור זה עדיין פתוח — יש לסגור אותו תחילה" },
        { status: 409 }
      );
    }

    // Same no-clear rule as the open-cycle edit route: keep existing code if not
    // provided; block clearing it back to empty.
    if (cycle.priorityCycleCode && priorityCycleCode !== undefined && !priorityCycleCode) {
      return NextResponse.json(
        { error: "לא ניתן לנקות קוד Priority שכבר הוגדר — ניתן רק לשנות לערך אחר" },
        { status: 422 }
      );
    }
    const finalCode = cycle.priorityCycleCode ?? priorityCycleCode;
    if (!finalCode) {
      return NextResponse.json(
        { error: "קוד Priority נדרש לסגירת מחזור — הזן קוד" },
        { status: 422 }
      );
    }

    const closeDate = new Date(closedAt);
    if (closeDate < cycle.openedAt) {
      return NextResponse.json(
        { error: "תאריך סגירה לא יכול להיות לפני תאריך הפתיחה" },
        { status: 422 }
      );
    }
    if (closeDate > new Date()) {
      return NextResponse.json({ error: "תאריך סגירה לא יכול להיות בעתיד" }, { status: 422 });
    }

    const blocked = await hasTransfersAfter(id, closeDate);
    if (blocked) {
      return NextResponse.json(
        {
          error:
            "לא ניתן לעדכן לתאריך זה — קיימות העברות מדווחות לאחר תאריך הסגירה שנבחר",
        },
        { status: 409 }
      );
    }

    const overlap = await hasOverlappingCycle(cycle.pondId, cycle.openedAt, closeDate, id);
    if (overlap) {
      return NextResponse.json(
        {
          error: "תאריך הסגירה חופף למחזור גידול אחר באותה בריכה — בחר תאריך אחר",
        },
        { status: 409 }
      );
    }

    const before = { ...cycle };

    try {
      const updated = await prisma.growthCycle.update({
        where: { id },
        data: {
          closedAt: closeDate,
          closeNotes: closeNotes ?? null,
          ...(finalCode !== cycle.priorityCycleCode && { priorityCycleCode: finalCode }),
        },
      });

      await writeAudit({
        userId: user.id,
        username: user.username,
        action: "update",
        entityType: "GrowthCycle",
        entityId: id,
        before,
        after: updated,
      });

      return NextResponse.json({ id: updated.id });
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        return NextResponse.json(
          { error: "קוד Priority זה כבר קיים במחזור אחר — בחר קוד ייחודי" },
          { status: 409 }
        );
      }
      throw err;
    }
  }
);
