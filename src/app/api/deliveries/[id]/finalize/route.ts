import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { bestAccessForModule, meetsRequirement, AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

// POST /api/deliveries/[id]/finalize
// Manager-only: validates required fields, generates certNumber, sets status = "הופק".
// Accepts both "טיוטא" and "ממתין לאישור" as starting states.
// PDF generation (pdfBlob) is a future enhancement — spec says to store as BLOB.
export async function POST(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const level = bestAccessForModule(user.permissions, "תפעול");
  if (!meetsRequirement(level, AccessLevel.DOMAIN_MANAGE)) {
    return NextResponse.json({ error: "רק מנהלים יכולים להפיק תעודת משלוח" }, { status: 403 });
  }

  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delivery = await (prisma.delivery as any).findUnique({
    where: { id },
    include: { details: true },
  });

  if (!delivery) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  if (delivery.status === "הופק") return NextResponse.json({ error: "תעודה כבר הופקה" }, { status: 409 });
  if (delivery.status === "מבוטל") return NextResponse.json({ error: "לא ניתן להפיק תעודה מבוטלת" }, { status: 409 });
  // Allow both drafts and pending-approval deliveries to be finalized by managers
  if (delivery.status !== "טיוטא" && delivery.status !== "ממתין לאישור") {
    return NextResponse.json({ error: "סטטוס לא תקין להפקה" }, { status: 409 });
  }

  // Spec: "אין לאפשר הפקת תעודת משלוח ללא פרטי נהג ולקוח"
  // לקוח מזדמן: clientId=null but clientName set (per spec — not stored in clients table)
  const hasDriver = delivery.carrierId || delivery.driverName;
  const hasClient = delivery.clientId || delivery.clientName;
  if (!hasClient || !hasDriver) {
    return NextResponse.json({
      error: "חסרים פרטי נהג או לקוח — לא ניתן להפיק את התעודה",
    }, { status: 422 });
  }

  if (!delivery.details || delivery.details.length === 0) {
    return NextResponse.json({ error: "התעודה חייבת לכלול לפחות שורת פירוט אחת" }, { status: 422 });
  }

  // Auto-link carrier to client if not already linked (spec: "יש לעדכן את טבלת CustomersDrivers")
  if (delivery.carrierId && delivery.clientId) {
    await prisma.clientCarrier.upsert({
      where: { clientId_carrierId: { clientId: delivery.clientId, carrierId: delivery.carrierId } },
      create: { clientId: delivery.clientId, carrierId: delivery.carrierId },
      update: {},
    });
  }

  // Generate certNumber: DC-YYYYMMDD-NNN (sequential per calendar day of delivery date)
  const deliveryDate = new Date(delivery.date);
  const year = deliveryDate.getFullYear();
  const month = String(deliveryDate.getMonth() + 1).padStart(2, "0");
  const day = String(deliveryDate.getDate()).padStart(2, "0");
  const datePart = `${year}${month}${day}`;
  const dayStart = new Date(year, deliveryDate.getMonth(), deliveryDate.getDate(), 0, 0, 0, 0);
  const dayEnd = new Date(year, deliveryDate.getMonth(), deliveryDate.getDate(), 23, 59, 59, 999);
  const certifiedToday = await prisma.delivery.count({
    where: {
      date: { gte: dayStart, lte: dayEnd },
      NOT: { certNumber: null },
    },
  });
  const seq = String(certifiedToday + 1).padStart(3, "0");
  const certNumber = `DC-${datePart}-${seq}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = await (prisma.delivery as any).update({
    where: { id },
    data: { status: "הופק", certNumber },
  });

  await writeAudit({
    userId: user.id,
    username: user.username,
    action: "update",
    entityType: "Delivery",
    entityId: id,
    before: { status: delivery.status },
    after: { status: "הופק", certNumber },
  });

  return NextResponse.json(updated);
}
