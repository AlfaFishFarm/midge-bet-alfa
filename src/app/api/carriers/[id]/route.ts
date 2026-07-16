import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

// No DELETE route here on purpose - same soft-delete-only rule as Contact
// (spec page 13). The UI's "delete" action calls this PATCH with active:false.

function emptyToNull(v: string | undefined): string | null {
  return v && v.trim() !== "" ? v.trim() : null;
}

const updateCarrierSchema = z.object({
  name: z.string().min(1, "שם המוביל הוא שדה חובה"),
  licensePlate: z.string().optional(),
  vehicleDetails: z.string().optional(),
  driverPhone: z.string().optional(),
  active: z.boolean(),
});

export const PATCH = withModuleAccess(
  "תפעול",
  AccessLevel.DOMAIN_MANAGE,
  async (req: NextRequest, { user }) => {
    const id = new URL(req.url).pathname.split("/").pop()!;

    const body = await req.json().catch(() => null);
    const parsed = updateCarrierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const existing = await prisma.carrier.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "מוביל לא נמצא" }, { status: 404 });
    }

    try {
      const updated = await prisma.carrier.update({
        where: { id },
        data: {
          name: data.name,
          licensePlate: emptyToNull(data.licensePlate),
          vehicleDetails: emptyToNull(data.vehicleDetails),
          driverPhone: emptyToNull(data.driverPhone),
          active: data.active,
        },
      });

      await writeAudit({
        userId: user.id,
        username: user.username,
        action: existing.active && !data.active ? "delete" : "update",
        entityType: "Carrier",
        entityId: id,
        before: existing,
        after: updated,
      });

      return NextResponse.json({ id });
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
        return NextResponse.json(
          { error: "מספר רישוי זה כבר קיים במערכת עבור מוביל אחר" },
          { status: 409 }
        );
      }
      throw err;
    }
  }
);
