import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { bestAccessForModule, meetsRequirement, AccessLevel } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import WorkerForm from "../WorkerForm";

interface Props {
  params: { id: string };
}

export default async function EditWorkerPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const level = bestAccessForModule(user.permissions, "אדמיניסטרציה");
  const isAdmin = user.username === "admin" || bestAccessForModule(user.permissions, "אדמיניסטרציה") === 1;
  if (!meetsRequirement(level, AccessLevel.EXECUTIVE)) {
    return (
      <main className="p-6">
        <p className="text-red-600">אין לך הרשאה לניהול משתמשים.</p>
      </main>
    );
  }

  // params.id may arrive URL-encoded when the seed id contains non-ASCII chars
  // (e.g. seed-worker-דנה → seed-worker-%D7%93%D7%A0%D7%94)
  const workerId = decodeURIComponent(params.id);

  const [worker, roles, modules] = await Promise.all([
    (prisma.worker as any).findUnique({
      where: { id: workerId },
      include: { user: true, workerRoles: true },
    }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
    prisma.appModule.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!worker) notFound();

  return (
    <main className="p-6">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/admin/users" className="hover:text-brand-600">
          ניהול משתמשים
        </Link>
        <span>›</span>
        <span>
          {worker.firstName} {worker.lastName ?? ""}
        </span>
      </div>

      <h1 className="text-xl font-bold text-brand-700 mb-6">עריכת פרטי עובד</h1>

      <WorkerForm
        mode="edit"
        workerId={worker.id}
        roles={roles}
        modules={modules}
        isAdmin={isAdmin}
        initial={{
          firstName: worker.firstName,
          lastName: worker.lastName ?? "",
          latinFirstName: worker.latinFirstName ?? "",
          latinLastName: worker.latinLastName ?? "",
          nickname: worker.nickname ?? "",
          language: worker.language ?? "עברית",
          roleTitle: worker.roleTitle ?? "",
          phone: worker.phone ?? "",
          phone2: worker.phone2 ?? "",
          email: worker.email ?? "",
          email2: worker.email2 ?? "",
          priorityEmployeeNo: worker.priorityEmployeeNo ?? "",
          active: worker.active,
          username: worker.user?.username ?? null,
          grants: worker.workerRoles.map((wr: { moduleId: string; roleId: string; accessLevel: number }) => ({
            moduleId: wr.moduleId,
            roleId: wr.roleId,
            accessLevel: wr.accessLevel,
          })),
          hasSignature: !!(worker as any).digitalSignature,
        }}
      />
    </main>
  );
}
