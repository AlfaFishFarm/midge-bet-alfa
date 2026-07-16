import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

// Unlinks a carrier from a client (deletes the ClientCarrier join row only -
// the Carrier record itself is untouched and stays soft-delete-only).

export const DELETE = withModuleAccess(
  "תפעול",
  AccessLevel.DOMAIN_MANAGE,
  async (req: NextRequest, { user }) => {
    const parts = new URL(req.url).pathname.split("/");
    const carrierId = parts.pop()!;
    const clientId = parts[parts.length - 2];

    const existing = await prisma.clientCarrier.findUnique({
      where: { clientId_carrierId: { clientId, carrierId } },
    });
    if (!existing) {
      return NextResponse.json({ error: "שיוך לא נמצא" }, { status: 404 });
    }

    await prisma.clientCarrier.delete({
      where: { clientId_carrierId: { clientId, carrierId } },
    });

    await writeAudit({
      userId: user.id,
      username: user.username,
      action: "delete",
      entityType: "ClientCarrier",
      entityId: existing.id,
      before: existing,
    });

    return NextResponse.json({ ok: true });
  }
);
