# Player report — GitHub Action setup

Daily snapshots live in this folder. The Action `.github/workflows/player-report.yml` needs a secret that can **read** `public.events` (the game’s anon key cannot).

## Secret

1. In Supabase: **Project Settings → Database → Connection string** (URI).
2. Use the **direct** connection (port `5432`) or **session** pooler. Transaction pooler (port `6543`) can fail this query.
3. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `SUPABASE_DB_URL`
   - Value: the Postgres URI (includes the database password)

Then **Actions → Player report → Run workflow** once to confirm. After that it runs every day at 07:00 UTC.

Do not commit the URI. Do not paste it into issues or chat.

## Manual refresh

From a machine already linked to the `dag-tails` project:

```bash
npm run report:players
```

Then commit `docs/player-reports/` (not `.cursor/skills/player-report/last-snapshot.json`) and push `master`. Or ask the **player-report** agent.
