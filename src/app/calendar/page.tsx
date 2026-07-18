import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";

// לוח שנה — spec v2 p.48 / אפיון 16.07.26
// שתי לשוניות: מלאי דגים (צבעים לפי מין) + יומן צוות משותף
// מלאי דגים: placeholder — ממתין לעיצוב ולוגיקה מסיוון
// יומן צוות: placeholder — דורש מודל CalendarEntry (שאלה פתוחה [לוח שנה])

type CalTab = "inventory" | "journal";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const activeTab: CalTab =
    searchParams.tab === "journal" ? "journal" : "inventory";

  const tabStyle = (slug: CalTab): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 5,
    padding: "8px 16px", fontSize: 13, fontWeight: activeTab === slug ? 700 : 500,
    color: activeTab === slug ? "#1B3A2B" : "#6b7280",
    background: activeTab === slug ? "white" : "transparent",
    borderRadius: "8px 8px 0 0",
    border: activeTab === slug ? "2px solid #e5e7eb" : "2px solid transparent",
    borderBottom: activeTab === slug ? "2px solid white" : "2px solid transparent",
    textDecoration: "none",
    marginBottom: activeTab === slug ? -2 : 0,
    cursor: "pointer",
  });

  return (
    <div style={{ background: "#F2EDE3", minHeight: "calc(100vh - 54px)" }} dir="rtl">

      {/* Header */}
      <div style={{ background: "#3a246b", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 54, zIndex: 190 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "white", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            חזרה
          </Link>
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>דשבורד ›</span>
          <span style={{ color: "white", fontSize: 12, fontWeight: 600 }}>לוח שנה</span>
        </div>
        <span style={{ color: "white", fontWeight: 700, fontSize: 15 }}>📅 לוח שנה</span>
      </div>

      {/* Tabs */}
      <div style={{ padding: "16px 16px 0", maxWidth: 800, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 4, borderBottom: "2px solid #e5e7eb", marginBottom: 0 }}>
          <Link href="/calendar?tab=inventory" style={tabStyle("inventory")}>
            🐟 מלאי דגים בבריכות
          </Link>
          <Link href="/calendar?tab=journal" style={tabStyle("journal")}>
            📓 יומן צוות
          </Link>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px 16px", maxWidth: 800, margin: "0 auto" }}>

        {activeTab === "inventory" && (
          <div style={{ background: "white", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{ background: "#3a246b", color: "white", padding: "12px 16px", fontSize: 13, fontWeight: 700 }}>
              🐟 מלאי דגים — תצוגה לפי בריכה וצבע
            </div>
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 8 }}>בפיתוח</div>
              <div style={{ fontSize: 12, color: "#9ca3af", maxWidth: 320, margin: "0 auto" }}>
                תצוגת לוח שנה עם מלאי דגים לפי בריכה — כל מין דג מוצג בצבע שונה.
                הלוגיקה והעיצוב ממתינים לאיפיון סיוון.
              </div>
            </div>
          </div>
        )}

        {activeTab === "journal" && (
          <div style={{ background: "white", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{ background: "#3a246b", color: "white", padding: "12px 16px", fontSize: 13, fontWeight: 700 }}>
              📓 יומן צוות משותף
            </div>
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📓</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 8 }}>בפיתוח</div>
              <div style={{ fontSize: 12, color: "#9ca3af", maxWidth: 320, margin: "0 auto" }}>
                יומן משותף לצוות — רשומות לפי תאריך לכל הצוות.
                דורש מודל CalendarEntry בסכמה — ממתין לאישור דין.
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
