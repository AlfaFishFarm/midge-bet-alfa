import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "./current-user";
import { bestAccessForModule, meetsRequirement } from "./permissions";

type GuardedHandler = (
  req: NextRequest,
  ctx: { user: CurrentUser }
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps a Next.js API route handler so the module-permission check is
 * impossible to forget. From the security review (2026-06-20): before this
 * existed, nothing forced every future route to call requireModuleAccess -
 * it depended on each route author remembering to. Use this for every API
 * route under a module from here on:
 *
 *   export const POST = withModuleAccess("תפעול", AccessLevel.OPERATIONS, async (req, { user }) => {
 *     ...
 *   });
 */
export function withModuleAccess(
  moduleName: string,
  requiredLevel: number,
  handler: GuardedHandler
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
    }
    const level = bestAccessForModule(user.permissions, moduleName);
    if (!meetsRequirement(level, requiredLevel)) {
      return NextResponse.json({ error: "אין לך הרשאה לבצע פעולה זו" }, { status: 403 });
    }
    return handler(req, { user });
  };
}
