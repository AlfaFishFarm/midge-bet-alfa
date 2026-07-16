import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

function emptyToNull(v: string | undefined): string | null {
  return v && v.trim() !== "" ? v.trim() : null;
}

const createContactSchema = z.object({
  name: z.string().min(1, "שם איש קשר הוא שדה חובה"),
  phone: z.string().optional(),
  role: z.string().optional(),
});

export const POST = withModuleAccess(
  "תפעול",
  AccessLevel.DOMAIN_MANAGE,
  async (req: NextRequest, { user }) => {
    // /api/clients/[id]/contacts -> id is the segment before "contacts"
    const parts = new URL(req.url).pathname.split("/");
    const clientId = parts[parts.length - 2];

    const body = await req.json().catch(() => null);
    const parsed = createContactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
    }

    const contact = await prisma.contact.create({
      data: {
        clientId,
        name: data.name,
        phone: emptyToNull(data.phone),
        role: emptyToNull(data.role),
        active: true,
      },
    });

    await writeAudit({
      userId: user.id,
      username: user.username,
      action: "create",
      entityType: "Contact",
      entityId: contact.id,
      after: contact,
    });

    return NextResponse.json({ id: contact.id }, { status: 201 });
  }
);
