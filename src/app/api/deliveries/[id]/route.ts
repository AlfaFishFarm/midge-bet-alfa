import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { bestAccessForModule, meetsRequirement, AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const level = bestAccessForModule(user.permissions, "תפעול");
  if (!meetsRequirement(level, AccessLevel.VIEW_ONLY)) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;

  if (body.status === "מבוטל") {
    if (!meetsRequirement(level, AccessLevel.DOMAIN_MANAGE)) {
      return NextResponse.json({ error: "רק מנהלים יכולים לבטל תעודה" }, { status: 403 });
    }
  }

  const existing = await prisma.delivery.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

  if (existing.status === "הופק" && body.status !== "מבוטל") {
    return NextResponse.json({ error: "לא ניתן לעדכן תעודה שהופקה" }, { status: 409 });
  }
  // "ממתין לאישור" can only be edited or cancelled by managers
  if (existing.status === "ממתין לאישור" && body.status !== "מבוטל" && !meetsRequirement(level, AccessLevel.DOMAIN_MANAGE)) {
    return NextResponse.json({ error: "תעודה ממתינה לאישור — רק מנהל יכול לערוך אותה" }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = await (prisma.delivery as any).update({
    where: { id },
    data: {
      ...(body.clientId !== undefined && { clientId: body.clientId }),
      ...(body.clientName !== undefined && { clientName: body.clientName }),
      ...(body.orderRef !== undefined && { orderRef: body.orderRef }),
      ...(body.date !== undefined && { date: new Date(body.date as string) }),
      ...(body.producerWorkerId !== undefined && { producerWorkerId: body.producerWorkerId }),
      ...(body.managerId !== undefined && { managerId: body.managerId }),
      ...(body.carrierId !== undefined && { carrierId: body.carrierId }),
      ...(body.driverName !== undefined && { driverName: body.driverName }),
      ...(body.loadingTime !== undefined && { loadingTime: body.loadingTime }),
      ...(body.vetApprovalRef !== undefined && { vetApprovalRef: body.vetApprovalRef }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.status !== undefined && { status: body.status }),
    },
  });

  await writeAudit({
    userId: user.id,
    username: user.username,
    action: "update",
    entityType: "Delivery",
    entityId: id,
    before: { status: existing.status },
    after: body,
  });

  return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/deliveries/[id]]", err);
    return NextResponse.json({ error: "שגיאת שרת פנימית — נסה שנית" }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
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
      include: { client: true, details: true },
    });

    if (!delivery) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    // Never ship the stored PDF blob (spec p32) in the JSON payload — it can be
    // hundreds of KB; the PDF has its own route.
    const { pdfBlob: _pdfBlob, ...rest } = delivery as typeof delivery & { pdfBlob?: unknown };
    return NextResponse.json(rest);
  } catch (err) {
    console.error("[GET /api/deliveries/[id]]", err);
    return NextResponse.json({ error: "שגיאת שרת פנימית — נסה שנית" }, { status: 500 });
  }
}
