import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, createSessionToken, setSessionCookie } from "@/lib/auth";
import { writeAudit, isLoginLocked } from "@/lib/audit";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// A bcrypt hash of a random value, used to run a dummy comparison when the
// username doesn't exist - this keeps the response time/shape the same
// either way, so the endpoint doesn't leak which usernames are registered.
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8Imafsdf90/8WTrqxBSDhJgEMcc8Ny";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "שם משתמש וסיסמה נדרשים" }, { status: 400 });
  }
  const { username, password } = parsed.data;
  // x-real-ip is set by Vercel and is not spoofable (Vercel strips and re-adds it).
  // Fall back to the first entry of x-forwarded-for for other environments.
  const ip = (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  ) ?? undefined;

  if (await isLoginLocked(username)) {
    await writeAudit({ username, action: "login_blocked", entityType: "User", ip });
    return NextResponse.json(
      { error: "יותר מדי ניסיונות כושלים. נסה שוב בעוד כמה דקות." },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({ where: { username } });
  const validPassword = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !user.active || !validPassword) {
    await writeAudit({
      username,
      action: "login_failed",
      entityType: "User",
      entityId: user?.id ?? null,
      ip,
    });
    return NextResponse.json({ error: "שם משתמש או סיסמה שגויים" }, { status: 401 });
  }

  const token = await createSessionToken({ sub: user.id, username: user.username });
  await setSessionCookie(token);
  await writeAudit({
    userId: user.id,
    username: user.username,
    action: "login",
    entityType: "User",
    entityId: user.id,
    ip,
  });

  return NextResponse.json({ ok: true });
}
