import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

// Links an existing carrier to a client (ClientCarrier join row). This is a
// many-to-many relation, not the carrier record itself, so it's fine to hard
// delete the link (see [carrierId]/route.ts DELETE) - the soft-delete-only
// rule (spec page 13) applies to the Carrier/Contact records, not this join.

const linkCarrierSchema = z.object({
  carrierId: z.string().min(1, "יש לבחור מוביל"),
  notes: z.string().optional(),
});

export const POST = withModuleAccess(
  "תפעול",
  AccessLevel.DOMAIN_MANAGE,
  async (req: NextRequest, { user }) => {
    const parts = new URL(req.url).pathname.split("/");
    const clientId = parts[parts.length - 2];

    const body = await req.json().catch(() => null);
    const parsed = linkCarrierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const [client, carrier] = await Promise.all([
      prisma.client.findUnique({ where: { id: clientId } }),
      prisma.carrier.findUnique({ where: { id: data.carrierId } }),
    ]);
    if (!client) {
      return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
    }
    if (!carrier || !carrier.active) {
      return NextResponse.json({ error: "מוביל לא נמצא או אינו פעיל" }, { status: 404 });
    }

    try {
      const link = await prisma.clientCarrier.create({
        data: {
          clientId,
          carrierId: data.carrierId,
          notes: data.notes?.trim() || null,
        },
      });

      await writeAudit({
        userId: user.id,
        username: user.username,
        action: "create",
        entityType: "ClientCarrier",
        entityId: link.id,
        after: link,
      });

      return NextResponse.json({ id: link.id }, { status: 201 });
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
        return NextResponse.json({ error: "המוביל הזה כבר משויך ללקוח" }, { status: 409 });
      }
      throw err;
    }
  }
);
