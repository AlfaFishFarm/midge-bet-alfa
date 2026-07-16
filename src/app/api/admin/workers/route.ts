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

const createWorkerSchema = z.object({
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
  active: z.boolean().default(true),
  // Account fields - optional: a worker can exist without a login account.
  username: z.string().min(1).optional(),
  initialPassword: z.string().min(8, "סיסמה חייבת להיות באורך 8 תווים לפחות").optional(),
  grants: z.array(grantSchema).default([]),
});

function emptyToNull(v: string | undefined): string | null {
  return v && v.trim() !== "" ? v.trim() : null;
}

export const POST = withModuleAccess(
  "אדמיניסטרציה",
  AccessLevel.EXECUTIVE,
  async (req: NextRequest, { user }) => {
    const body = await req.json().catch(() => null);
    const parsed = createWorkerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // Account creation requires both username and initial password together.
    if ((data.username && !data.initialPassword) || (!data.username && data.initialPassword)) {
      return NextResponse.json(
        { error: "ליצירת חשבון משתמש נדרשים גם שם משתמש וגם סיסמה ראשונית" },
        { status: 422 }
      );
    }

    // Validate every referenced role/module actually exists before writing anything.
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

    try {
      const result = await prisma.$transaction(async (tx) => {
        let userAccountId: string | null = null;
        if (data.username && data.initialPassword) {
          const passwordHash = await hashPassword(data.initialPassword);
          const account = await tx.user.create({
            data: { username: data.username, passwordHash, active: data.active },
          });
          userAccountId = account.id;
        }

        const worker = await tx.worker.create({
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
            userAccountId,
            active: data.active,
          },
        });

        for (const grant of data.grants) {
          await tx.workerRole.create({
            data: {
              workerId: worker.id,
              roleId: grant.roleId,
              moduleId: grant.moduleId,
              accessLevel: grant.accessLevel,
            },
          });
        }

        return worker;
      });

      await writeAudit({
        userId: user.id,
        username: user.username,
        action: "create",
        entityType: "Worker",
        entityId: result.id,
        after: { firstName: data.firstName, lastName: data.lastName, username: data.username ?? null, grants: data.grants },
      });

      return NextResponse.json({ id: result.id });
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
