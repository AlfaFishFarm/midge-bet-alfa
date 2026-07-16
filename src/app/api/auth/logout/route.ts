import { NextResponse } from "next/server";
import { clearSessionCookie, getSessionFromCookies } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export async function POST() {
  const session = await getSessionFromCookies();
  if (session) {
    await writeAudit({
      userId: session.sub,
      username: session.username,
      action: "logout",
      entityType: "User",
      entityId: session.sub,
    });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
