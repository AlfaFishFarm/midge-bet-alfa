import PlaceholderModulePage from "@/components/PlaceholderModulePage";

// This placeholder is specifically about producing the delivery certificate
// itself (הזמנות + הפקת תעודת משלוח) - paused 2026-06-24 pending Dean's answers
// to open-questions items 6, 7, 14-17. Client/Contact/Carrier master-data
// management was built separately at /ops/management/clients (see ניהול לקוחות
// tile on /ops/management) and does not depend on these open questions.
export default function ClientsPage() {
  return (
    <PlaceholderModulePage
      title="הזמנות ותעודות משלוח"
      moduleName="תפעול"
      description="הזמנות והפקת תעודת משלוח - בהמתנה לתשובות על נקודות פתוחות באפיון (ראו מסמך השאלות הפתוחות). ניהול לקוחות, אנשי קשר ומובילים זמין כעת ב'ניהול תפעול ‹ ניהול לקוחות'."
    />
  );
}
