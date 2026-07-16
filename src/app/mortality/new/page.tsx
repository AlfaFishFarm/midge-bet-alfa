import { redirect } from "next/navigation";

// תמותה merged back into the unified /transfers/new screen (2026-06-21) per the
// fish-farm-manager-v11 prototype — see CLAUDE.md "New authoritative UI/UX reference".
// This route is kept only as a redirect in case of old bookmarks/links.
export default function MortalityNewRedirect() {
  redirect("/transfers/new");
}
