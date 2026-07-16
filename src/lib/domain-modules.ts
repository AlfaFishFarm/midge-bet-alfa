// Canonical list of the 7 top-level domains (spec v3 p.3 + prototype
// fish-farm-manager-v11 domain screen / nav drawer). Single source of truth
// shared by the home screen (src/app/page.tsx) and the AppShell nav drawer
// (src/components/AppShell.tsx) so the two never drift apart.
//
// 2026-07-01: Added "נתוני בסיס" (8th item) which appears in the prototype
// drawer (fish-farm-manager-v11 #drawer) but was missing from the live app.
// drawerOnly=true means it appears in the nav drawer but NOT in the home
// screen grid (the home screen shows only the 7 domain pills per prototype).
//
// 2026-07-02: Added subLabel (Thai text per prototype home screen buttons),
// drawerSub (Thai or Hebrew per prototype drawer), btnGradient, btnShadow,
// btnShadowActive so the home screen can match the prototype exactly.
// Fixed "סיכום נתונים" dotColor to rgba(240,152,58,0.18) (orange, per prototype).
export interface DomainModule {
  name: string;
  subLabel: string;   // Thai sub-label shown on home screen button
  drawerSub: string;  // Sub-label shown in nav drawer (Thai or Hebrew per prototype)
  description: string; // Kept for back-compat
  href: string;
  icon: string;
  colorClass: string;
  dotColor: string;   // rgba background used behind the icon in the nav drawer
  drawerIconStroke: string;
  // Home screen button gradient + shadows (135deg, 3D style per prototype)
  btnGradient: string;
  btnShadow: string;
  btnShadowActive: string;
  comingSoon?: boolean;
  drawerOnly?: boolean;
}

export const DOMAIN_MODULES: DomainModule[] = [
  {
    name: "\u05EA\u05E4\u05E2\u05D5\u05DC",
    subLabel: "\u0E01\u0E32\u0E23\u0E1B\u0E0F\u0E34\u0E1A\u0E31\u0E15\u0E34\u0E07\u0E32\u0E19",
    drawerSub: "\u0E01\u0E32\u0E23\u0E1B\u0E0F\u0E34\u0E1A\u0E31\u0E15\u0E34\u0E07\u0E32\u0E19",
    description: "\u05DE\u05D7\u05D6\u05D5\u05E8\u05D9 \u05D2\u05D9\u05D3\u05D5\u05DC, \u05D4\u05E2\u05D1\u05E8\u05D5\u05EA \u05D3\u05D2\u05D9\u05DD, \u05E9\u05E7\u05D9\u05DC\u05D5\u05EA, \u05D8\u05D9\u05E4\u05D5\u05DC\u05D9\u05DD",
    href: "/ops",
    icon: "\u2699\uFE0F",
    colorClass: "from-emerald-600 to-emerald-700",
    dotColor: "rgba(61,154,106,0.18)",
    drawerIconStroke: "#4ade80",
    btnGradient: "linear-gradient(135deg,#3D9A6A,#2C7A52)",
    btnShadow: "0 5px 0 #1A5435,0 6px 16px rgba(28,84,53,0.3)",
    btnShadowActive: "0 2px 0 #1A5435,0 3px 8px rgba(28,84,53,0.3)",
  },
  {
    name: "\u05D4\u05D6\u05E0\u05D4",
    subLabel: "\u0E01\u0E32\u0E23\u0E43\u0E2B\u0E49\u0E2D\u0E32\u0E2B\u0E32\u0E23",
    drawerSub: "\u0E01\u0E32\u0E23\u0E43\u0E2B\u0E49\u0E2D\u0E32\u0E2B\u0E32\u0E23",
    description: "\u05EA\u05DB\u05E0\u05D9\u05D5\u05EA \u05D4\u05D6\u05E0\u05D4, \u05D9\u05D5\u05DE\u05DF \u05D4\u05D6\u05E0\u05D4 \u05D9\u05D5\u05DE\u05D9",
    href: "/feeding",
    icon: "\uD83C\uDF3E",
    colorClass: "from-orange-500 to-orange-600",
    dotColor: "rgba(240,152,58,0.18)",
    drawerIconStroke: "#fb923c",
    btnGradient: "linear-gradient(135deg,#F0983A,#D97B1A)",
    btnShadow: "0 5px 0 #9E560E,0 6px 16px rgba(158,86,14,0.3)",
    btnShadowActive: "0 2px 0 #9E560E,0 3px 8px rgba(158,86,14,0.3)",
    comingSoon: true,
  },
  {
    name: "\u05D1\u05E8\u05D9\u05D0\u05D5\u05EA",
    subLabel: "\u0E2A\u0E38\u0E02\u0E20\u0E32\u0E1E",
    drawerSub: "\u0E2A\u0E38\u0E02\u0E20\u0E32\u0E1E\u0E2A\u0E31\u0E15\u0E27\u0E4C\u0E19\u0E49\u0E33",
    description: "\u05DE\u05E2\u05E7\u05D1 \u05D1\u05E8\u05D9\u05D0\u05D5\u05EA, \u05D8\u05D9\u05E4\u05D5\u05DC\u05D9\u05DD, \u05E0\u05D9\u05D8\u05D5\u05E8",
    href: "/health",
    icon: "\uD83E\uDE7A",
    colorClass: "from-red-600 to-red-700",
    dotColor: "rgba(232,84,74,0.18)",
    drawerIconStroke: "#f87171",
    btnGradient: "linear-gradient(135deg,#E8544A,#C93B31)",
    btnShadow: "0 5px 0 #8B2820,0 6px 16px rgba(139,40,32,0.3)",
    btnShadowActive: "0 2px 0 #8B2820,0 3px 8px rgba(139,40,32,0.3)",
    comingSoon: true,
  },
  {
    name: "\u05EA\u05D7\u05D6\u05D5\u05E7\u05D4",
    subLabel: "\u0E01\u0E32\u0E23\u0E1A\u0E33\u0E23\u0E38\u0E07\u0E23\u0E31\u0E01\u0E29\u0E32",
    drawerSub: "\u0E01\u0E32\u0E23\u0E1A\u0E33\u0E23\u0E38\u0E07\u0E23\u0E31\u0E01\u0E29\u0E32",
    description: "\u05EA\u05D7\u05D6\u05D5\u05E7\u05EA \u05E6\u05D9\u05D5\u05D3 \u05D5\u05EA\u05E9\u05EA\u05D9\u05D5\u05EA",
    href: "/maintenance",
    icon: "\uD83D\uDD27",
    colorClass: "from-amber-500 to-amber-600",
    dotColor: "rgba(245,184,32,0.18)",
    drawerIconStroke: "#fbbf24",
    btnGradient: "linear-gradient(135deg,#F5B820,#D99A08)",
    btnShadow: "0 5px 0 #9A6B04,0 6px 16px rgba(154,107,4,0.3)",
    btnShadowActive: "0 2px 0 #9A6B04,0 3px 8px rgba(154,107,4,0.3)",
    comingSoon: true,
  },
  {
    name: "\u05D0\u05D3\u05DE\u05D9\u05E0\u05D9\u05E1\u05D8\u05E8\u05E6\u05D9\u05D4",
    subLabel: "\u0E01\u0E32\u0E23\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23",
    drawerSub: "\u0E01\u0E32\u0E23\u0E1A\u0E31\u0E0D\u0E0A\u0E35",
    description: "\u05E0\u05D9\u05D4\u05D5\u05DC \u05DE\u05E9\u05EA\u05DE\u05E9\u05D9\u05DD \u05D5\u05D4\u05E8\u05E9\u05D0\u05D5\u05EA",
    href: "/admin/users",
    icon: "\uD83D\uDCBC",
    colorClass: "from-purple-600 to-purple-700",
    dotColor: "rgba(155,89,207,0.18)",
    drawerIconStroke: "#c084fc",
    btnGradient: "linear-gradient(135deg,#9B59CF,#7C3AB0)",
    btnShadow: "0 5px 0 #4E2270,0 6px 16px rgba(78,34,112,0.3)",
    btnShadowActive: "0 2px 0 #4E2270,0 3px 8px rgba(78,34,112,0.3)",
  },
  {
    name: "\u05D3\u05E9\u05D1\u05D5\u05E8\u05D3",
    subLabel: "\u0E41\u0E14\u0E0A\u0E1A\u0E2D\u0E23\u0E4C\u0E14",
    drawerSub: "\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19",
    description: "\u05DE\u05E6\u05D1 \u05E0\u05D5\u05DB\u05D7\u05D9, \u05D1\u05E8\u05D9\u05DB\u05D5\u05EA \u05D0\u05D3\u05D5\u05DE\u05D5\u05EA, \u05D4\u05D5\u05D3\u05E2\u05D5\u05EA",
    href: "/dashboard",
    icon: "\uD83D\uDCCA",
    colorClass: "from-blue-600 to-blue-700",
    dotColor: "rgba(58,143,212,0.18)",
    drawerIconStroke: "#60a5fa",
    btnGradient: "linear-gradient(135deg,#3A8FD4,#2271B2)",
    btnShadow: "0 5px 0 #144D80,0 6px 16px rgba(20,77,128,0.3)",
    btnShadowActive: "0 2px 0 #144D80,0 3px 8px rgba(20,77,128,0.3)",
  },
  {
    name: "\u05E1\u05D9\u05DB\u05D5\u05DD \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD",
    subLabel: "\u0E2A\u0E23\u0E38\u0E1B\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25",
    drawerSub: "\u05D3\u05D5\u05D7\u05D5\u05EA \u05DE\u05E4\u05D5\u05E8\u05D8\u05D9\u05DD",
    description: "\u05E1\u05D9\u05DB\u05D5\u05DD \u05D9\u05D5\u05DE\u05D9 \u05D5\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05DE\u05E6\u05D8\u05D1\u05E8\u05D9\u05DD",
    href: "/reports/daily-summary",
    icon: "\uD83D\uDCC8",
    colorClass: "from-teal-700 to-teal-800",
    dotColor: "rgba(240,152,58,0.18)",
    drawerIconStroke: "#fb923c",
    btnGradient: "linear-gradient(135deg,#5C7A6E,#3D5F54)",
    btnShadow: "0 5px 0 #223830,0 6px 16px rgba(34,56,48,0.3)",
    btnShadowActive: "0 2px 0 #223830,0 3px 8px rgba(34,56,48,0.3)",
  },
  {
    name: "\u05E0\u05EA\u05D5\u05E0\u05D9 \u05D1\u05E1\u05D9\u05E1",
    subLabel: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1E\u0E37\u0E49\u0E19\u0E10\u0E32\u0E19",
    drawerSub: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1E\u0E37\u0E49\u0E19\u0E10\u0E32\u0E19",
    description: "\u05D1\u05E8\u05D9\u05DB\u05D5\u05EA, \u05D3\u05D2\u05D9\u05DD, \u05E2\u05D5\u05D1\u05D3\u05D9\u05DD, \u05D4\u05D2\u05D3\u05E8\u05D5\u05EA",
    href: "/base",
    icon: "\uD83D\uDDC4\uFE0F",
    colorClass: "from-slate-600 to-slate-700",
    dotColor: "rgba(92,122,110,0.22)",
    drawerIconStroke: "#94a3b8",
    btnGradient: "linear-gradient(135deg,#5C7A6E,#3D5F54)",
    btnShadow: "0 5px 0 #223830,0 6px 16px rgba(34,56,48,0.3)",
    btnShadowActive: "0 2px 0 #223830,0 3px 8px rgba(34,56,48,0.3)",
    comingSoon: true,
    drawerOnly: true,
  },
];
