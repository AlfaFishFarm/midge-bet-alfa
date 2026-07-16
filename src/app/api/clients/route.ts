import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

// Client + Contact + Carrier infrastructure, built 2026-06-24 per spec pages
// 10-13. Dean confirmed: build this now, hold off on Order/Delivery/
// DeliveryDetail changes and the delivery-certificate screen itself until
// open-questions items 6,7,14-17 are answered.
// Access tightened 2026-06-27 (task #128, spec-v3 audit): the spec's
// dedicated "עדכון פרטי מובילים" section requires VIEW_ONLY to read but only
// DOMAIN_MANAGE (domain managers) + admin to write - not the looser
// OPERATIONS level used elsewhere for day-to-day entry screens.

function emptyToNull(v: string | undefined): string | null {
  return v && v.trim() !== "" ? v.trim() : null;
}

const createClientSchema = z.object({
  name: z.string().min(1, "שם לקוח הוא שדה חובה"),
  address: z.string().min(1, "כתובת היא שדה חובה"),
  contactInfo: z.string().min(1, "פרטי קשר הם שדה חובה"),
  notes: z.string().optional(),
});

export const POST = withModuleAccess(
  "תפעול",
  AccessLevel.DOMAIN_MANAGE,
  async (req: NextRequest, { user }) => {
    const body = await req.json().catch(() => null);
    const parsed = createClientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const client = await prisma.client.create({
      data: {
        name: data.name,
        address: data.address,
        contactInfo: data.contactInfo,
        notes: emptyToNull(data.notes),
      },
    });

    await writeAudit({
      userId: user.id,
      username: user.username,
      action: "create",
      entityType: "Client",
      entityId: client.id,
      after: client,
    });

    return NextResponse.json({ id: client.id }, { status: 201 });
  }
);

export const GET = withModuleAccess(
  "תפעול",
  AccessLevel.VIEW_ONLY,
  async (_req: NextRequest) => {
    const clients = await prisma.client.findMany({
      include: {
        contacts: { where: { active: true }, orderBy: { name: "asc" } },
        carriers: {
          include: { carrier: true },
        },
      },
      orderBy: { name: "asc" },
    });
    // Only surface active carriers in the link list - same soft-delete
    // filtering as contacts (spec page 13).
    const result = clients.map((c) => ({
      ...c,
      carriers: c.carriers.filter((cc) => cc.carrier.active),
    }));
    return NextResponse.json(result);
  }
);
