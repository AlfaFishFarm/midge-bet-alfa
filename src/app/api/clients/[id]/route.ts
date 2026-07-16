import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

function emptyToNull(v: string | undefined): string | null {
  return v && v.trim() !== "" ? v.trim() : null;
}

const updateClientSchema = z.object({
  name: z.string().min(1, "שם לקוח הוא שדה חובה"),
  address: z.string().min(1, "כתובת היא שדה חובה"),
  contactInfo: z.string().min(1, "פרטי קשר הם שדה חובה"),
  notes: z.string().optional(),
});

export const GET = withModuleAccess(
  "תפעול",
  AccessLevel.VIEW_ONLY,
  async (req: NextRequest) => {
    const id = new URL(req.url).pathname.split("/").pop()!;
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        contacts: { orderBy: { name: "asc" } },
        carriers: { include: { carrier: true } },
      },
    });
    if (!client) {
      return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
    }
    return NextResponse.json(client);
  }
);

export const PATCH = withModuleAccess(
  "תפעול",
  AccessLevel.DOMAIN_MANAGE,
  async (req: NextRequest, { user }) => {
    const id = new URL(req.url).pathname.split("/").pop()!;
    const body = await req.json().catch(() => null);
    const parsed = updateClientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
    }

    const updated = await prisma.client.update({
      where: { id },
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
      action: "update",
      entityType: "Client",
      entityId: id,
      before: existing,
      after: updated,
    });

    return NextResponse.json({ id });
  }
);
