# GoClass backend

Spring Boot 3 + MySQL, multi-tenant. Every table carries `institution_id`; every query is
scoped to the caller's own institution (taken from the JWT, never from the request body/path),
so one tutoring centre can never read or write another's data. The frontend (`../src`) now talks
to this API for everything — auth, teachers, subjects, rooms, classes, leave, notifications.

## Stack

- Java 17, Spring Boot 3.3, MySQL (Spring Data JPA)
- BCrypt for password hashing (`spring-security-crypto` only — not the full
  `spring-boot-starter-security`, since that auto-configures a session/login filter chain we
  don't want for a stateless JWT API)
- JWT via `jjwt`, with a custom `OncePerRequestFilter` (`JwtAuthFilter`) guarding `/api/**`

## Auth

- **Access token**: 15 min, sent as `Authorization: Bearer <token>`.
- **Refresh token**: 7 days, rotated on every `/api/auth/refresh` call — the token just used is
  invalidated and a new pair issued. Replaying an already-rotated-out refresh token is rejected.
- CORS preflight (`OPTIONS`) requests are let through the auth filter unconditionally — they
  never carry an `Authorization` header, so blocking them would break every cross-origin call to
  a protected route before it even sends the real request.

## Email

`EmailService` (in `email/`) sends via [Resend](https://resend.com)'s HTTP API — no SMTP, just a
POST request. With no `RESEND_API_KEY` configured it logs what it would have sent instead of
sending, so the app and test suite work fine without one. Two things actually trigger an email:

- **Password reset** (`/api/auth/forgot-password`) — always responds the same way whether or not
  the username exists, to avoid leaking which usernames are registered. If the account has an
  email on file, a one-time link (`{FRONTEND_URL}/reset-password?token=...`, 30 min expiry) is
  sent; `/api/auth/reset-password` consumes it, and also kills any existing session (clears
  `refreshTokenId`) so a leaked old session can't outlive a password change.
- **Leave/substitute notifications to teachers** (`LeaveService.notifyTeacher`) — the teacher gets
  a real email if they have one on file (`schedule/Teacher.email`); student/parent notifications
  stay queue-only (`/api/notifications`) since there's no student/parent contact data model yet.

**Resend sandbox limit**: a new Resend account with no verified sending domain can only deliver to
the email address the account itself signed up with — everything else gets rejected
(`example.com` addresses are rejected outright, real addresses just silently can't be reached).
Verify a domain you own in the Resend dashboard to send to arbitrary teacher/institution
addresses; nothing in the code changes, just the `from-address` config value.

## Multi-tenancy

- `Institution` (in `auth/`) is both the tenant and its one admin login.
- Every other entity (`schedule/Teacher`, `Subject`, `Room`, `ClassSession`, `LeaveRecord`,
  `NotificationItem`) carries an `institutionId` column. Repositories only expose
  `findByInstitutionId(...)` / `findByIdAndInstitutionId(...)` — there is no "fetch by id alone"
  path, so a controller can't accidentally return or mutate another tenant's row even if a client
  guesses a valid numeric id.
- `DemoSeedService` runs once, right after registration, and populates the new institution with
  the same demo dataset the frontend used to ship as static mock data (6 teachers, 6 subjects,
  4 rooms, 10 classes, including one deliberate double-booking) — so every new tenant starts from
  a working, demonstrable timetable instead of an empty one.

## Running it locally

```bash
cp src/main/resources/application-local.yml.example src/main/resources/application-local.yml
# edit application-local.yml with your own MySQL username/password and a JWT secret

mvn spring-boot:run
```

`application-local.yml` is gitignored — never commit real credentials. `application.yml` sets
`spring.profiles.default: local`, so the local file loads automatically with no extra flags; a
real deployment should set `SPRING_PROFILES_ACTIVE` (and `JWT_SECRET`, `DB_USERNAME`,
`DB_PASSWORD` etc. as env vars) instead of relying on any committed file. Tables are created
automatically (`ddl-auto: update`) — no manual migration step yet.

## API

**Auth** (`/api/auth`) — `register` (now requires `email`), `login`, `refresh`, `forgot-password`,
`reset-password`, `logout` (auth required), `me` (auth required).

**Scheduling** (all require `Authorization: Bearer <accessToken>`, all scoped to the caller's institution):

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/teachers` | |
| GET/POST | `/api/subjects` | |
| GET/POST | `/api/rooms` | |
| GET | `/api/classes` | |
| PATCH | `/api/classes/{id}` | partial update — `teacherId`/`roomId`/`day`/`start`/`status`, any subset |
| POST | `/api/classes/{id}/publish` | |
| POST | `/api/classes/publish-drafts` | publishes every draft, returns the full class list |
| GET/POST | `/api/leave` | file a leave request |
| POST | `/api/leave/{id}/substitute` | `{teacherId}` |
| POST | `/api/leave/{id}/reschedule` | `{day, start, roomId}` |
| GET | `/api/notifications` | |

The actual scheduling *logic* (conflict detection, suggestion generation, substitute matching,
reschedule search) stays on the frontend (`src/utils/scheduling.ts`, unit-tested there) — it's
pure filtering over data fetched from these endpoints, not something worth re-implementing in
Java. This backend's job is durable, tenant-isolated storage, not the algorithm.

## Tests

`mvn test` runs 18 integration tests against an in-memory H2 database (no MySQL needed):

- `AuthFlowIntegrationTest` — register/login/refresh-rotation/logout/duplicate-username/wrong-password,
  plus forgot-password (silent on unknown username), reset-password (rejects invalid/expired
  tokens, invalidates the existing session, old password stops working / new one works)
- `ScheduleFlowIntegrationTest` — demo seeding counts, the deliberate seeded conflict, **two
  institutions never share a teacher row**, **institution B cannot PATCH institution A's class by
  guessing its id** (404, not 403 — it doesn't even leak that the row exists), assign→draft,
  file-leave→substitute→notifications end to end.

## Deploying

See `../README.md` — this repo builds into one Docker image (frontend baked in as static
resources) meant for a single Railway service. `SpaFallbackController` exists specifically for
that: without it, a browser hitting `/reset-password` directly (from an emailed link) would get a
raw 404 from Spring instead of the React app.

## Not done yet

- Excel import/export
- Real SMS delivery
- Rate limiting on login/register/forgot-password (brute-force protection)
- Email verification on signup
- DB migrations (still `ddl-auto: update`) — fine pre-launch, worth revisiting once this holds real data
- Billing
