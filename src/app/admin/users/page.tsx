import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { bestAccessForModule, meetsRequirement, AccessLevel } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export default async function AdminUsersPage() {
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

  const workers = await prisma.worker.findMany({
    orderBy: [{ active: "desc" }, { firstName: "asc" }],
    include: {
      user: true,
      workerRoles: { include: { module: true, role: true } },
    },
  });

  return (
    <main className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-brand-700">ניהול משתמשים</h1>
          <p className="text-gray-500 text-sm">עובדים, חשבונות משתמש והרשאות</p>
        </div>
        <Link
          href="/admin/users/new"
          className="bg-brand-600 hover:bg-brand-700 text-white rounded-md px-4 py-2 font-medium"
        >
          + עובד חדש
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">שם</th>
              <th className="px-4 py-3 font-medium">שם משתמש</th>
              <th className="px-4 py-3 font-medium">הרשאות</th>
              <th className="px-4 py-3 font-medium">סטטוס</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {workers.map((w) => (
              <tr key={w.id} className={w.active ? "" : "opacity-50"}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">
                    {w.firstName} {w.lastName ?? ""}
                  </div>
                  {w.roleTitle && <div className="text-gray-400 text-xs">{w.roleTitle}</div>}
                </td>
                <td className="px-4 py-3 text-gray-600">{w.user?.username ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">
                  {w.workerRoles.length === 0
                    ? "—"
                    : w.workerRoles.map((wr) => `${wr.module.name} (${wr.role.name})`).join(", ")}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs rounded-full px-2 py-0.5 ${
                      w.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {w.active ? "פעיל" : "מושבת"}
                  </span>
                </td>
                <td className="px-4 py-3 text-left">
                  <Link href={`/admin/users/${w.id}`} className="text-brand-600 hover:text-brand-700">
                    עריכה
                  </Link>
                </td>
              </tr>
            ))}
            {workers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  אין עדיין עובדים רשומים במערכת
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
