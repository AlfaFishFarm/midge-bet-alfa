import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { bestAccessForModule, AccessLevel } from "@/lib/permissions";

interface Props {
  title: string;
  moduleName: string;
  description: string;
}

/**
 * Shared shell for not-yet-built module screens. Still enforces the real
 * server-side permission check (so the RBAC pattern is exercised end-to-end
 * from day one), just renders a placeholder body instead of real content.
 * Swap the body out per-screen as each one gets built (task #7).
 */
export default async function PlaceholderModulePage({ title, moduleName, description }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const level = bestAccessForModule(user.permissions, moduleName);
  if (level >= AccessLevel.NO_ACCESS) {
    return (
      <main className="p-6">
        <p className="text-red-600">אין לך הרשאה לצפות בעמוד זה.</p>
      </main>
    );
  }

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold text-brand-700 mb-2">{title}</h1>
      <p className="text-gray-500">{description}</p>
    </main>
  );
}
