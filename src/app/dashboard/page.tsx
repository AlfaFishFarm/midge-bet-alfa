import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/current-user";
import DailySummaryContent from "@/app/reports/daily-summary/DailySummaryContent";
import PondStatusClient from "@/app/ops/pond-status/PondStatusClient";

// Dashboard — spec v3 p.45 / prototype rep-screen.
// Quick-nav row (sticky) stays visible at all times.
// Clicking a button changes the content pane below WITHOUT leaving the page.
// Uses searchParams.view for tab state (SSR-friendly, URL is bookmarkable).
// prototype: showScreen('daily-summary') / showScreen('current-status')

type View = "home" | "daily-summary" | "pond-status";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { view?: string; date?: string; tab?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const view: View =
    searchParams.view === "daily-summary"
      ? "daily-summary"
      : searchParams.view === "pond-status"
      ? "pond-status"
      : "home";

  const dateStr =
    searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)
      ? searchParams.date
      : todayStr();

  const activeStyle = (v: View) =>
    view === v ? "2px solid white" : "none";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 54px)", background: "#F2EDE3" }}>

      {/* Sticky quick-nav buttons row */}
      <div style={{
        background: "#243d2c",
        padding: "10px 14px",
        display: "flex",
        gap: 8,
        flexShrink: 0,
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        overflowX: "auto",
        position: "sticky",
        top: 54,
        zIndex: 190,
      }}>
        {/* חיישנים — disabled */}
        <div title="חיישנים — בקרוב" style={{ background: "linear-gradient(160deg,#F0983A,#D97B1A)", color: "white", border: "none", borderRadius: 9, padding: "7px 14px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, boxShadow: "0 3px 0 #9E560E", whiteSpace: "nowrap", flexShrink: 0, opacity: 0.55, cursor: "not-allowed" }}>
          <span>📡</span>חיישנים
        </div>

        {/* סיכום יומי */}
        <a
          href={`/dashboard?view=daily-summary&date=${dateStr}`}
          style={{ background: "linear-gradient(160deg,#059669,#047857)", color: "white", border: activeStyle("daily-summary"), borderRadius: 9, padding: "7px 14px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, boxShadow: view === "daily-summary" ? "none" : "0 3px 0 #065f46", whiteSpace: "nowrap", flexShrink: 0, textDecoration: "none", outline: view === "daily-summary" ? "2px solid white" : "none", outlineOffset: 2 }}
        >
          <span>📝</span>סיכום יומי
        </a>

        {/* מצב נוכחי */}
        <a
          href="/dashboard?view=pond-status"
          style={{ background: "linear-gradient(160deg,#2BAEA6,#1D8C85)", color: "white", border: "none", borderRadius: 9, padding: "7px 14px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, boxShadow: view === "pond-status" ? "none" : "0 3px 0 #0D5E59", whiteSpace: "nowrap", flexShrink: 0, textDecoration: "none", outline: view === "pond-status" ? "2px solid white" : "none", outlineOffset: 2 }}
        >
          <span>📊</span>מצב נוכחי
        </a>

        {/* לוח שנה */}
        <a
          href="/calendar"
          style={{ background: "linear-gradient(160deg,#9B59CF,#7C3AB0)", color: "white", border: "none", borderRadius: 9, padding: "7px 14px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, boxShadow: "0 3px 0 #4E2270", whiteSpace: "nowrap", flexShrink: 0, textDecoration: "none" }}
        >
          <span>📅</span>לוח שנה
        </a>
      </div>

      {/* Content pane */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        {view === "home" && (
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
            {/* הודעות הנהלה */}
            <div style={{ background: "white", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden" }}>
              <div style={{ background: "#1a3a5c", color: "white", padding: "10px 14px", fontSize: 13, fontWeight: 700 }}>📢 הודעות הנהלה</div>
              <div style={{ padding: "20px 14px", fontSize: 13, color: "#9ca3af", textAlign: "center", fontStyle: "italic" }}>אין הודעות הנהלה חדשות</div>
            </div>
            {/* התראות + בריכות אדומות */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ background: "white", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                <div style={{ background: "#1B3A2B", color: "white", padding: "10px 14px", fontSize: 13, fontWeight: 700 }}>🔔 התראות</div>
                <div style={{ padding: "20px 14px", fontSize: 13, color: "#9ca3af", textAlign: "center" }}>אין התראות חדשות</div>
              </div>
              <div style={{ background: "white", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                <div style={{ background: "#8B2820", color: "white", padding: "10px 14px", fontSize: 13, fontWeight: 700 }}>🔴 בריכות אדומות</div>
                <div style={{ padding: "20px 14px", fontSize: 13, color: "#9ca3af", textAlign: "center" }}>אין התראות פעילות כרגע</div>
              </div>
            </div>
          </div>
        )}

        {view === "daily-summary" && (
          <Suspense fallback={<div style={{ padding: 32, color: "#6b7280", textAlign: "center" }}>טוען סיכום יומי...</div>}>
            <DailySummaryContent
              dateStr={dateStr}
              basePath="/dashboard?view=daily-summary"
              tab={searchParams.tab}
            />
          </Suspense>
        )}

        {view === "pond-status" && (
          <Suspense fallback={<div style={{ padding: 32, color: "#6b7280", textAlign: "center" }}>טוען מצב בריכות...</div>}>
            <PondStatusClient />
          </Suspense>
        )}

      </div>
    </div>
  );
}
