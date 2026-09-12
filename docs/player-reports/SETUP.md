# Player report — GitHub Action setup

Daily snapshots live in this folder. Outside reviewers should use the public page (no GitHub login):

https://dag-com.github.io/dagtails/player-reports/

The Action `.github/workflows/player-report.yml` needs a secret that can **read** `public.events` (the game’s anon key cannot). After each snapshot it also publishes that URL via GitHub Pages.

## Secret

The URI is **not** under Project Settings → Database anymore (that page is mostly password reset).

1. Open the **dag-tails** project: https://supabase.com/dashboard/project/suhrxksuwjsfeenztvdn  
2. Click **Connect** at the top of the dashboard (green button next to the project name), or open:  
   https://supabase.com/dashboard/project/suhrxksuwjsfeenztvdn?showConnect=true&method=session  
3. Copy the **Session pooler** URI (port `5432`). Direct (`db.…:5432`) is fine if your network supports it. Do **not** use Transaction pooler (port `6543`) — that can fail this query.  
4. If the URI shows `[YOUR-PASSWORD]`, replace it with the database password. Forgot it? **Project Settings → Database** → **Reset database password**, then paste the new password into the URI.  
5. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `SUPABASE_DB_URL`
   - Value: the full `postgresql://…` URI (password included)

Then **Actions → Player report → Run workflow** once to confirm. After that it runs every day at 07:00 UTC.

Do not commit the URI. Do not paste it into issues or chat.

## Manual refresh

From a machine already linked to the `dag-tails` project:

```bash
npm run report:players
```

Then commit `docs/player-reports/` (not `.cursor/skills/player-report/last-snapshot.json`) and push `master`. Or ask the **player-report** agent.
