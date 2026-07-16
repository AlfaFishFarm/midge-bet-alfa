import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

// No DELETE route here on purpose - spec page 13: "במחיקת איש קשר או נהג רק
// מסמנים את השדה 'פעיל' כ-FALSE - לא לשבש מידע". Deleting a contact from the
// UI must call this PATCH with active:false, never a hard delete.

function emptyToNull(v: string | undefined): string | null {
  return v && v.trim() !== "" ? v.trim() : null;
}

const updateContactSchema = z.object({
  name: z.string().min(1, "שם איש קשר הוא שדה חובה"),
  phone: z.string().optional(),
  role: z.string().optional(),
  active: z.boolean(),
});

export const PATCH = withModuleAccess(
  "תפעול",
  AccessLevel.DOMAIN_MANAGE,
  async (req: NextRequest, { user }) => {
    const contactId = new URL(req.url).pathname.split("/").pop()!;

    const body = await req.json().catch(() => null);
    const parsed = updateContactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const existing = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!existing) {
      return NextResponse.json({ error: "איש קשר לא נמצא" }, { status: 404 });
    }

    const updated = await prisma.contact.update({
      where: { id: contactId },
      data: {
        name: data.name,
        phone: emptyToNull(data.phone),
        role: emptyToNull(data.role),
        active: data.active,
      },
    });

    await writeAudit({
      userId: user.id,
      username: user.username,
      action: existing.active && !data.active ? "delete" : "update",
      entityType: "Contact",
      entityId: contactId,
      before: existing,
      after: updated,
    });

    return NextResponse.json({ id: contactId });
  }
);
