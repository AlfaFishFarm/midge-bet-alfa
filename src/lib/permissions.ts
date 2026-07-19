import { prisma } from "./db";

// Lower number = more access. Matches WorkerRole.accessLevel in schema.prisma.
export const AccessLevel = {
  FULL_EDIT: 1, // ניהול תחום + עריכה מלאה
  DOMAIN_MANAGE: 2, // ניהול תחום
  EXECUTIVE: 3, // הנהלה
  OPERATIONS: 4, // תפעול שוטף - הזנת נתונים יומיומית
  VIEW_ONLY: 5, // ניהול ללא עריכה / צפייה בלבד
  NO_ACCESS: 6, // אורח / ללא הרשאה
} as const;

export interface ModuleAccess {
  moduleId: string;
  moduleName: string;
  roleId: string;
  roleName: string;
  accessLevel: number;
}

/**
 * Loads a user's full permission set fresh from the DB on every call.
 * Deliberately not cached in the JWT/session: if an admin revokes a worker's
 * access, that must take effect on the very next request, not after the
 * token expires.
 */
export async function getUserPermissions(userId: string): Promise<ModuleAccess[]> {
  const worker = await prisma.worker.findFirst({
    where: { userAccountId: userId, active: true },
    include: {
      workerRoles: {
        include: { module: true, role: true },
      },
    },
  });
  if (!worker) return [];
  return worker.workerRoles.map((wr) => ({
    moduleId: wr.moduleId,
    moduleName: wr.module.name,
    roleId: wr.roleId,
    roleName: wr.role.name,
    accessLevel: wr.accessLevel,
  }));
}

/**
 * Returns the most-permissive (lowest number) access level the user has for
 * a module, or NO_ACCESS if no role grants them anything on it.
 */
export function bestAccessForModule(perms: ModuleAccess[], moduleName: string): number {
  const relevant = perms.filter((p) => p.moduleName === moduleName);
  if (relevant.length === 0) return AccessLevel.NO_ACCESS;
  return Math.min(...relevant.map((p) => p.accessLevel));
}

/** True if `actual` access is at least as permissive as `required` (lower number wins). */
export function meetsRequirement(actual: number, required: number): boolean {
  return actual <= required;
}

/**
 * Spec p23-24 (2026-07-19, Dean's ruling: "כמו באיפיון"): management screens are
 * for manager-type roles only — ניהול תחום, הנהלה, וגם "מנהל צופה" (a manager
 * whose access level is view-only) — but NOT for regular field workers. The
 * linear access-level scale cannot express that (viewer-manager=5 sits "below"
 * worker=4), so manager-ness is derived from the ROLE NAME: every manager role
 * in the seed contains "מנהל" (מנהל מדגה/תפעול/הזנה/בריאות), plus "מתכנת"
 * (admin/programmer, sweeping administration rights per spec).
 */
export function hasManagerRole(perms: ModuleAccess[], moduleName: string): boolean {
  return perms.some(
    (p) =>
      p.moduleName === moduleName &&
      (p.roleName.includes("מנהל") || p.roleName === "מתכנת")
  );
}

export class PermissionError extends Error {
  constructor(message = "אין לך הרשאה לבצע פעולה זו") {
    super(message);
    this.name = "PermissionError";
  }
}

/**
 * Throws PermissionError if the user doesn't have at least `required` access
 * to `moduleName`. Call this at the top of every API route / server action
 * that reads or mutates protected data - hiding a button in the UI is not a
 * substitute for a server-side check.
 */
export async function requireModuleAccess(
  userId: string,
  moduleName: string,
  required: number
): Promise<ModuleAccess[]> {
  const perms = await getUserPermissions(userId);
  const level = bestAccessForModule(perms, moduleName);
  if (!meetsRequirement(level, required)) {
    throw new PermissionError();
  }
  return perms;
}
