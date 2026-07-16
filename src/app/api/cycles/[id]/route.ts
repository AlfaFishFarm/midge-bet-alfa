import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { hasTransfersBefore, hasOverlappingCycle } from "@/lib/cycles";

const editCycleSchema = z.object({
  priorityCycleCode: z.string().min(1).optional(),
  // Accept bare date or datetime-local (spec page 6: open-date default shows
  // current time too).
  openedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/).optional(),
  openNotes: z.string().optional(),
});

export const PATCH = withModuleAccess(
  "תפעול",
  AccessLevel.EXECUTIVE,
  async (req: NextRequest, { user }) => {
    const id = req.nextUrl.pathname.split("/").at(-1)!;
    const body = await req.json().catch(() => null);
    const parsed = editCycleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "נתונים לא תקינים" }, { status: 400 });
    }
    const { priorityCycleCode, openedAt, openNotes } = parsed.data;

    const cycle = await prisma.growthCycle.findUnique({ where: { id } });
    if (!cycle) return NextResponse.json({ error: "מחזור לא נמצא" }, { status: 404 });
    if (cycle.closedAt) {
      return NextResponse.json({ error: "לא ניתן לערוך מחזור סגור" }, { status: 409 });
    }

    // Spec: priorityCycleCode may not be cleared back to empty once set.
    if (cycle.priorityCycleCode && priorityCycleCode === undefined) {
      // Field not provided — keep existing; that's fine.
    }
    if (cycle.priorityCycleCode && priorityCycleCode !== undefined && !priorityCycleCode) {
      return NextResponse.json(
        { error: "לא ניתן לנקות קוד Priority שכבר הוגדר — ניתן רק לשנות לערך אחר" },
        { status: 422 }
      );
    }

    let newOpenedAt: Date | undefined;
    if (openedAt) {
      newOpenedAt = new Date(openedAt);
      if (newOpenedAt > new Date()) {
        return NextResponse.json({ error: "תאריך פתיחה לא יכול להיות בעתיד" }, { status: 422 });
      }
      // Block moving openedAt later if it would orphan existing transfers.
      if (newOpenedAt > cycle.openedAt) {
        const blocked = await hasTransfersBefore(id, newOpenedAt);
        if (blocked) {
          return NextResponse.json(
            {
              error:
                "לא ניתן להזיז את תאריך הפתיחה לאחר — קיימות דיווחי העברות לפני התאריך החדש",
            },
            { status: 409 }
          );
        }
      }

      // Spec pages 5/6 ("אין לאפשר יצירת מחזורים חופפים בתאריכים לבריכה") applies to
      // date edits on an existing open cycle too, not just to opening a brand-new one —
      // moving the open date earlier could overlap a previous closed cycle on this pond.
      // This cycle is still open (rangeEnd = null), excluding itself from the check.
      const overlap = await hasOverlappingCycle(cycle.pondId, newOpenedAt, null, id);
      if (overlap) {
        return NextResponse.json(
          { error: "תאריך הפתיחה החדש חופף למחזור גידול אחר באותה בריכה — בחר תאריך אחר" },
          { status: 409 }
        );
      }
    }

    const before = { ...cycle };

    try {
      const updated = await prisma.growthCycle.update({
        where: { id },
        data: {
          ...(priorityCycleCode !== undefined && { priorityCycleCode }),
          ...(newOpenedAt !== undefined && { openedAt: newOpenedAt }),
          ...(openNotes !== undefined && { openNotes }),
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
