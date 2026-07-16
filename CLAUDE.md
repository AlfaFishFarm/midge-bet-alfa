# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status / open handoffs — read this first, keep it current

Dean works with two separate Claude agents on this repo: Claude in **Cowork**
(no terminal, reads/writes files + runs spec-fidelity audits against the PDF)
and **Claude Code in VS Code** (runs the actual build/migrate/test commands).
Neither agent sees the other's conversation — the only shared state is what's
written to disk in this repo. To avoid "I thought this was already done"
confusion (this has happened more than once), **both agents must**:

1. Read this section before starting work, to see what's outstanding.
2. After finishing a `CLAUDE_CODE_PROMPT_*.txt` handoff, move it into
   `done/` (create the folder if needed) and update the table below —
   don't just leave it sitting in the repo root where its mtime is the only
   signal of whether it ran.
3. Never infer "already done" from file timestamps alone — confirm by
   reading the actual current code.

## Update — 2026-06-29 (Cowork) — WeighingModal: 3 fixes vs prototype/spec Part B (confirm overlay, per-basket time, basket count)

Dean flagged: "עדיין המסך שקילות לא נראה כמו שצריך! תסתכל בHTML ובאיפיון בשלב ב של ההעברות"
("the weighing screen still doesn't look right — look at the HTML and spec in transfers
Part B"). Re-compared `src/app/transfers/[id]/WeighingModal.tsx` against the prototype's
`weighing-form-screen`/`weigh-confirm-overlay` (fish-farm-manager-v11-PROTOTYPE.html) and
spec pages 43-47. Found and fixed 3 concrete gaps (tasks #176-178):

1. **Two-step confirm before save.** Clicking the main save button no longer calls
   `commitWeighing()` directly — it now sets `showConfirm = true`, which renders a
   read-only recap overlay (meta grid + basket table + totals) matching the prototype's
   `weigh-confirm-overlay`/`wfSubmitCore`. Only the recap's own "שמור שקילה" button calls
   `commitWeighing()`; its "ביטול" just closes the recap (nothing was sent to the server
   yet either way, so no data loss).
2. **Per-basket "שעה" column.** Added `time: string` to the `Basket` interface and a
   `setInterval(…, 10000)` effect that re-stamps every *staged* (not-yet-saved) basket's
   time every 10s, mirroring the prototype's `tfLiveClockTick`. Time freezes automatically
   once a basket is actually saved (its id stops matching the `tmp-` prefix that drives the
   tick). Baskets loaded from a prior session show "—" since there's nothing live to show.
   **Judgment call, flagged to Dean:** this is UI-only, never sent to the server — there is
   no time column on `FishWeighingBasketDetail` in `schema.prisma`, and the spec text on
   page 43 itself raises this exact question ("is it really necessary to save each basket's
   weighing time?"). Per the standing no-new-fields-without-sign-off rule, no schema change
   was made; if Dean wants it persisted, that needs an explicit field addition.
3. **Basket count in the summary footer.** Both the live table and the confirm recap's
   footer now show `סלים: N` as their first cell, matching the prototype's 4-cell
   `wf-summary-row` (baskets / total kg / total fish / avg).

**Build verified clean** (`tsc --noEmit` + `eslint`, no errors) after hitting the sandbox
bash-mount desync quirk again on this file (433 vs true 595 lines) — resolved via the
established Write-to-outputs-then-`cp` fix, confirmed with `wc -l` + `tail -c 30 | xxd`.
See `[Sandbox file sync quirk]` memory.

## Update — 2026-06-29 (Cowork) — WeighingModal: 5 more fixes after Dean said "תסתכל טוב בבקשה" (look properly)

Dean, after the 3-fix round above: "למה אני צריך להגיד את זה 40 פעם? תסתכל טוב בבקשה" ("why
do I have to say this 40 times? look properly") — a clear signal the prior pass, while real,
wasn't thorough enough. Did a fresh, literal, field-by-field re-comparison of
`WeighingModal.tsx` against the prototype's `#weighing-form-screen`/`#weigh-confirm-overlay`
markup and a fresh `pdftotext -f 42 -l 47 -layout` extraction of the spec PDF (not relying on
the earlier extraction). Found and fixed 5 more concrete gaps (tasks #187-188):

1. **Missing transfer-context banner.** Added a blue info banner at the top of the form
   ("שקילה מתוך העברה — טנק: … | דג: …. נתוני הבריכה והדג נעולים אוטומטית."), matching the
   prototype's `#wf-transfer-banner`. Since this modal only ever opens from a transfer, the
   banner is unconditional here (the prototype shows/hides it via JS for other entry paths
   that don't apply to our single entry point).
2. **Missing "א. נתוני בריכה" section header** wrapping Part A (pond/tank/date/time),
   literal text + green header-bar style from the prototype's `.weighing-part-hdr`.
3. **Missing "ב. חישובי סלים" section header** wrapping Part B (basket table + add-basket
   form), same pattern, second `.weighing-part-hdr` in the prototype.
4. **Button labels were backwards.** Spec page 43, read fresh, ties the literal label
   "כפתור שמור שקילה לאישור ושמירה וכפתור ביטול" directly to the confirm/summary screen
   ("מסך אישור ביצוע שקילות") — it appears right after that screen's full field list (type,
   source pond, cycle code, fish, tank, basket measurements, summary row) and before the
   constraints section. The previous round had this assigned to the *initial* trigger button
   instead. Fixed: main trigger button now reads "שמור שקילה" (matches the prototype's
   `#wf-save-btn` literal text), confirm-overlay save button now reads
   "שמור שקילה לאישור ושמירה" (matches the spec's literal text for that screen specifically).
5. **Dialog titles were backwards** for the same reason: main modal header simplified to
   "⚖️ שקילת סלים" (generic), confirm-overlay header changed to "⚖️ אישור ביצוע שקילות"
   (the spec's literal name for that screen).

**Flagged to Dean, not reverted:** the prototype's actual confirm-overlay markup uses simpler
text than the spec for #4/#5 — its save button and header both just say "שמור שקילה" /
"⚖️ סיכום שקילה", not the more detailed wording the v3 spec spells out. This is a genuine
spec-vs-prototype conflict on this specific wording, not a missed item. Kept the spec-literal
version per this project's standing rule ("implement spec UI details literally, even if
something close-enough already exists") since the spec's callout is explicit, detailed, and
specific to the v3 revision — the prototype's plainer label reads like reused boilerplate from
the initial-submit button that was never updated to match. If Dean prefers the prototype's
simpler wording instead, that's a one-line revert (`WeighingModal.tsx` confirm-overlay title +
save-button text only).

Average weight in kg (not grams) was double-checked against the prototype/spec during this
pass and confirmed correct as-is — that's a separate, already-approved override (see
`[Avg weight shown in kg]` memory), not a discrepancy.

**Build verified clean** (`tsc --noEmit` + `eslint`, no errors). Hit the sandbox bash-mount
desync quirk again on this exact file (mount stuck at 577 lines against the true 621/622);
resolved via the bash-heredoc-then-`cp` variant of the established fix (Write tool's own
target path was also stale, so the heredoc went straight into `/tmp` and was `cp`'d over),
confirmed with `wc -l` + `tail -c 30 | xxd` before re-running the build. See
`[Sandbox file sync quirk]` memory.

## Update — 2026-06-29 (Cowork) — Deferred-delete extended to קניה/דילול/פירוק/שיווק; status-enum question closed

Dean's instruction after a prior DBML-vs-schema discrepancy was flagged as an open question:
"How do you miss things like this? Do what's in the spec! Check very carefully what is
meant across all the different documents, and execute." Standing rule going forward:
exhaust the spec text + prototype + this file + open-questions doc before raising
something as a question; only escalate genuinely irreducible ambiguity.

**Status-enum question — closed, no action needed.** The legacy `Managements tables.dbml`
shows a 3-value `DRAFT/COMPLETE/DELETE` status enum for the transfer tables. The spec
PDF's own prose only ever describes 2 values for `FishTransferHeader`/`FishTransferDetail`
status, matching current `schema.prisma` exactly. The DBML's 3rd value is stale/contextual
— no schema change needed.

**Deferred-delete pattern extended from תמותה to the other 4 transfer types.** Spec text
for קניה (p.36-37), דילול/פירוק (p.37-38, shared spec) and שיווק (p.38, "כל המפרט זהה לזה
של דילול ופירוק") all independently state row deletion only takes effect at save time
("מחיקת שורות... יתבצע רק בעת שמירת ההעברה (או שמירת טיוטא)"). The prototype's
`tfDelRow(idx)` confirms this is a pure in-memory `tfRows.splice(idx,1)` + re-render, no
network call per click — re-verified directly in `fish-farm-manager-v11-PROTOTYPE.html`
line 7144 during this pass.

Implemented by reusing the batch-save endpoint already built for תמותה
(`/api/transfers/[id]/details/batch`):
- That route's type-restriction check now only blocks non-תמותה callers from sending
  `creates`/`updates` (still תמותה-only); a deleteIds-only batch is accepted for any type.
- `TransferDetailManager.tsx`: clicking מחק on a non-mortality row no longer fires an
  immediate DELETE. It adds the row's id to a `stagedDeleteIds` Set; `draftRows`/
  `closedRows`/the summary totals are now derived from `liveDetails = details.filter(d =>
  !stagedDeleteIds.has(d.id))`, so the row disappears and the summary recalculates
  immediately, matching the spec's "חישוב מחדש של שורת הסיכום" language. The actual
  prisma delete happens in `flushStagedDeletes()`, called from both `handleSaveDraft`
  (new — "שמור כטיוטה" now flushes deletes then navigates away) and `handleFinalize`
  (now flushes deletes before the existing "no open rows" check and status-to-הסתיימה
  PATCH). Wrapped in the same `$transaction` as before, so a failed flush rolls back
  cleanly and the user sees an alert with nothing partially deleted.

**Judgment call, not yet explicitly confirmed with Dean — flag if wrong:** row ADD
(`addDetail`) and the close/reopen actions (`closeRow`/`reopenRow`) stayed immediate
(unchanged) for these 4 types. Reasoning: (1) the spec text for these 4 types only
describes deferred *deletion*, not deferred creation — contrast with תמותה's spec text,
which explicitly defers both; (2) דילול/פירוק/שיווק's WeighingModal attaches a weighing to
an already-persisted `transferDetailId` — deferring row creation would break that flow
until a save happened first.

**Build verified clean** (`tsc --noEmit` + `eslint` on both touched files, no errors)
after re-hitting and re-fixing the same sandbox bash-mount desync quirk on
`TransferDetailManager.tsx` (see `[Sandbox file sync quirk]` below) — this is now the
3rd occurrence on this exact file across sessions; the file is ~1730 lines, consistent
with the "large files seem to be a factor" note from the prior occurrence.

## Update — 2026-06-29 (Cowork) — Transfers: 5 fixes from Dean, `tsc --noEmit` + `eslint` clean

Dean gave 5 concrete fixes for the Transfers feature (his exact list, Hebrew, paraphrased):
1. Every pond-search field, on every screen, must show open/closed status + pond code +
   pond name — not just name.
2. דילול destination-pond list must show concrete (physical) ponds only, never virtual ones.
3. Navigating into Part B must show that transfer's Part A summary (type, source pond,
   date, cycle) so the context travels with the section.
4. Stop showing `priorityCycleCode` anywhere in Transfers — show only the computed app
   cycle code. If the chosen pond has no open growth cycle, block the action with an alert.
5. In the Part B add-row form, move אמצעי העברה up to right after fish-type + dest-pond,
   ahead of the weight/time/population fields.

**All 5 implemented** in `TransferDetailManager.tsx`, `NewTransferForm.tsx`,
`transfers/new/page.tsx`, `transfers/page.tsx`, `transfers/[id]/page.tsx`. Added a new
`PondWithCycle` shape (`{ id, code, name, pondTypeName, hasActiveCycle, activeCycleCode }`)
returned by a single `prisma.pond.findMany` per page (with `pondType` + an open-`growthCycles`
include) — every pond-picker on these screens now derives its filtering/labeling from this
one list instead of separate hand-filtered queries. `PondCombobox`'s existing `labelExtra`
prop renders the open/closed state; no changes needed to the combobox itself.

**Side-effect fix, not separately requested — flagging so it isn't mistaken for scope
creep:** item 2's type-aware dest-pond filtering (דילול/פירוק/קניה → concrete ponds only;
שיווק → the `מחסן שיווק` warehouse pond, no active-cycle requirement) incidentally fixes a
pre-existing gap (was task #167-adjacent): the seeded `Main` warehouse pond has no
`GrowthCycle`, so it would have failed item 4's "block if no open cycle" check. שיווק is
exempted from that check by design (warehouses don't carry growth cycles), so `Main` now
works as a שיווק destination without needing a seeded cycle.

**Bug caught and fixed during this same pass (not one of Dean's 5, found while fixing
#4):** `transfers/page.tsx`'s list-view query had already been changed to select
`cycle: { openedAt: true }` instead of `priorityCycleCode`, but the JSX render still read
`t.cycle.priorityCycleCode` — a leftover that would have been a real compile error. Fixed
to call the same `computeCycleCode` helper used elsewhere.

**Sandbox file-sync quirk encountered and resolved.** During this fix, the bash-mounted
view of `TransferDetailManager.tsx`, `NewTransferForm.tsx`, and the 3 `page.tsx` files was
stale relative to true content (1003 vs 1119 lines on the biggest file) — confirmed via
`stat`/`wc -l` after multiple waits (up to 8s), so not a transient delay. Remediation per
this file's own prior note (see `[Sandbox file sync quirk]` memory) worked: re-read true
content with the Read tool, force-rewrite each file via a bash heredoc, then `wc -l` +
`tsc --noEmit` to confirm. Worth repeating if this happens again on future edits to these
same files (they're large, ~1100/~390 lines, which may be a factor).

## Update — 2026-06-27 (Cowork) — everything since the last entry (2026-06-22)

This section existed precisely so the two agents don't lose each other — it was 5 days
stale before this edit. If you're Claude Code picking this up fresh, start here.

**Spec authority changed:** the spec PDF Cowork was auditing against is now **v3**
("מסמך אפיון מודול תפעול בריכות (2).pdf", 50 pages, supersedes the v2 PDF referenced
above). Don't re-trust page numbers cited in older entries in this file without
checking they still refer to v3.

**Built since 2026-06-22 (Cowork, direct code, all verified `tsc --noEmit` + `eslint` clean):**
- Transfers screen unified into one screen, 3 sections (source+date / in-progress tanks /
  closed tanks); searchable pond combobox (`PondCombobox.tsx`) wired into every pond field;
  weighing moved from a separate screen into a popup over the transfers screen; average
  weight displayed in kg app-wide (storage stays grams — `avgWeightGrams` field unchanged).
- Draft save/import on `/transfers/new`: both spec methods now implemented —
  auto-detect by pond+date (`matchingDraft`) and an explicit "ייבוא טיוטה" button that
  reveals a picker (`NewTransferForm.tsx`, `showDraftPicker` state) — was previously
  always-visible, changed 2026-06-27 per Dean's explicit instruction to match spec literally.
- Client/Contact/Carrier write permission tightened from `AccessLevel.OPERATIONS` to
  `AccessLevel.DOMAIN_MANAGE` across all 8 API route files + the management page's `canEdit`
  check, per spec's "עדכון פרטי מובילים" requirement (viewable by all managers, editable only
  by domain managers + administration). GET routes unchanged at `VIEW_ONLY`.
- Full spec-v3 audit done 2026-06-27 (task #127) confirming a **standing no-new-tables rule**:
  don't add Prisma models without Dean's sign-off (he's defining tables himself going forward).
  The one known open schema question is `fishSwitching` — explicitly deferred by Dean.

**Work-plan doc replaced:** the old `מפת_דרכים.md` (03 - מסמכי עבודה (Cowork)/) is
superseded by `מפת_דרכים_v2.md` in the same folder, written 2026-06-27 against spec v3.
Current build order per that doc: (1) AppShell pt.2 — status bar + nav drawer, (2) daily
summary + current-status reports (pure queries on existing data, no schema risk), (3)
dashboard, (4) calendar journal (spec marks this optional, deprioritized), (5) delivery
certificates (blocked on open questions below), (6) "איתחול טבלאות" / metadata-CRUD
(blocked — spec page 49 in v3 is a title with no content, needs Dean to define scope).

**Open questions for Dean, raised 2026-06-27, not yet answered — don't build around
an assumed answer:**
- `[דשבורד]` The HTML prototype hardcodes "בריכה אדומה" (red/alert pond) thresholds as
  ammonia > 5 or oxygen < 4, with a code comment literally calling them example values.
  Should these be real thresholds, or sourced from `FishGrowthParameters` (already has
  min/max oxygen/temperature per fish-strain) instead of hardcoded constants?
- `[דשבורד]` (found 2026-06-27, building the dashboard shell) There is no schema support
  at all for either main panel: no `Announcement`/`Notification` model for "הודעות
  ועדכונים", and no `WaterTest`/sensor-reading model for "בריכות אדומות" (beyond the
  threshold question above — there's also nowhere to store the readings themselves).
  Both panels were shipped as permanent empty-states rather than re-blocking the build,
  per the same pattern already accepted for daily-summary's 4 empty sections. Add
  Announcement/WaterTest models only with Dean's sign-off (no-new-tables rule).
- `[סיכום יומי]` The HTML prototype's daily-summary screen fires a
  `showToast('✅ סיכום יומי נשמר ונשלח בווטסאפ')` on save — implying an auto-send-to-WhatsApp
  feature that appears nowhere in the spec text. Real feature or prototype flavor-text?

**סיכום יומי (daily summary) — DONE 2026-06-27 (Cowork, direct code, `tsc --noEmit` +
`eslint` clean).** `/reports/daily-summary` built: date-nav header + 3 sections backed by
real data (transfers, weighings, pond opens/closes — aggregate queries on existing
models, no new tables) + 4 permanent empty-state sections (treatments, water tests, fish
tests, anomaly data — no `Treatment`/`WaterTest`/`FishTest`/`AnomalyData` model exists,
flagged as the open `[סכמה]` question in `מפת_דרכים_v2.md`). New RBAC module "סיכום
נתונים" seeded with FULL_EDIT for admin/programmer.

**Bug fixed 2026-06-27 (Cowork, direct code, `tsc --noEmit` + `eslint` clean) — same-day
transfer after opening a pond could fail:** Dean reported wanting to do transfers the same
day he opens a pond. Found in `src/app/api/transfers/route.ts`: the cycle-resolution query
compared `GrowthCycle.openedAt` (a full timestamp, e.g. opened at 14:00) against the
transfer's `transferDate` (date-only, parsed as midnight) with `lte` — so opening a pond at
any time after 00:00 made same-day transfers fail to resolve a cycle ("לא נמצא מחזור גידול
פתוח"). Fixed by comparing `openedAt` against the start of the *next* calendar day
(`lt: nextDay`) instead of the transfer's exact midnight timestamp, so any opening time on
the transfer's own day now counts as already open. No other route had this pattern
(checked transfers/weighings/details routes).

**Future scope flagged by Dean 2026-06-27, not yet specced — don't build yet:** Dean wants
a future feature where opening/closing a transfer's fish count actually decrements/increments
the *source and destination* ponds' live fish stock (his words: "בעתיד יאפיינו את הנושא של
הורדת והוספת דגים לבריכות מהן ואליהן מתבצעות העברות" — fish add/remove on the ponds a
transfer moves from/to, to be specced later). Today a transfer records the moved
fishCount/weight on `FishTransferDetail` but nothing aggregates it into a running
per-pond stock total anywhere (related to the existing `מצב נוכחי` schema gap — see open
`[סכמה]` question above on `Pond`/`GrowthCycle` fields). Wait for Dean to spec this before
adding any stock-tracking logic or fields.

**דשבורד כללי (general dashboard) — DONE 2026-06-27 (Cowork, direct code, `tsc --noEmit`
+ `eslint` clean).** New `src/app/dashboard/page.tsx`: RBAC-gated (module "דשבורד", new
seed entry), two panels ("בריכות אדומות", "הודעות ועדכונים") both rendering permanent
empty-states (see open questions above), and a 4-item nav grid — only "סיכום יומי" is a
live link, the other three (חיישנים, לוח שנה, מצב נוכחי) render disabled with a "בפיתוח"
badge and an explanatory tooltip. `comingSoon` flipped off for "דשבורד" in
`src/lib/domain-modules.ts` so the home-screen pill + nav-drawer item are now clickable.

**שקילות (weighing) audit — 2026-06-27, fresh re-extraction of spec v3 + full code
cross-check.** Dean asked "is everything built exactly per spec." Findings, both bugs
below now FIXED per Dean's 2026-06-27 go-ahead ("תתעדכן את הבאגים לפי האיפיון"):
- Confirmed matching spec: schema (`WeightType`/`FishWeighingHeader`/
  `FishWeighingBasketDetail`), basket-weighing-as-popup-over-transfers (not separate
  screen, per Dean's 2026-06-25 confirmation), read-only tank/pond/fish/cycle context
  sourcing, same-tank-same-day duplicate guard, the spec-named zero-fish/zero-weight bug
  (confirmed fixed both client+server), kg display, RBAC (OPERATIONS), stage-then-confirm
  flow.
- **FIXED (2026-06-27):** `src/app/api/transfers/[id]/details/[detailId]/weigh-context/route.ts`
  previously labeled every basket weighing created from a transfer as "שקילת ניטור-שטח"
  (field) via a hardcoded `.includes("שטח")` match. Now matches `.includes("אפיון טנק")`
  and correctly files transfer-triggered weighings as "שקילת אפיון טנק" (tank
  characterization), since they're tank-linked and transfer-linked. Note: weighings
  created before this fix still have the old (wrong) WeightType saved — no backfill has
  been done or discussed with Dean.
- **RESOLVED, REVERTED BACK (2026-06-27):** the empty/tare basket weight (`emptyWetWeight`)
  question is closed — Dean's explicit call: **"לא צריך את המשקל סל ריק!"** ("don't need the
  empty basket weight"). Earlier the same day the field had briefly been restored as מחובה
  per the spec text (see the OPEN CONFLICT note below, now resolved), then reverted back out
  the same day once Dean picked the prototype (`fish-farm-manager-v11.html`, which has no
  tare-weight field anywhere) as authority over the spec PDF text. Final state: only the
  full (gross) basket weight is collected in both entry points — the transfers-modal popup
  (`WeighingModal.tsx`) and the standalone `/weighings` "שקילה חדשה" flow
  (`WeighingsClient.tsx`'s `NewWeighingModal`) — and
  `src/app/api/weighings/[id]/baskets/route.ts` always stores `emptyWetWeight: 0`
  server-side. Verified `tsc --noEmit` + `eslint` clean on all three files. Note: baskets
  saved during the brief mandatory-tare window earlier that day still have whatever value
  was entered then — no backfill done or discussed.
- **Ambiguous, not gradable as pass/fail:** spec has no literal UI mockup for field/net
  weighing as their own screens (only the basket-weighing modal has one) — `/weighings`
  is the app team's own design filling that gap, not a literal-spec implementation.
  Spec's role name "מנהל צוופה" has no literal string match in code, only the equivalent
  access-level number.

**שקילות standalone-screen follow-up — 2026-06-27 (Dean: "אני מדבר לא רק על המסך שקילות
שנפתח המסך העברות גם על הרובריקה עצמה של השקילות").** Re-read spec v3's weighing chapter
again, this time specifically against the standalone `/weighings` "שקילה חדשה" creation
flow rather than the transfers-modal. Found and **FIXED (2026-06-27):** spec line ~1686
states the tank-characterization basket-weighing window is reachable *only* from transfer
reporting ("חלון זה זמין רק מתוך דיווח העברות שיווק, דילול ופירוק") — never as a standalone
creation flow. The standalone screen's "סוג שקילה" dropdown previously listed all three
`WeightType`s including "שקילת אפיון טנק", with no tank field to attach one to; worse, due
to Hebrew alphabetical sort (`weightType.findMany({ orderBy: { name: "asc" } })` puts
"שקילת אפיון טנק" first because א sorts before נ), it was the *default* selection — every
standalone weighing created without explicitly changing the dropdown would silently save
as a mislabeled tank weighing with no tank. Fixed in two places: client-side,
`WeighingsClient.tsx`'s `NewWeighingModal` now filters the picker to
`creatableWeightTypes = weightTypes.filter((wt) => !wt.name.includes("אפיון"))`; server-side,
`POST /api/weighings` (`src/app/api/weighings/route.ts`) now rejects any request where the
resolved `WeightType` includes "אפיון" but no `tankId` is supplied, closing the gap against
direct API misuse too. `weighings/page.tsx`'s server queries (filtering by `contains: "שטח"`
/ `"רשת"`) were already spec-correct and needed no change — tank-characterization rows
never leaked into either displayed tab regardless of the dropdown bug. Note: any standalone
weighings already created with the wrong type before this fix are not backfilled — not yet
raised with Dean, same open question as the other two pre-fix-data notes above.

**✅ RESOLVED (2026-06-27): spec text vs HTML prototype on tare/empty basket weight.** Per
Dean's instruction to keep auditing against both the spec doc AND `fish-farm-manager-v11.html`,
checked the prototype's weighing-form-screen (used for all three types — field/net/tank, the
tank variant entered only from the transfer form, exactly as already built). The prototype's
basket table has only 3 input columns: שעה, **משקל סל מלא (ק"ג)** (full basket weight —
entered directly, no separate step), מספר דגים בסל; the average is computed straight from
that gross weight. There is no empty/tare-basket-weight field anywhere in the prototype
(`fish-farm-manager-v11.html`, weighing-form-screen + weigh-confirm-overlay) — searched the
whole file for "ריק"/tare-related terms in a weighing context and found none. This directly
contradicted the spec PDF's text (background/data-model section) marking `emptyWetWeight` as
מחובה, which `WeighingModal.tsx`, `WeighingsClient.tsx`, and
`api/weighings/[id]/baskets/route.ts` had briefly been updated to enforce earlier the same
day. Flagged to Dean as a genuine conflict rather than guessed at; **Dean's answer: "לא צריך
את המשקל סל ריק!"** — the prototype wins. All three files reverted back to gross-weight-only,
`emptyWetWeight` always `0` server-side. Verified clean. Tag: `[שקילות]`.

**Security hardening audit — 2026-06-27 (Cowork, Dean: "אבטחה נחזק לפני שנעלה לאוויר וכמובן
גם את הDB").** Re-checked the whole auth/RBAC/secrets/DB-connection picture end to end before
go-live, not just the original 2026-06-19/20 review.

**Confirmed already solid, no change needed:** bcrypt cost-12 password hashing +
constant-time dummy-hash comparison on unknown usernames (`api/auth/login/route.ts`);
JWT session signed with a length-checked secret (`jwt-secret.ts`, min 32 chars); session
cookie is `httpOnly`+`sameSite=lax`+`secure` in production; DB-backed login lockout (5 failed
attempts/15min per username, survives serverless cold starts since it's not in-memory);
every one of the 24 API routes except `auth/login`/`auth/logout` goes through
`withModuleAccess` (verified by grep, not assumed); full audit log on login/login_failed/
login_blocked/logout/create/update/delete; `.env` correctly gitignored, `.env.example` has
only placeholders, no real secrets or PII found in any trackable file (grepped repo-wide);
`workers.local.ts` (real PII) stays out of git per its own `.gitignore` rule; both
`DATABASE_URL`/`DIRECT_URL` templates require `sslmode=require`.

**FIXED (2026-06-27):** `next.config.mjs` had zero HTTP security headers. Added
`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security` (HSTS),
`Permissions-Policy` (camera/mic/geolocation off), and a default-`'self'` CSP. None of these
are added automatically by Vercel. `tsc --noEmit` clean.

**Needs Dean's action (Neon dashboard / deployment-side, not reachable from this sandbox):**
- Neon "Allowed IPs" (paid-plan feature) to restrict DB access to known IPs (e.g. Vercel's)
  instead of open internet — not yet enabled.
- Confirm the real `JWT_SECRET` in production `.env`/Vercel env vars is a freshly generated
  random value (`openssl rand -base64 32`), not the example placeholder.
- Confirm `ADMIN_SEED_PASSWORD` is set to a real value before seeding any non-throwaway DB —
  otherwise the seeded admin account keeps the well-known default `ChangeMe123!`.
- Neon backup/point-in-time-restore retention window — worth checking it matches Dean's
  acceptable data-loss window before go-live.
- No `.git` repo exists yet (still true as of this date) — before the first `git init`+push,
  re-run the existing `CLAUDE_CODE_PROMPT_pre_git_security_review.txt` gate.

**Lower priority / optional:** login lockout is per-username only — an attacker trying many
different usernames from one IP isn't throttled. Could add a per-IP counter on top of the
existing per-username one if Dean wants it; not done, flagged only.

**AppShell pt.2 (status bar + nav drawer) — DONE 2026-06-27 (Cowork, direct code, `tsc
--noEmit` + `eslint` clean).** `src/components/AppShell.tsx` was rebuilt from scratch:
single sticky `#1B3A2B` status bar (hamburger → drawer, back button, home button, inline
SVG fish logo + app name, live date+clock, inert 🌎 placeholder button, user name+role,
logout) and a right-sliding `#152D20` nav drawer (home item + the 7 domain modules, each
RBAC-gated and `comingSoon`-flagged exactly like the home screen). The old desktop
sidebar + mobile bottom-tab-bar is gone entirely - the prototype has no bottom bar at any
breakpoint, so the drawer is now the only nav surface on mobile and desktop alike.
Domain module data (name/href/icon/colors/comingSoon) was extracted out of `page.tsx` into
`src/lib/domain-modules.ts` so the home screen and the drawer share one list instead of
drifting apart; `src/lib/nav-config.ts` is now dead code (left in place, not deleted).
Per-screen breadcrumb rows ("תפעול › העברות" etc, prototype `.tf-back-btn`/`.tf-breadcrumb`)
are explicitly NOT part of this - that's a page-level concern for whichever screen renders
it, out of scope for the global shell. Next up per the roadmap: daily-summary + current-status
reports (roadmap v2 item 2).

**Open handoff prompts (repo root, not yet run or only partially run):**
| File | Status |
|---|---|
| `CLAUDE_CODE_PROMPT_cycle_app_code.txt` | ✅ done — verified 2026-06-21, cycle code computed + rendered on transfer detail page |
| `CLAUDE_CODE_PROMPT_transfer_screens_rebuild.txt` | ✅ mostly done — verified 2026-06-21 (3-part structure, Supplier model, RBAC fix, CloseForm colors all present) |
| `CLAUDE_CODE_PROMPT_weighing_fixes.txt` | ⚠️ not reverified this pass |
| `CLAUDE_CODE_PROMPT_save_confirmation.txt` | ❌ confirmed NOT run, 2026-06-22 — Cowork re-read `CycleForm.tsx` directly: no confirm dialog, no dismissible error banner, exists anywhere. Still sitting in repo root. Tracked as Task #77 (see below). |
| `CLAUDE_CODE_PROMPT_operations_screens.txt` | likely done (screens exist) — not line-by-line reverified |
| `CLAUDE_CODE_PROMPT_pre_git_security_review.txt` / `_github_setup.txt` / `_local_backup.txt` | one-off setup tasks, presumed done |
| `CLAUDE_CODE_PROMPT_full_spec_fidelity.txt` | ✅ Part 1 (Sections A–G) done. The 2 gaps found on Cowork re-verification (Section F same-tank check, Section G tab-routing bug) were **fixed directly in code by Cowork, 2026-06-21** (see below). **Section H started by Cowork 2026-06-21 (entry screen only) — Dean approved 2026-06-21, see below.** **Section K (user registration) done by Cowork 2026-06-22 — see below.** Sections I, H pt.2 still NOT started. |

**Part 1 completed (2026-06-21) — what was done:**
- **Section A**: Weight-entry model inversion — WEIGHABLE types (דילול/פירוק/שיווק) enter totalWeightKg manually; fishCount computed. קניה stays fishCount+avgWeightGrams manual. Schema migrated (`totalWeightKg Float?` on FishTransferDetail).
- **Section B**: Dark summary bar above save buttons showing total weight + tank count.
- **Section C**: Per-type chip colors: קניה=teal, דילול=blue, פירוק=purple, שיווק=orange.
- **Section D**: Default meansType per type; "סגירת טנק" disabled until fields filled; column headers per spec.
- **Section E**: תמותה removed from transfer chips; dedicated `/mortality/new` entry screen created.
- **Section F**: BasketWeighingModal — date locked to transfer date, time editable; `onAvgUpdated` callback syncs avg back to detail row.
- **Section G**: New weighing creation UI (שקילה חדשה button + multi-step modal) in WeighingsClient.

**Gaps found on Cowork re-verification (2026-06-21) — fixed directly in code by Cowork same day:**
- **Section F (basket weighing — tank info missing + same-tank-twice check)**: confirmed against
  the actual spec mockup image (page 20: "חלק א: נתוני בריכה וטנק... מגיעים מפרטי ההעברה" — tank is
  read-only, sourced from the transfer detail's own `TransferMeans`, not a fresh dropdown) and page
  25 ("בדיקה: יש למנוע בחירת אותו טנק פעמיים"). Fixed: `BasketWeighingModal.tsx` now takes
  `tankId`/`tankCode` props (read-only display, sourced in `TransferDetailManager.tsx`'s
  `openWeighModal()` from `detail.transferMeans.internalTankId`), and `POST /api/weighings`
  (`src/app/api/weighings/route.ts`) does an explicit calendar-day-range `findFirst` check
  (not a DB unique constraint — `FishWeighingHeader.date` is a full timestamp, so two sessions on
  the same tank/day at different times wouldn't collide on `@@unique([date,pondId,tankId])` alone)
  before `create()`, returning 409 with a Hebrew error if the tank already has a weighing that day.
- **Section G (WeighingsClient — new-weighing tab bug)**: fixed — `handleCreated` in
  `WeighingsClient.tsx` now branches on `w.weightType.name.includes("רשת")` and appends to a real
  `netWeighings` state (previously the net tab rendered straight from the `initialNetWeighings`
  prop with no setter at all, and `handleCreated` unconditionally appended to `fieldWeighings`).

**Gap found + fixed 2026-06-21 (Cowork, same audit pass) — TransferDetailManager closed rows had no edit button:**
Spec page 23: "לחיצה על כפתור עריכה מסירה את הסימון של הרשומה כ'סגורה זמנית' ומחזיר אותה לחלק השני
לעריכת עדכונים או מחיקה" — closing a tank row must be reversible. `TransferDetailManager.tsx`'s
"חלק ג' — טנקים סגורים" table only rendered the row data, no button at all, so a worker who closed
a tank by mistake had no way to fix it. Fixed: added `reopenRow()` (PATCHes the detail's `status`
back to `"טיוטא"` — the API already allowed this enum value, just wasn't exposed in the UI) and an
"עריכה" button column on closed rows (`forClosed && canEdit && !isFinished`).

**Open, not yet resolved — needs checking against `PopulationCode` seed data:** spec page 17 says
the "שלב באיכלוס" list for קניה should only show purchase-relevant categories (הטלה/אימון/אימון
ראשון/אימון שני/פיטום/מחסן/שמירת חורף/דגים מהים/היפוך מין), while page 18 implies a broader general
list for דילול/פירוק. `TransferDetailManager.tsx` currently passes the *same* unfiltered
`populationCodes` list to every transfer type (שיווק is the only one locked, via `isShiuuk`). Not
fixed yet — needs Dean's read on whether `PopulationCode` rows currently have any
type/category field to filter on (if not, this needs a small schema addition, not just a UI fix).

**Section H (nav/dashboard redesign) — Dean approved 2026-06-21, Cowork started same day:**
Dean sent the actual spec mockup screenshot for the entry screen ("מסך כניסה" — page 3) and said to
build it: "כן כן כל מה שרשום וברור באיפיון לבנות גם המסך כניסה... לא חייב בעיצוב הזזה אבל זה לא היה
קיים." Cowork rebuilt `src/app/page.tsx` as a vertical stack of 7 full-width colored pills — תפעול
(green), הזנה (orange), בריאות (red), תחזוקה (amber — new, not a real module/page yet), אדמיניסטרציה
(purple), דשבורד (blue — links to `/dashboard`, page 28 mockup, not built), סיכום נתונים (teal —
links to `/reports/daily-summary`, page 29 mockup, not built). Only תפעול and אדמיניסטרציה are live
links; the rest are marked "בפיתוח" (disabled) since their target screens don't exist yet. **NOT
done as part of this**: the dark-green top status bar / 2-tier nav redesign in `AppShell.tsx` (pages
1-3) — that's a separate, broader change touching every screen and wasn't explicitly asked for yet.
Don't redo the entry-screen rebuild — if continuing Section H, the next pieces are: the `/dashboard`
screen itself (page 28 — "בריכות אדומות" alert list + "הודעות ועדכונים"), the `/reports/daily-summary`
screen (page 29 — per-transfer/weighing table with a `מס' דגים` column, **this is also the answer to
"where do you see how many fish were stocked" — that data is entered via קניה transfers but today
isn't surfaced anywhere as a running total; the spec only ever shows it in this daily list, not as a
persistent pond-level counter**), and the AppShell top-bar/nav redesign (still needs Dean's go-ahead
on exact scope before starting).

**Section K (user registration admin screen) — built by Cowork 2026-06-22:**
Spec page 28 had no field-level detail (just headings), so per Dean's explicit confirmation
("כן, בדיוק לפי הסכמה") this was built as a full schema-1:1 form rather than a stripped-down MVP.
New: `src/app/admin/users/page.tsx` (list of all workers + status + summarized grants),
`src/app/admin/users/new/page.tsx` + `src/app/admin/users/[id]/page.tsx` (create/edit, both render
the shared `WorkerForm.tsx` client component), `src/app/api/admin/workers/route.ts` (POST create)
and `src/app/api/admin/workers/[id]/route.ts` (PATCH update) — both gated via
`withModuleAccess("אדמיניסטרציה", AccessLevel.EXECUTIVE, ...)`. Worker fields (incl.
latinFirstName/latinLastName/nickname/language for Thai workers), optional User account
(username + password, bcrypt-hashed, can be added later if a worker has none yet), and a dynamic
permissions table (add/remove rows of module × role × accessLevel 1–6, mapped straight onto the
existing `WorkerRole` model — no schema changes needed). Account creation/password reset and the
full grant set are written transactionally with the worker row; P2002 (duplicate username) caught
with a friendly Hebrew error; every create/update writes an audit log. `npx tsc --noEmit` and
`npx eslint` both pass clean on the new files (`next build` itself still fails in the Cowork sandbox
due to a missing SWC binary for this architecture — a known sandbox limitation, not a code issue;
run a real build in Claude Code/VS Code to get a clean pass/fail signal).

Everything else in Sections A–E re-verified directly against the code and matches spec: schema
migration for `totalWeightKg`, server-side rejection of read-only-field PATCHes per transfer type,
summary bar, 5 chip colors, default meansType, disabled-not-error close button, column wording/
order, draft pre-check redirect, dedicated `/mortality/new` screen + `MortalityDetailManager.tsx`,
and the `/weighings` creation modal (pond/date/basket-entry/save-confirmation flow). Could not run
`npm run build`/`npm test` cleanly in the Cowork sandbox (vitest: missing native rollup binary for
this sandbox's architecture; a bare `npx tsc` invocation threw spurious parse errors not
reproducible by reading the flagged lines) — worth running both for real in Claude Code/VS Code to
get a clean pass/fail signal.

## New authoritative UI/UX reference (2026-06-21) — supersedes ambiguous PDF nav

Dean uploaded an interactive HTML prototype (`fish-farm-manager-v11-PROTOTYPE.html`,
saved in the workspace root) that he says shows exactly how screens and transitions
should look — explicitly more authoritative than the original spec PDF where the PDF
was ambiguous. He scoped this round to **תפעול (operations) only**. Full comparison
written to `03 - מסמכי עבודה (Cowork)/השוואת_פרוטוטייפ_תפעול.md`. Key findings:

1. **Nav is a 3-tier drill-down screen stack, not a flat sidebar.** Prototype's
   `showScreen()`/`goToDomain()` push onto a `screenHistory` array; each screen gets
   its own back-button + breadcrumb; a home button only appears once you've left the
   entry screen. Hierarchy for ops: entry → `ops-screen` (4 buttons: ניהול תפעול /
   שקילות / העברות / ביצוע טיפולים) → `ops-mgmt-screen` (5 buttons: פתיחת בריכה /
   סגירת בריכה / הפקת תעודת משלוח / תוכנית שבועית [stub] / תוכנית שנתית [stub]).
   **Decided and implemented (2026-06-21):** confirmed with Dean via clarifying
   questions before building (kept existing routes/pages intact, just added a real
   card-screen drill-down in front of them, matching the home screen's existing
   colored-pill style from Section H — not the prototype's literal inline-CSS/JS,
   since this app already has its own consistent Tailwind pattern for that, established
   and approved). New screens: `src/app/ops/page.tsx` (tier 2, 4 cards — ניהול תפעול →
   `/ops/management`, שקילות → `/weighings`, העברות → `/transfers`, ביצוע טיפולים →
   `/treatments` new stub) and `src/app/ops/management/page.tsx` (tier 3, the
   prototype's 5 cards + a 6th "רשימת בריכות" → `/ponds` added per Dean to fold in the
   old flat בריכות nav item). Of the old flat nav items: מחזורי גידול folds in via the
   "סגירת (חיסול) בריכה" card → `/cycles` (that list already supports both opening
   closed ponds and managing/closing open ones, so it covers both); לקוחות ומשלוחים
   folds in via "הפקת תעודת משלוח" → `/clients` (still the task #71 placeholder, just
   relocated). New temporary stubs (Dean confirmed 2026-06-21, "Stub זמני לכולם"):
   `/treatments`, `/ops/management/open-pool`, `/ops/management/weekly-plan`,
   `/ops/management/yearly-plan` — all use the existing `PlaceholderModulePage` shell
   (same pattern as `/clients`), not the dashboard's disabled/"בפיתוח" pill style,
   since they're real clickable routes, just not-yet-built screens. `nav-config.ts`'s
   5 flat תפעול entries (בריכות/מחזורי גידול/העברות דגים/שקילות/לקוחות ומשלוחים)
   collapsed into one "תפעול" → `/ops` entry; the home screen's תפעול pill
   (`src/app/page.tsx`) now points at `/ops` too (was `/transfers`). This is a subset
   of task #68's full scope — the broader 2-tier status-bar/nav-drawer redesign across
   *all* domains (not just תפעול) is still pending. Verified with `tsc --noEmit` +
   `eslint` (both clean, whole-project) — `next build` still can't run in the sandbox
   (blocked SWC binary download), same pre-existing limitation as before.
2. **Decided and implemented (2026-06-21):** Dean confirmed ("תעשה לפי מה שלחתי זה גם
   מוסבר במסמך איפיון") — תמותה is merged back into the unified `/transfers/new` +
   `TransferDetailManager.tsx` flow as a 5th chip, matching the prototype's
   ops-transfers-screen. `NewTransferForm.tsx` now includes תמותה in `TRANSFER_TYPES`
   (red chip, pond-based source like דילול/פירוק/שיווק); `TransferDetailManager.tsx`
   auto-routes תמותה rows to the virtual receiving pond, hides the dest-pond/population
   -code/transfer-means/vehicle fields for that type, shows "סיבת תמותה" in their place,
   and adds the header-level "הערות חופשיות על אירוע התמותה" textarea (mortality only).
   The old dedicated `/mortality/new/MortalityNewForm.tsx` and
   `transfers/[id]/MortalityDetailManager.tsx` were deleted; `/mortality/new/page.tsx`
   now just redirects to `/transfers/new` for old bookmarks. The now-redundant
   "דיווח תמותה" nav-config.ts entry was removed (תמותה is reachable via the existing
   "העברות דגים" entry, same as the other 4 types). Verified with `tsc --noEmit` +
   `eslint` (clean) — `next build` itself can't run in the sandbox (blocked SWC binary
   download), unrelated to these changes.
3. **Confirmed correct, no action needed:** open-pool/close-pool screens (priority
   cycle code vs computed app code, read-only auto fields) match what's built. The
   closed-row "✎ עריכה" edit button fix made earlier today in `TransferDetailManager.tsx`
   matches the prototype's saved-rows table exactly (it has the same ✎ column).
4. Login in the prototype is a name-dropdown + 4-digit numeric code (e.g. "דנה
   קליין"/"1011"), not username+password. Documented as a known discrepancy only —
   **not changing auth** without explicit confirmation (see SSO-rejection history below).

**Part 2 status (updated 2026-06-27 — see the dated section above for full detail):**
- **Section H pt.2**: status bar + nav drawer — IN PROGRESS, started 2026-06-27.
- **Section I**: Client/Contact/Carrier schema+CRUD+RBAC DONE (2026-06-22 through 2026-06-27).
  Order/Delivery/DeliveryDetail screens themselves still NOT built — blocked on open questions
  (pricing ownership, exact Order scope).
- **Section J**: Daily summary, current status, calendar screens — NOT started. Calendar
  marked optional in spec v3 itself, deprioritized.
- **Section K**: User registration admin screen — DONE (2026-06-22, see entry above).

## Security — standing top priority, check on every change

The user (Dean) has repeated this across multiple sessions, unprompted: **data
security is the most important thing about this app.** Treat this as a
default lens on every task, not a one-time audit. Concretely:

- **Never** hardcode secrets, passwords, or connection strings in source
  files. Read them from `process.env` only. `.env` is real and gitignored —
  do not print its contents back to the user/chat, do not commit it, do not
  weaken `.gitignore`.
- **Never** put real worker PII (names/phones/emails) in a versioned file.
  The existing pattern is `prisma/seed-data/workers.local.ts` (gitignored) +
  `workers.example.ts` (committed fake template) — follow it for any new
  real-PII data, don't invent a different pattern.
- The DB is now a **real, live Neon Postgres instance** (see `.env` —
  `DATABASE_URL` pooled / `DIRECT_URL` direct). Treat `prisma migrate deploy`
  and `npm run seed` against it as real, semi-irreversible actions: confirm
  with the user before re-running seed against production data if it might
  duplicate or overwrite real rows, and never run a destructive command
  (`prisma migrate reset`, dropping tables, etc.) without explicit
  confirmation.
- Any change touching auth, sessions, or RBAC (`src/lib/auth.ts`,
  `src/lib/jwt-secret.ts`, `src/lib/audit.ts`, `src/lib/api-guard.ts`,
  `middleware.ts`) gets extra scrutiny: bcrypt cost stays ≥12, JWT secret
  stays enforced at 32+ chars, login lockout stays DB-backed (not in-memory,
  since this runs as multiple serverless instances), cookies stay
  httpOnly/secure/sameSite.
- If you find a real security issue while working on something else, fix it
  (or flag it clearly) rather than staying silent because it's out of scope.

## Commands

```bash
npm run dev          # start Next.js dev server on localhost:3000
npm run build        # production build
npm run lint         # ESLint via next lint
npm test             # run unit tests (vitest, single pass)
npm run test:watch   # vitest in watch mode
npm run test:e2e     # Playwright e2e tests (requires dev server or starts it automatically)
npm run seed         # seed reference data and the admin Worker row into the DB
npx prisma migrate dev   # apply schema changes and regenerate the Prisma client
npx prisma studio        # visual DB browser
```

Run a single unit test file:
```bash
npx vitest run tests/unit/business-rules.test.ts
```

## Windows dev-environment startup (Claude Code in VS Code)

These quirks are specific to running on Windows and were learned in practice — not obvious from the code alone.

**Correct startup sequence (do this in order every time):**
```bash
# 1. Kill any running node processes (prevents DLL lock on prisma engine)
Stop-Process -Name "node" -Force  # PowerShell, or kill node.exe in Task Manager

# 2. Delete .next cache (prevents webpack pack.gz corruption that causes 500s)
Remove-Item -Recurse -Force .next

# 3. Regenerate Prisma client (prevents PrismaClientInitializationError on first request)
npx prisma generate

# 4. Start dev server
npm run dev
```

**Known recurring issues:**

- **EPERM on `prisma generate`** — means a `node.exe` process still has `query_engine-windows.dll.node` locked. Kill all node processes first.
- **500 on login / `PrismaClientInitializationError`** — Prisma client wasn't regenerated after a restart. Run `npx prisma generate` then restart the server.
- **`.next` cache corruption** (`ENOENT: middleware-manifest.json`, `pack.gz` errors, 500 on navigation) — happens when the dev server is killed mid-write. Delete `.next` entirely and restart.
- **Neon auto-suspend** (`Can't reach database server at ...neon.tech:5432`) — Neon free tier suspends the DB after ~5 min of inactivity. The first request after a pause may fail; simply retry. Upgrade to a paid Neon plan to disable auto-suspend.
- **First browser request times out** — Next.js compiles on first request; allow 10–20 seconds. Use `http://localhost:3000` with patience rather than assuming the server is down.
- **`npx` blocked in PowerShell** (`running scripts is disabled on this system`) — run once to fix: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`
- **`rm -rf` fails in PowerShell** — use `Remove-Item -Recurse -Force .next` instead (PowerShell doesn't support Unix flags).

**Admin account:**
- Username: `admin`
- Default password: `ChangeMe123!` (set via `ADMIN_SEED_PASSWORD` in `.env`, then re-run `npm run seed`)
- `prisma/seed.ts` uses `upsert` with `update: { passwordHash }` — so re-running seed always updates the admin password to the current `ADMIN_SEED_PASSWORD` value.
- If login is locked (5 failed attempts in 15 min): `npx prisma db execute --stdin --schema=prisma/schema.prisma` with `DELETE FROM "AuditLog" WHERE action = 'login_failed' AND username = 'admin';`

## Architecture

**Stack:** Next.js 14 App Router · Prisma ORM · PostgreSQL on Neon (live as of 2026-06-20 — see `.env`/`.env.example` for `DATABASE_URL` pooled + `DIRECT_URL` direct; SQLite is no longer used) · Tailwind CSS · Vitest (unit) · Playwright (e2e).

### Authentication — two-layer model

1. **`middleware.ts`** — fast edge check: is the `mba_session` cookie a validly signed, unexpired JWT? If not, redirect to `/login` or return 401. This does **not** verify worker status or permissions.
2. **`src/lib/current-user.ts` `getCurrentUser()`** — the real gate. Reads the session cookie via `src/lib/auth.ts`, re-fetches the `User` + `Worker` from the DB, loads all permissions fresh. Memoized per request via React `cache()`. Every page and API route must call this; the middleware is not a substitute.

Login is username + password (`src/app/api/auth/login/route.ts`) — bcrypt hash, signed JWT in an httpOnly cookie (`src/lib/auth.ts`), 5-failed-attempts/15-minute lockout backed by `AuditLog` (`src/lib/audit.ts` `isLoginLocked`). Required env var: `JWT_SECRET` (min 32 chars, checked in `src/lib/jwt-secret.ts`).

A Microsoft 365 / Entra ID SSO integration was built and then explicitly reverted (2026-06-19) — the user does not want any Azure/Entra dependency. Deprecated leftovers (`src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`) are inert stubs, not used by anything; safe to delete.

### RBAC — module × access level

Permissions live in `WorkerRole` (worker → role → module → accessLevel). Access levels are integers 1–6; lower = more permissive:

| Constant | Value | Meaning |
|---|---|---|
| `FULL_EDIT` | 1 | Full edit + domain management |
| `DOMAIN_MANAGE` | 2 | Domain management |
| `EXECUTIVE` | 3 | Executive view + approve |
| `OPERATIONS` | 4 | Day-to-day data entry |
| `VIEW_ONLY` | 5 | Read-only |
| `NO_ACCESS` | 6 | Blocked |

Modules seeded: `תפעול` (operations), `הזנה` (feeding), `בריאות` (health), `אדמיניסטרציה`.

**API routes must use `withModuleAccess()`** (`src/lib/api-guard.ts`) as their export wrapper — it enforces the permission check so it can't be accidentally omitted:

```ts
export const POST = withModuleAccess("תפעול", AccessLevel.OPERATIONS, async (req, { user }) => { ... });
```

Hiding a button in the UI is not a substitute for the server-side check.

### Audit trail

Every create/update/delete and every login/logout must call `writeAudit()` from `src/lib/audit.ts`. It stores a before/after JSON snapshot in `AuditLog`. The brute-force login lockout (5 failures in 15 min) also uses `AuditLog` as its backing store — no separate table.

### Business rules

Pure domain logic lives in `src/lib/business-rules.ts` so it can be unit-tested and shared between client-side validation and the API route that actually persists the change. Current rule: when closing a growth cycle, `incoming − outgoing − mortality` must be within ±100 fish (`FISH_BALANCE_TOLERANCE`). Always enforce the rule server-side in the API route, not just in the form.

### Navigation / app shell

`src/lib/nav-config.ts` is the single source for navigation items. Each item declares a `moduleName` that must match an `AppModule.name` in the DB (seeded in `prisma/seed.ts`). `AppShell` filters items the current user has no access to. Desktop shows a sidebar; mobile shows a top bar + bottom tab bar (max 5 items, controlled by `showInBottomBar`). To add a new module page, add its entry in `nav-config.ts` and ensure the module name is seeded.

### DB schema highlights

- `GrowthCycle` tracks fish across one pond over a period; `FishTransferHeader`/`Detail` records movements (purchase, thinning, breakup, marketing, mortality). Transfer types in Hebrew: `קניה | דילול | פירוק | שיווק | תמותה`.
- `FishWeighingHeader` + `FishWeighingBasketDetail` capture basket-by-basket weighing sessions.
- `Translation` table supports multi-language label overrides for reference lists.
- `User.username`/`passwordHash` hold login credentials; `Worker` (firstName/lastName/etc.) links to `User` via `userAccountId`. Created together in `prisma/seed.ts` for the admin account.

### Path alias

`@/` resolves to `src/` in both the app (Next.js config) and tests (`vitest.config.ts` alias).


### fishSwitching feature (2026-07-01)

**Spec page 42**: When a user selects a fish strain not on the source pond's roster (strains introduced via previous `קניה` transfers in the current cycle), a 3-option dialog fires:
1. **ביטול** — cancel, clear strain selection.
2. **החלפת דג** — pick a replacement strain from the pond's roster; POSTs to `/api/fish-switching` to record the identity change, then saves the detail row with the replacement strain.
3. **בצע בכל זאת** — proceed with the off-roster strain; prepends a warning note to the row's notes field.

**Schema**: `FishSwitching` model added to `schema.prisma` (mapped to `fish_switching` table). Relations: `FishTransferDetail → FishSwitching` (Cascade), `FishStrain ×2` via `"SwitchFrom"` / `"SwitchTo"` named relations. Migration SQL in `prisma/migrations/20260701_fish_switching/migration.sql` — **Dean must run `prisma generate` then `prisma migrate dev` locally**.

**API**: `POST /api/fish-switching` — requires `תפעול` module + `OPERATIONS` access level. Uses `(prisma as any).fishSwitching` cast because the sandbox can't run `prisma generate`; the cast is safe to remove after Dean runs generate locally.

**Roster logic**: `page.tsx` (RegularSection) fetches distinct `fishStrainId` values from all `קניה` `FishTransferDetail` rows in the same `cycleId`+`sourcePondId` and passes them as `pondRosterStrainIds` prop. Empty array = no prior קניה = dialog never fires (first-ever fish). `NewTransferForm.tsx` passes `[]` unconditionally (new transfer has no history yet).

