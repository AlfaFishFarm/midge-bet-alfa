import { cache } from "react";
import { prisma } from "./db";
import { getSessionFromCookies } from "./auth";
import { getUserPermissions, type ModuleAccess } from "./permissions";

export interface CurrentUser {
  id: string;
  username: string;
  workerName: string;
  permissions: ModuleAccess[];
}

/**
 * Resolves the logged-in user once per request and memoizes it (React's
 * cache()) so layout.tsx and any page rendered under it can both call this
 * without doubling up the session/DB lookups on every request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSessionFromCookies();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: { worker: true },
  });
  if (!user || !user.active) return null;

  const permissions = await getUserPermissions(user.id);
  const workerName = user.worker ? `${user.worker.firstName} ${user.worker.lastName}` : user.username;

  return { id: user.id, username: user.username, workerName, permissions };
});
