# Seed data with real PII

`workers.local.ts` holds real workers' names, phone numbers, and email
addresses (extracted from `workers-sivan.xlsx`). It is **gitignored**
(`prisma/seed-data/*.local.ts` in `.gitignore`) so this real personal data
never ends up committed to source control, even if this repo is later
pushed somewhere (GitHub, a contractor's machine, etc.).

- `workers.local.ts` - the real data. Exists locally; not tracked by git.
  If it's missing, `prisma/seed.ts` skips worker seeding and logs a warning
  instead of failing.
- `workers.example.ts` - a template with fake data showing the expected
  shape. This one IS tracked by git.

To restore `workers.local.ts` on a new machine, copy `workers.example.ts` to
`workers.local.ts` and fill in the real values from the source spreadsheet
in the project workspace folder (`טבלאות מטה דאטה/workers-sivan.xlsx`), or
ask Dean/Dana for the data directly.

Ponds, fish strains, and products are NOT treated this way - that data
isn't personal information, so it stays directly in `seed.ts`.
