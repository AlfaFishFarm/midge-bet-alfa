import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { bestAccessForModule, meetsRequirement, AccessLevel } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { isVirtualPondType } from "@/lib/cycles";

export default async function PondsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const level = bestAccessForModule(user.permissions, "תפעול");
  if (!meetsRequirement(level, AccessLevel.VIEW_ONLY)) {
    return (
      <main className="p-6">
        <p className="text-red-600">אין לך הרשאה לצפות בעמוד זה.</p>
      </main>
    );
  }

  const ponds = await prisma.pond.findMany({
    include: {
      pondType: true,
      growthCycles: {
        where: { closedAt: null },
        select: { id: true, priorityCycleCode: true, openedAt: true },
        take: 1,
      },
    },
    orderBy: [{ code: "asc" }, { name: "asc" }],
  });

  const physical = ponds.filter((p) => !isVirtualPondType(p.pondType.name));
  const virtual = ponds.filter((p) => isVirtualPondType(p.pondType.name));

  function PondTable({ rows, title }: { rows: typeof ponds; title: string }) {
    return (
      <section className="mb-8">
        <h2 className="text-base font-semibold text-gray-700 mb-3">{title}</h2>
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-gray-700">שם</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700">סוג</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700">שטח (דונם)</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700">נפח</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700">מחזור פעיל</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((p) => {
                const cycle = p.growthCycles[0];
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.pondType.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.areaDunam != null ? p.areaDunam : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.volume != null ? p.volume : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {cycle ? (
                        <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 rounded-full px-2.5 py-0.5 text-xs font-medium">
                          <span aria-hidden>●</span>
                          {cycle.priorityCycleCode ?? "פתוח"}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">אין</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="text-center text-gray-400 py-8">אין נתונים</p>
          )}
        </div>
      </section>
    );
  }

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold text-brand-700 mb-6">בריכות</h1>
      <PondTable rows={physical} title="בריכות פיזיות" />
      {virtual.length > 0 && <PondTable rows={virtual} title="בריכות וירטואליות" />}
    </main>
  );
}
