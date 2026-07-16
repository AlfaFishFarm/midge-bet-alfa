import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { bestAccessForModule, meetsRequirement, AccessLevel } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import WorkerForm from "../WorkerForm";

export default async function NewWorkerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const level = bestAccessForModule(user.permissions, "אדמיניסטרציה");
  if (!meetsRequirement(level, AccessLevel.EXECUTIVE)) {
    return (
      <main className="p-6">
        <p className="text-red-600">אין לך הרשאה לניהול משתמשים.</p>
      </main>
    );
  }

  const [roles, modules] = await Promise.all([
    prisma.role.findMany({ orderBy: { name: "asc" } }),
    prisma.appModule.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <main className="p-6">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/admin/users" className="hover:text-brand-600">
          ניהול משתמשים
        </Link>
        <span>›</span>
        <span>עובד חדש</span>
      </div>

      <h1 className="text-xl font-bold text-brand-700 mb-6">רישום עובד חדש</h1>

      <WorkerForm mode="create" roles={roles} modules={modules} />
    </main>
  );
}
