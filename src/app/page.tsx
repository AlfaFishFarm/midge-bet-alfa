import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";

// דשבורד הוא עמוד הבית לכל המשתמשים (Dean, 2026-07-13)
export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect("/dashboard");
}
