import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

// Carriers (מובילים/נהגים) are top-level, not nested under a client - a
// carrier can serve multiple clients (spec page 11), linked via
// /api/clients/[id]/carriers. Soft-delete only, same rule as Contact (spec
// page 13).

function emptyToNull(v: string | undefined): string | null {
  return v && v.trim() !== "" ? v.trim() : null;
}

const createCarrierSchema = z.object({
  name: z.string().min(1, "שם המוביל הוא שדה חובה"),
  licensePlate: z.string().optional(),
  vehicleDetails: z.string().optional(),
  driverPhone: z.string().optional(),
});

export const POST = withModuleAccess(
  "תפעול",
  AccessLevel.DOMAIN_MANAGE,
  async (req: NextRequest, { user }) => {
    const body = await req.json().catch(() => null);
    const parsed = createCarrierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    try {
      const carrier = await prisma.carrier.create({
        data: {
          name: data.name,
          licensePlate: emptyToNull(data.licensePlate),
          vehicleDetails: emptyToNull(data.vehicleDetails),
          driverPhone: emptyToNull(data.driverPhone),
          active: true,
        },
      });

      await writeAudit({
        userId: user.id,
        username: user.username,
        action: "create",
        entityType: "Carrier",
        entityId: carrier.id,
        after: carrier,
      });

      return NextResponse.json({ id: carrier.id }, { status: 201 });
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

export const GET = withModuleAccess(
  "תפעול",
  AccessLevel.VIEW_ONLY,
  async (req: NextRequest) => {
    // Default: active only (for pickers). ?all=1 returns everything (for the
    // carriers management list, which needs to show inactive rows too).
    const showAll = new URL(req.url).searchParams.get("all") === "1";
    const carriers = await prisma.carrier.findMany({
      where: showAll ? {} : { active: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(carriers);
  }
);
