import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";

const grantSchema = z.object({
  moduleId: z.string().min(1),
  roleId: z.string().min(1),
  accessLevel: z.number().int().min(1).max(6),
});

const updateWorkerSchema = z.object({
  firstName: z.string().min(1, "שם פרטי הוא שדה חובה"),
  lastName: z.string().optional(),
  latinFirstName: z.string().optional(),
  latinLastName: z.string().optional(),
  nickname: z.string().optional(),
  language: z.string().optional(),
  roleTitle: z.string().optional(),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  email: z.string().optional(),
  email2: z.string().optional(),
  priorityEmployeeNo: z.string().optional(),
  active: z.boolean(),
  // Account fields - optional. If the worker has no account yet, sending both
  // creates one. If they already have one, username may be changed and/or a
  // new password set (newPassword empty/omitted = leave password as-is).
  username: z.string().min(1).optional(),
  newPassword: z.string().min(8, "סיסמה חייבת להיות באורך 8 תווים לפחות").optional(),
  grants: z.array(grantSchema).default([]),
});

function emptyToNull(v: string | undefined): string | null {
  return v && v.trim() !== "" ? v.trim() : null;
}

interface Params {
  params: { id: string };
}

export const PATCH = withModuleAccess(
  "אדמיניסטרציה",
  AccessLevel.EXECUTIVE,
  async (req: NextRequest, { user }) => {
    const url = new URL(req.url);
    const id = decodeURIComponent(url.pathname.split("/").pop()!);

    const body = await req.json().catch(() => null);
    const parsed = updateWorkerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const existing = await prisma.worker.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "עובד לא נמצא" }, { status: 404 });
    }

    if (data.grants.length > 0) {
      const moduleIds = [...new Set(data.grants.map((g) => g.moduleId))];
      const roleIds = [...new Set(data.grants.map((g) => g.roleId))];
      const [foundModules, foundRoles] = await Promise.all([
        prisma.appModule.findMany({ where: { id: { in: moduleIds } } }),
        prisma.role.findMany({ where: { id: { in: roleIds } } }),
      ]);
      if (foundModules.length !== moduleIds.length || foundRoles.length !== roleIds.length) {
        return NextResponse.json({ error: "תחום או תפקיד שנבחר לא נמצא" }, { status: 404 });
      }
    }

    if (!existing.userAccountId && data.username && !data.newPassword) {
      return NextResponse.json(
        { error: "ליצירת חשבון משתמש נדרשים גם שם משתמש וגם סיסמה ראשונית" },
        { status: 422 }
      );
    }

    try {
      await prisma.$transaction(async (tx) => {
        let userAccountId = existing.userAccountId;

        if (!existing.userAccountId && data.username && data.newPassword) {
          const passwordHash = await hashPassword(data.newPassword);
          const account = await tx.user.create({
            data: { username: data.username, passwordHash, active: data.active },
          });
          userAccountId = account.id;
        } else if (existing.userAccountId) {
          const accountUpdate: { username?: string; passwordHash?: string; active: boolean } = {
            active: data.active,
          };
          if (data.username && data.username !== existing.user?.username) {
            accountUpdate.username = data.username;
          }
          if (data.newPassword) {
            accountUpdate.passwordHash = await hashPassword(data.newPassword);
          }
          await tx.user.update({ where: { id: existing.userAccountId }, data: accountUpdate });
        }

        await tx.worker.update({
          where: { id },
          data: {
            firstName: data.firstName,
            lastName: emptyToNull(data.lastName),
            latinFirstName: emptyToNull(data.latinFirstName),
            latinLastName: emptyToNull(data.latinLastName),
            nickname: emptyToNull(data.nickname),
            language: emptyToNull(data.language) ?? "עברית",
            roleTitle: emptyToNull(data.roleTitle),
            phone: emptyToNull(data.phone),
            phone2: emptyToNull(data.phone2),
            email: emptyToNull(data.email),
            email2: emptyToNull(data.email2),
            priorityEmployeeNo: emptyToNull(data.priorityEmployeeNo),
            active: data.active,
            userAccountId,
          },
        });

        // Replace the grant set wholesale - simpler and safer than diffing,
        // and this is an admin-only low-frequency action.
        await tx.workerRole.deleteMany({ where: { workerId: id } });
        for (const grant of data.grants) {
          await tx.workerRole.create({
            data: {
              workerId: id,
              roleId: grant.roleId,
              moduleId: grant.moduleId,
              accessLevel: grant.accessLevel,
            },
          });
        }
      });

      await writeAudit({
        userId: user.id,
        username: user.username,
        action: "update",
        entityType: "Worker",
        entityId: id,
        before: { firstName: existing.firstName, lastName: existing.lastName, active: existing.active },
        after: { firstName: data.firstName, lastName: data.lastName, active: data.active, grants: data.grants },
      });

      return NextResponse.json({ id });
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        return NextResponse.json(
          { error: "שם המשתמש הזה כבר קיים במערכת - בחר שם משתמש אחר" },
          { status: 409 }
        );
      }
      throw err;
    }
  }
);
