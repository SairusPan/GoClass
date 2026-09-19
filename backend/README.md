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
`spring.profiles.default: local`, so the local file loads automatically with no extra flags.

A real deployment should set env vars rather than relying on any committed file. Two of them
are enforced at startup (`DeploymentSafety`): `JWT_SECRET` must not be the public yaml
placeholder and must be 32+ characters, and once `PORT` or `MYSQLHOST` is set (Railway does
both) `FRONTEND_URL` must be the public origin, not `http://localhost:5173`. The process
listens on `PORT` (8080 locally). Database coordinates come from Railway's `MYSQL*` plugin
vars, or from `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` if you override them. Tables are created
automatically (`ddl-auto: update`) — no manual migration step yet.

## API

**Auth** (`/api/auth`) — `register` (now requires `email`), `login`, `refresh`, `forgot-password`,
`reset-password`, `logout` (auth required), `GET/PATCH me` (auth required). `PATCH /me` edits
`name`/`adminName`/`email` only — `username` is the login credential and `password` has its own
reset flow, so neither is accepted here.

**Scheduling** (all require `Authorization: Bearer <accessToken>`, all scoped to the caller's institution):

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/teachers` | |
| PATCH/DELETE | `/api/teachers/{id}` | partial update; delete refused while still referenced (see below) |
| GET/POST | `/api/subjects` | |
| PATCH/DELETE | `/api/subjects/{id}` | partial update; delete refused while still referenced (see below) |
| GET/POST | `/api/rooms` | |
| PATCH/DELETE | `/api/rooms/{id}` | partial update; delete refused while still referenced (see below) |
| GET/POST | `/api/classes` | |
| PATCH | `/api/classes/{id}` | **scheduling** — `teacherId`/`roomId`/`day`/`start`/`status`, any subset |
| PATCH | `/api/classes/{id}/details` | **description** — `name`/`subjectId`/`studentCount`/`durationMinutes` |
| DELETE | `/api/classes/{id}` | cascades to that class's one-week overrides |
| POST | `/api/classes/{id}/publish` | |
| POST | `/api/classes/publish-drafts` | publishes every draft, returns the full class list |
| GET/POST | `/api/leave` | file a leave request |
| PATCH | `/api/leave/{id}` | `{reason}` — the only editable field |
| POST | `/api/leave/{id}/substitute` | `{teacherId}` |
| POST | `/api/leave/{id}/reschedule` | `{day, start, roomId}` |
| POST | `/api/leave/{id}/cancel` | soft cancel, restores the timetable (see below) |
| GET | `/api/notifications` | |
| PATCH | `/api/notifications/{id}/read` | |
| POST | `/api/notifications/read-all` | returns the full list |
| DELETE | `/api/notifications/{id}` | |
| DELETE | `/api/notifications` | clears the caller's whole queue |

### Why a class has two PATCH routes

`PATCH /api/classes/{id}` means "put this class in a slot", and it promotes an `unscheduled` class
to `draft` as a side effect. Fixing a typo in a class name shouldn't do that, so the descriptive
fields live on `/details` instead of sharing the route.

`subjectId` is checked against the caller's own subjects on both create and update — it arrives
straight from the client, so an unchecked id would let a class point at another tenant's subject.

### Cancelling a leave request

`POST /api/leave/{id}/cancel` is a soft cancel: `resolution` becomes `cancelled` and the row stays
as history. Resolving writes directly onto the `ClassSession`, so `LeaveRecord` snapshots
`originalDay`/`originalStart`/`originalRoomId` at file time and cancelling restores them along with
`originalTeacherId` — otherwise a cancelled reschedule would leave the class stranded in its
make-up slot. Notifications already queued are **not** retracted; the substitute's email has been
sent, and deleting the record would be pretending otherwise. Rows filed before those columns
existed have them null, in which case cancelling restores the teacher and leaves the slot alone.
A cancelled request is terminal — resolving or cancelling it again returns `409`.

### Deleting teachers, subjects and rooms

Deletes are refused with a `409` and a message naming what's in the way, rather than cascading
or quietly nulling references out:

- **Teacher** — blocked while assigned to any class or any one-week override. Leave records also
  carry teacher ids, but those are historical; counting them would make anyone who ever took a
  day off permanently undeletable, so a resolved record just shows a dash for the name.
- **Room** — blocked while used by any class or one-week override.
- **Subject** — blocked while any class uses it *or* any teacher lists it. `ClassSession.subjectId`
  is non-null, so unlike a teacher or room there's no "unassign but keep the class" fallback —
  the only alternative to blocking would be deleting someone's classes for them.

`PATCH` is partial: a field left out of the body is untouched, matching `/api/classes/{id}`. On a
teacher, a supplied `subjectIds`/`availability` replaces the whole list rather than merging into it.

The actual scheduling *logic* (conflict detection, suggestion generation, substitute matching,
reschedule search) stays on the frontend (`src/utils/scheduling.ts`, unit-tested there) — it's
pure filtering over data fetched from these endpoints, not something worth re-implementing in
Java. This backend's job is durable, tenant-isolated storage, not the algorithm.

## Tests

`mvn test` runs 47 tests against an in-memory H2 database (no MySQL needed):

- `AuthFlowIntegrationTest` — register/login/refresh-rotation/logout/duplicate-username/wrong-password,
  plus forgot-password (silent on unknown username), reset-password (rejects invalid/expired
  tokens, invalidates the existing session, old password stops working / new one works)
- `ScheduleFlowIntegrationTest` — demo seeding counts, the deliberate seeded conflict, **two
  institutions never share a teacher row**, **institution B cannot PATCH institution A's class by
  guessing its id** (404, not 403 — it doesn't even leak that the row exists), assign→draft,
  file-leave→substitute→notifications end to end, and the teacher/subject/room delete guards —
  including the two-stage subject case where clearing its classes still isn't enough because a
  teacher continues to list it. Also covers the two class PATCH routes staying out of each
  other's way (renaming an `unscheduled` class leaves it unscheduled), cross-tenant `subjectId`
  rejection, cancelling a *rescheduled* leave putting the class back on its original day, start,
- `DeploymentSafetyTest` — refuses to boot with the public JWT placeholder, a secret shorter
  than 32 characters, or a hosted process still pointing `FRONTEND_URL` at Vite.

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
