import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { bestAccessForModule, meetsRequirement, AccessLevel, hasManagerRole } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

// GET /api/deliveries?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const level = bestAccessForModule(user.permissions, "תפעול");
  // Spec p31: list access for any manager-type role (ניהול תחום/הנהלה/מנהל צופה),
  // matching the management page gate.
  if (!meetsRequirement(level, AccessLevel.VIEW_ONLY) || !hasManagerRole(user.permissions, "תפעול")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const fromDate = from ? new Date(from) : (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d; })();
  const toDate = to ? new Date(to + "T23:59:59") : new Date();

  const deliveries = await prisma.delivery.findMany({
    where: { status: { in: ["הופק", "מבוטל"] }, date: { gte: fromDate, lte: toDate } },
    include: {
      client: { select: { id: true, name: true } },
      details: { select: { quantity: true } },
    },
    orderBy: { date: "desc" },
  });

  const rows = deliveries.map((d) => ({
    id: d.id,
    date: d.date.toISOString(),
    clientName: d.client?.name ?? (d as any).clientName ?? "לקוח מזדמן",
    totalQuantity: d.details.reduce((sum, det) => sum + det.quantity, 0),
    status: d.status,
  }));

  return NextResponse.json(rows);
}

// POST /api/deliveries
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const level = bestAccessForModule(user.permissions, "תפעול");
  if (!meetsRequirement(level, AccessLevel.VIEW_ONLY)) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const body = await req.json() as {
    clientId?: string;
    clientName?: string;
    orderRef?: string;
    date: string;
    producerWorkerId?: string;
    managerId?: string;
    carrierId?: string;
    driverName?: string;
    loadingTime?: string;
    vetApprovalRef?: string;
    notes?: string;
    details: Array<{
      transferDetailId?: string;
      fishTypeDescription: string;
      sourcePondName?: string;
      quantity: number;
      unit?: string;
      grossNet?: string;
    }>;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let delivery: Record<string, unknown>;
  try {
  delivery = await (prisma.delivery as any).create({
    data: {
      clientId: body.clientId ?? undefined,
      clientName: body.clientName ?? undefined,
      orderRef: body.orderRef ?? undefined,
      date: new Date(body.date),
      producerWorkerId: body.producerWorkerId ?? undefined,
      managerId: body.managerId ?? undefined,
      carrierId: body.carrierId ?? undefined,
      driverName: body.driverName ?? undefined,
      loadingTime: body.loadingTime ?? undefined,
      vetApprovalRef: body.vetApprovalRef ?? undefined,
      notes: body.notes ?? undefined,
      status: "טיוטא",
      details: {
        create: body.details.map((d) => ({
          transferDetailId: d.transferDetailId ?? undefined,
          fishTypeDescription: d.fishTypeDescription,
          sourcePondName: d.sourcePondName ?? undefined,
          quantity: d.quantity,
          unit: d.unit ?? undefined,
          grossNet: d.grossNet ?? undefined,
        })),
      },
    },
    include: { details: true },
  });
  } catch (err) {
    console.error("[POST /api/deliveries] prisma error:", err);
    return NextResponse.json({ error: "שגיאה בשמירת תעודת משלוח" }, { status: 500 });
  }

  await writeAudit({
    userId: user.id,
    username: user.username,
    action: "create",
    entityType: "Delivery",
    entityId: (delivery as any).id as string,
    after: { status: "טיוטא", clientId: body.clientId, detailCount: body.details.length },
  });

  return NextResponse.json(delivery, { status: 201 });
}
