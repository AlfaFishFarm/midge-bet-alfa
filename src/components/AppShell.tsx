"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ModuleAccess } from "@/lib/permissions";
import { AccessLevel, bestAccessForModule, meetsRequirement } from "@/lib/permissions";
import { DOMAIN_MODULES } from "@/lib/domain-modules";

interface AppShellProps {
  workerName: string;
  permissions: ModuleAccess[];
  children: React.ReactNode;
}

// Rebuilt 2026-06-27 to match prototype #navbar + #drawer exactly.
// 2026-07-04: pixel-exact pass — all rgba values now match prototype CSS literally.
// Navbar: box-shadow 0 2px 8px rgba(0,0,0,0.25); height 54px; bg #1B3A2B; padding 0 16px.
// Hamburger: bg rgba(255,255,255,0.08) border rgba(255,255,255,0.15) hover rgba(255,255,255,0.18).
// Back/home: same bg/border, hover rgba(255,255,255,0.22), marginRight 6px.
// Logout: bg rgba(255,255,255,0.08) border rgba(255,255,255,0.18) hover rgba(255,255,255,0.15).
// Drawer: bg #152D20 width 270px, header bg #1B3A2B, items .drawer-item pattern.

function primaryRoleName(permissions: ModuleAccess[]): string | null {
  if (permissions.length === 0) return null;
  const best = permissions.reduce((a, b) => (a.accessLevel <= b.accessLevel ? a : b));
  return best.roleName;
}

function DrawerIcon({ name, stroke }: { name: string; stroke: string }) {
  switch (name) {
    case "בחירת תחום":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      );
    case "תפעול":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
        </svg>
      );
    case "הזנה":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
          <path d="M12 2a7 7 0 0 1 7 7c0 4-3 7-7 10C9 16 5 13 5 9a7 7 0 0 1 7-7z"/>
        </svg>
      );
    case "בריאות":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
      );
    case "תחזוקה":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
      );
    case "אדמיניסטרציה":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="1" x2="12" y2="23"/>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      );
    case "דשבורד":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
      );
    case "סיכום נתונים":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="3" y1="9" x2="21" y2="9"/>
          <line x1="9" y1="9" x2="9" y2="21"/>
        </svg>
      );
    case "נתוני בסיס":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"/>
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
        </svg>
      );
    default:
      return <span className="text-base">{name[0]}</span>;
  }
}

// Permanent side-strip domain shortcuts — v15 prototype rep-screen side column.
// תפעול + אדמין + סיכום נתונים are live; others show as "בקרוב".
const SIDE_STRIP_ITEMS: { label: string; emoji: string; href: string; bg: string; shadow: string; disabled?: boolean }[] = [
  { label: "תפעול",  emoji: "⚙️",  href: "/ops",                   bg: "linear-gradient(135deg,#3D9A6A,#2C7A52)", shadow: "0 3px 0 #1A5435" },
  { label: "הזנה",   emoji: "🌾",  href: "/feeding",               bg: "linear-gradient(135deg,#F0983A,#D97B1A)", shadow: "0 3px 0 #9E560E", disabled: true },
  { label: "בריאות", emoji: "🩺",  href: "/health",                bg: "linear-gradient(135deg,#E8544A,#C93B31)", shadow: "0 3px 0 #8B2820", disabled: true },
  { label: "תחזוקה", emoji: "🔧",  href: "/maintenance",           bg: "linear-gradient(135deg,#F5B820,#D99A08)", shadow: "0 3px 0 #9A6B04", disabled: true },
  { label: "אדמין",  emoji: "💼",  href: "/admin/users",           bg: "linear-gradient(135deg,#9B59CF,#7C3AB0)", shadow: "0 3px 0 #4E2270" },
  { label: "נתונים", emoji: "📈",  href: "/reports/daily-summary", bg: "linear-gradient(135deg,#5C7A6E,#3D5F54)", shadow: "0 3px 0 #223830" },
];

export default function AppShell({ workerName, permissions, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/";
  const roleName = primaryRoleName(permissions);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  const navBtnBase: React.CSSProperties = {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "7px",
    width: "38px",
    height: "38px",
    cursor: "pointer",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "background .15s",
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header
        dir="rtl"
        style={{
          background: "#1B3A2B",
          color: "white",
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "54px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 300,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="תפריט"
            style={{ ...navBtnBase, flexDirection: "column", gap: "4px" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.18)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)")}
          >
            <span style={{ display: "block", width: "18px", height: "2px", background: "white", borderRadius: "2px" }} />
            <span style={{ display: "block", width: "18px", height: "2px", background: "white", borderRadius: "2px" }} />
            <span style={{ display: "block", width: "18px", height: "2px", background: "white", borderRadius: "2px" }} />
          </button>

          {!isHome && (
            <button
              onClick={() => router.back()}
              aria-label="חזרה"
              title="חזרה"
              style={{ ...navBtnBase, marginRight: "6px" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.22)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          {!isHome && (
            <Link
              href="/"
              aria-label="חזרה לבחירת תחום"
              title="חזרה לבחירת תחום"
              style={{ ...navBtnBase, marginRight: "6px", textDecoration: "none" } as React.CSSProperties}
              onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.22)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.08)")}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
                <polyline points="9 21 9 12 15 12 15 21" />
              </svg>
            </Link>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap" }}>
            <svg width="24" height="19" viewBox="0 0 56 44" fill="none" style={{ flexShrink: 0 }}>
              <path d="M10 22 L1 11 L1 33 Z" fill="#1d6faa" />
              <ellipse cx="32" cy="22" rx="22" ry="13" fill="#3a8fd4" />
              <path d="M24 10 Q31 4 41 9 Q33 11 24 10Z" fill="#1d6faa" />
              <circle cx="46" cy="17" r="4.2" fill="white" />
              <circle cx="47.2" cy="17" r="2.3" fill="#1a2744" />
              <circle cx="31" cy="20" r="2.6" fill="rgba(255,255,255,0.5)" />
              <circle cx="38" cy="27" r="2.1" fill="rgba(255,255,255,0.45)" />
            </svg>
            <span className="hidden sm:inline" style={{ fontSize: "15px", fontWeight: 700 }}>ניהול מדגה בית-אלפא</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontSize: "12px", color: "#93c5fd", lineHeight: 1.4, flexShrink: 0 }}>
          <span className="hidden sm:inline">{now ? now.toLocaleDateString("he-IL") : ""}</span>
          <span style={{ fontSize: "15px", fontWeight: 600, color: "white", letterSpacing: "1px" }}>
            {now ? `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}` : ""}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="hidden sm:block" style={{ textAlign: "left" }}>
            <div style={{ fontSize: "13px", fontWeight: 600 }}>{workerName}</div>
            {roleName && <div style={{ fontSize: "11px", color: "#93c5fd" }}>{roleName}</div>}
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.18)",
              color: "white",
              borderRadius: "6px",
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: "12px",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              transition: "background .15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.15)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)")}
          >
            יציאה
          </button>
        </div>
      </header>

      {drawerOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.55)" }}
          onClick={closeDrawer}
          aria-hidden
        />
      )}

      <aside
        dir="rtl"
        style={{
          position: "fixed",
          top: 0,
          right: drawerOpen ? 0 : "-290px",
          width: "270px",
          height: "100vh",
          background: "#152D20",
          zIndex: 500,
          transition: "right .28s cubic-bezier(.4,0,.2,1)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-6px 0 32px rgba(0,0,0,0.45)",
          overflowY: "auto",
        }}
      >
        <div style={{
          background: "#1B3A2B",
          padding: "0 16px",
          height: "54px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: "15px", fontWeight: 700, color: "white" }}>תפריט ניווט</span>
          <button
            onClick={closeDrawer}
            aria-label="סגור"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "6px",
              width: "32px",
              height: "32px",
              cursor: "pointer",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              transition: "background .15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.2)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)")}
          >
            &#x2715;
          </button>
        </div>

        <nav style={{ padding: "14px 10px", flex: 1 }}>
          <div style={{ fontSize: "10px", fontWeight: 700, color: "#4b6180", letterSpacing: "1.2px", textTransform: "uppercase", padding: "4px 10px 8px", marginTop: "6px" }}>
            ניווט ראשי
          </div>

          <Link
            href="/"
            onClick={closeDrawer}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "11px 14px",
              borderRadius: "9px",
              cursor: "pointer",
              color: isHome ? "#93c5fd" : "#c8d8ec",
              fontSize: "14px",
              fontWeight: 500,
              marginBottom: "3px",
              background: isHome ? "rgba(59,130,246,0.18)" : "transparent",
              textDecoration: "none",
              transition: "all .15s",
            }}
          >
            <span style={{ width: "32px", height: "32px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(59,130,246,0.15)" }}>
              <DrawerIcon name="בחירת תחום" stroke="#60a5fa" />
            </span>
            <span style={{ flex: 1 }}>
              <div style={{ fontSize: "14px", fontWeight: 600 }}>בחירת תחום</div>
              <div style={{ marginTop: "1px", fontSize: "11px", color: "#6b8aaa" }}>מסך הבית</div>
            </span>
          </Link>

          <div style={{ fontSize: "10px", fontWeight: 700, color: "#4b6180", letterSpacing: "1.2px", textTransform: "uppercase", padding: "4px 10px 8px", marginTop: "6px" }}>
            תחומים
          </div>

          {DOMAIN_MODULES.map((m) => {
            const level = bestAccessForModule(permissions, m.name);
            const hasAccess = meetsRequirement(level, AccessLevel.VIEW_ONLY);
            const disabled = m.comingSoon || !hasAccess;
            const active = pathname.startsWith(m.href) && m.href !== "/";

            const inner = (
              <>
                <span style={{ width: "32px", height: "32px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: m.dotColor }}>
                  <DrawerIcon name={m.name} stroke={m.drawerIconStroke} />
                </span>
                <span style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: 600 }}>
                    {m.name}
                    {m.comingSoon && (
                      <span style={{ borderRadius: "9999px", background: "rgba(255,255,255,0.1)", padding: "1px 6px", fontSize: "9px", fontWeight: "normal", color: "#6b8aaa" }}>
                        בפיתוח
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: "1px", fontSize: "11px", color: "#6b8aaa" }}>{m.drawerSub}</div>
                </span>
              </>
            );

            if (disabled) {
              return (
                <div
                  key={m.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "11px 14px",
                    borderRadius: "9px",
                    cursor: "not-allowed",
                    color: "#5b6f85",
                    opacity: 0.6,
                    marginBottom: "3px",
                    fontSize: "14px",
                    fontWeight: 500,
                  }}
                >
                  {inner}
                </div>
              );
            }

            return (
              <Link
                key={m.name}
                href={m.href}
                onClick={closeDrawer}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "11px 14px",
                  borderRadius: "9px",
                  cursor: "pointer",
                  color: active ? "#93c5fd" : "#c8d8ec",
                  fontSize: "14px",
                  fontWeight: 500,
                  marginBottom: "3px",
                  background: active ? "rgba(59,130,246,0.18)" : "transparent",
                  textDecoration: "none",
                  transition: "all .15s",
                }}
              >
                {inner}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: "11px", color: "#3d5573", textAlign: "center" }}>
          Fish Farm Manager v3.0
        </div>
      </aside>

      {/* ── Content row: permanent side strip + page content ─────────────────── */}
      <div style={{ flex: 1, display: "flex" }}>

        {/* Permanent domain side strip — v15 prototype style, 70 px wide, sticky */}
        <div
          dir="rtl"
          style={{
            width: 70,
            flexShrink: 0,
            background: "#152D20",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            gap: 7,
            padding: "12px 6px",
            position: "sticky",
            top: 54,
            alignSelf: "flex-start",
            height: "calc(100vh - 54px)",
            overflowY: "auto",
            zIndex: 200,
          }}
        >
          {SIDE_STRIP_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const btnStyle: React.CSSProperties = {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              background: item.bg,
              border: "none",
              borderRadius: 10,
              padding: "9px 3px 7px",
              cursor: item.disabled ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: item.disabled ? 0.42 : active ? 1 : 0.85,
              boxShadow: active ? `0 0 0 2px rgba(255,255,255,0.55), ${item.shadow}` : item.shadow,
              textDecoration: "none",
              transition: "opacity .15s, box-shadow .15s",
            };
            if (item.disabled) {
              return (
                <div key={item.label} title={`${item.label} — בקרוב`} style={btnStyle}>
                  <span style={{ fontSize: 19 }}>{item.emoji}</span>
                  <span style={{ fontSize: 9, fontWeight: 800, color: "white", lineHeight: 1.1 }}>{item.label}</span>
                </div>
              );
            }
            return (
              <Link
                key={item.label}
                href={item.href}
                title={item.label}
                style={btnStyle as React.CSSProperties}
              >
                <span style={{ fontSize: 19 }}>{item.emoji}</span>
                <span style={{ fontSize: 9, fontWeight: 800, color: "white", lineHeight: 1.1 }}>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Page content */}
        <main style={{ flex: 1, minWidth: 0 }}>{children}</main>

      </div>
    </div>
  );
}
