import { prisma } from "./db";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "login_failed"
  | "login_blocked"
  | "logout"
  | "open_cycle"
  | "close_cycle";

interface WriteAuditArgs {
  userId?: string | null;
  username: string;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

/**
 * Server-side audit write. Call this from API routes/server actions on every
 * create/update/delete and on login/logout - never rely on the client to
 * report what happened, since that defeats the point of an audit trail.
 */
export async function writeAudit(args: WriteAuditArgs): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: args.userId ?? null,
      username: args.username,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId ?? null,
      before: args.before !== undefined ? JSON.stringify(args.before) : null,
      after: args.after !== undefined ? JSON.stringify(args.after) : null,
      ip: args.ip ?? null,
    },
  });
}

const LOGIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_LOCKOUT_THRESHOLD = 5; // failed attempts within the window

/**
 * DB-backed login throttle (reuses AuditLog instead of a separate table/cache,
 * so it works correctly across multiple serverless instances - an in-memory
 * counter would not, since each instance has its own memory).
 * Added after the security review flagged login as having no brute-force
 * protection at all.
 */
export async function isLoginLocked(username: string): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_LOCKOUT_WINDOW_MS);
  const recentFailures = await prisma.auditLog.count({
    where: {
      action: "login_failed",
      username,
      createdAt: { gte: since },
    },
  });
  return recentFailures >= LOGIN_LOCKOUT_THRESHOLD;
}
