import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { bestAccessForModule, meetsRequirement, AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

// POST /api/deliveries/[id]/submit
// Any ops user: moves delivery from "טיוטא" → "ממתין לאישור".
// Used by non-managers clicking "סגירה והעברה לאישור".
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const level = bestAccessForModule(user.permissions, "תפעול");
    if (!meetsRequirement(level, AccessLevel.VIEW_ONLY)) {
      return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
    }

    const { id } = await params;
    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: { details: true },
    });

    if (!delivery) return NextResponse.json({ error: "לא נמצאה תעודה" }, { status: 404 });
    if (delivery.status !== "טיוטא") {
      return NextResponse.json({ error: "ניתן להעביר לאישור רק טיוטות" }, { status: 409 });
    }
    if (!delivery.details || delivery.details.length === 0) {
      return NextResponse.json({ error: "התעודה חייבת לכלול לפחות שורת פירוט אחת" }, { status: 422 });
    }

    const updated = await prisma.delivery.update({
      where: { id },
      data: { status: "ממתין לאישור" },
    });

    await writeAudit({
      userId: user.id,
      username: user.username,
      action: "update",
      entityType: "Delivery",
      entityId: id,
      before: { status: "טיוטא" },
      after: { status: "ממתין לאישור" },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[POST /api/deliveries/[id]/submit]", err);
    return NextResponse.json({ error: "שגיאת שרת פנימית — נסה שנית" }, { status: 500 });
  }
}
