// SUPERSEDED 2026-06-27: AppShell was rebuilt to match the spec v3 status-bar
// + slide-out nav-drawer pattern (no more sidebar/bottom-tab-bar). The drawer
// now reads domain entries from src/lib/domain-modules.ts (shared with the
// home screen) instead of NAV_ITEMS below. Nothing currently imports this
// file - kept rather than deleted in case a future flat nav list is needed.
//
// Original note: Central nav definition for the app shell (sidebar on desktop, bottom tabs
// on mobile - see src/components/AppShell.tsx). Add new sections here as
// modules are built; moduleName must match an AppModule.name seeded in
// prisma/seed.ts so the RBAC check in AppShell can hide items the worker has
// no access to.

export interface NavItem {
  label: string;
  href: string;
  moduleName: string | null; // null = always visible (e.g. dashboard)
  icon: string; // simple emoji/glyph placeholder until real icons are added
  showInBottomBar: boolean; // keep the mobile bar to ~4-5 items max
}

// תפעול drill-down (2026-06-21): בריכות / מחזורי גידול / העברות דגים / שקילות /
// לקוחות ומשלוחים used to be 5 separate flat entries here. Per the prototype
// (fish-farm-manager-v11) and Dean's confirmation, תפעול is now ONE entry point
// into a 3-tier card drill-down (/ops -> /ops/management -> individual actions);
// see /ops/page.tsx and /ops/management/page.tsx for where each of those 5 screens
// is now reachable from.
export const NAV_ITEMS: NavItem[] = [
  { label: "דף הבית", href: "/", moduleName: null, icon: "🏠", showInBottomBar: true },
  { label: "תפעול", href: "/ops", moduleName: "תפעול", icon: "⚙️", showInBottomBar: true },
  { label: "ניהול משתמשים", href: "/admin/users", moduleName: "אדמיניסטרציה", icon: "🛠️", showInBottomBar: false },
];
