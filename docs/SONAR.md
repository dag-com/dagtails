# SonarQube for DAG Tails

**SonarQube** is the tool: a server that stores analyses and a quality dashboard. This repo scans **into your SonarQube**, not SonarCloud.

Cyber-watch still owns DAG Tails policy (secrets, RLS, email OTP). SonarQube owns generic JS bugs, smells, and security hotspots. Keep both.

GitHub Actions cannot see `localhost`. Local Docker is for you. CI needs a SonarQube URL the runners can reach (a VPS, or skip CI until you have one).

## Local server

Docker Desktop must be running.

```bash
npm run sonar:up
```

Wait until http://127.0.0.1:9000 loads (first boot can take a few minutes).

1. Log in as `admin` / `admin` and set a new password.
2. Create a project key **`dag-tails`** (Create Project → manually), or let the first scan create it.
3. My Account → Security → generate a **user token**.
4. In PowerShell (this session only, do not commit):
   ```powershell
   $env:SONAR_TOKEN='your-token'
   $env:SONAR_HOST_URL='http://127.0.0.1:9000'
   npm run sonar
   ```
5. Open the project on http://127.0.0.1:9000 and read the issues.

Stop: `npm run sonar:down`

## GitHub Actions (optional)

Only if SonarQube is on a URL GitHub can call (not localhost).

Repo secrets:

- `SONAR_HOST_URL` — e.g. `https://sonar.your-domain`
- `SONAR_TOKEN` — a user token from that server

Never commit those. Until both exist, the **SonarQube** workflow skips and does not fail the repo.

Expose a local Docker SonarQube to the internet only behind HTTPS and a changed admin password. The compose file’s `sonar`/`sonar` database login is for local use.

## IDE

**SonarQube for IDE** in Cursor can bind to this same server. That is the editor plugin, not a second product.

## Coverage

Playwright does not emit `lcov` today. SonarQube will still list issues. Coverage % is a later step (`sonar.javascript.lcov.reportPaths`).
