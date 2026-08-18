# GoClass — scheduling SaaS for Australian tutoring centres

React + TypeScript frontend, Spring Boot + MySQL backend. Multi-tenant: each institution
registers its own account and gets its own isolated teachers/subjects/rooms/classes — see
`backend/README.md` for how that isolation is enforced.

## Run

Two processes, both required:

```bash
# backend — see backend/README.md for first-time MySQL setup
cd backend && mvn spring-boot:run   # localhost:8080

# frontend
npm install && npm run dev          # localhost:5173
```

## What's here

**Frontend**
- `src/pages/Dashboard.tsx` — overview + alerts
- `src/pages/DataSetup.tsx` — enter teachers / subjects / rooms
- `src/pages/ScheduleBoard.tsx` — generate scheduling suggestions, see
  conflicts highlighted on the weekly grid, manually adjust, publish
- `src/pages/LeaveSubstitute.tsx` — mark a teacher away, find a substitute,
  or fall back to a suggested make-up slot
- `src/pages/Auth.tsx` — login / register a tutoring centre
- `src/utils/scheduling.ts` — the pure, client-side suggestion / conflict /
  substitute-matching logic, unit-tested (`npm run test`, 23 tests)
- `src/state/SchedulingContext.tsx` — fetches/mutates this institution's data via the backend API
- `src/state/AuthContext.tsx` — login/session, JWT stored locally with automatic refresh
- `src/state/apiClient.ts` — shared fetch wrapper (attaches the access token, retries once via
  refresh-token rotation on a 401)

**Backend** — see `backend/README.md`.

## Tests

```bash
npm run test          # frontend: scheduling.ts unit tests (Vitest)
cd backend && mvn test  # backend: auth + multi-tenant isolation integration tests
```

## Deploying (Railway)

`Dockerfile` at the repo root builds the frontend, embeds its output as Spring Boot static
resources (`backend/src/main/resources/static/`), and packages everything into one JAR — one
service, one origin, no CORS in production, no separate frontend host to manage. Verified locally
by running the packaged JAR standalone: it serves the app at `/`, the API at `/api/**`, and
`/reset-password` (the one client-side route, reached from password-reset emails) correctly falls
back to `index.html` instead of 404ing — see `SpaFallbackController.java`.

1. Push this repo to GitHub, connect it to a new Railway project (Railway auto-detects the
   `Dockerfile`).
2. Add a MySQL plugin in Railway — it gives you `DB_USERNAME`/`DB_PASSWORD`/host/port as env vars.
3. Set these env vars on the Railway service (see `backend/README.md` for what each does):
   `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET` (generate a fresh random one — don't reuse the dev
   default), `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `FRONTEND_URL` (your Railway/custom domain,
   once you have one), `CORS_ALLOWED_ORIGINS` (same domain — same-origin in production means this
   mostly matters for anyone hitting the API directly, not the app itself).
4. Railway builds the Dockerfile and gives you a `*.up.railway.app` URL immediately — the app is
   live there before you own a domain. Add a custom domain later in Railway's dashboard whenever
   you buy one; Railway provisions HTTPS for it automatically.
5. To send real email to arbitrary recipients (not just your own Resend account email), verify a
   domain you own in the Resend dashboard — see the note in `backend/README.md`.

Not yet wired into the Dockerfile: automated DB migrations (still relies on `ddl-auto: update`,
fine for now, worth revisiting before this holds real customer data).

## Not done yet

Excel import/export, real SMS delivery, billing, DB migrations for schema changes.
