import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { isVirtualPondType, hasOverlappingCycle } from "@/lib/cycles";

const openCycleSchema = z.object({
  pondId: z.string().min(1),
  priorityCycleCode: z.string().min(1).optional(),
  // Spec page 6: "מוצג תאריך של היום ושעה נוכחית" — open-date default includes
  // current time, so accept either a bare date or a datetime-local string.
  openedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "תאריך לא תקין"),
  openNotes: z.string().optional(),
});

export const POST = withModuleAccess(
  "תפעול",
  AccessLevel.EXECUTIVE,
  async (req: NextRequest, { user }) => {
    const body = await req.json().catch(() => null);
    const parsed = openCycleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "נתונים לא תקינים", details: parsed.error.flatten() }, { status: 400 });
    }
    const { pondId, priorityCycleCode, openedAt, openNotes } = parsed.data;

    const openDate = new Date(openedAt);
    if (openDate > new Date()) {
      return NextResponse.json({ error: "תאריך פתיחה לא יכול להיות בעתיד" }, { status: 422 });
    }

    const pond = await prisma.pond.findUnique({
      where: { id: pondId },
      include: { pondType: true },
    });
    if (!pond) {
      return NextResponse.json({ error: "בריכה לא נמצאה" }, { status: 404 });
    }
    if (isVirtualPondType(pond.pondType.name)) {
      return NextResponse.json({ error: "לא ניתן לפתוח מחזור גידול בבריכה וירטואלית" }, { status: 422 });
    }

    const overlap = await hasOverlappingCycle(pondId, openDate, null);
    if (overlap) {
      return NextResponse.json(
        { error: "לבריכה זו יש כבר מחזור גידול פתוח — סגור אותו לפני פתיחת מחזור חדש" },
        { status: 409 }
      );
    }

    try {
      const cycle = await prisma.growthCycle.create({
        data: {
          pondId,
          priorityCycleCode: priorityCycleCode ?? null,
          openedAt: openDate,
          openNotes: openNotes ?? null,
        },
      });

      await writeAudit({
        userId: user.id,
        username: user.username,
        action: "open_cycle",
        entityType: "GrowthCycle",
        entityId: cycle.id,
        after: { cycleId: cycle.id, pondId, openedAt, priorityCycleCode },
      });

      return NextResponse.json({ id: cycle.id });
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
