import type { Metadata } from "next";
import "./globals.css";
import { getCurrentUser } from "@/lib/current-user";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "מדגה בית-אלפא",
  description: "מערכת לניהול מדגה בית-אלפא",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="he" dir="rtl">
      <body className="bg-gray-50 text-gray-900">
        {user ? (
          <AppShell workerName={user.workerName} permissions={user.permissions}>
            {children}
          </AppShell>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
