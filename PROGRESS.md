# Foyer build progress (resume file)

Product: **Foyer**, a visitor management system for offices.
Stack: NestJS 11 + Drizzle ORM (PostgreSQL) + Socket.IO | React 19 + Vite + Tailwind 4 + Motion.
Theme: coffee palette. Coffee Bean #2D211B, Mocha #7B5A48, Oat Milk #E7D7C2, Cream Foam #F8F1E8, Cinnamon #B9784D.
Signature element: the animated visitor pass (badge) card.
ORM note: Prisma was replaced by Drizzle because Prisma's engine download is blocked in the build workspace.
Versions pinned: NestJS 11, TypeScript 5.9, Drizzle 0.45. Do not upgrade to Nest 12 / TS 7 without testing.

## How to resume
1. Read this file, then run `git status`-style checks with `ls` on apps/api/src and apps/web/src.
2. Continue with the first unchecked item below. Tick items off here as they are finished.

## Backend (apps/api)
- [x] tsconfig, nest-cli, drizzle.config, .env.example, .gitignore
- [x] db: schema.ts, db.module.ts, migrate.ts
- [x] common (auth guards, normalize), audit, pass (signed QR tokens), realtime (gateway), storage, notifications
- [x] auth, users + departments, blacklist
- [x] visits (service, dto, controller, public pass endpoint)
- [x] gate (scan, check-in, check-out, walk-in, inside)
- [x] reports (summary, csv, audit)
- [x] schema additions: roll_calls + roll_call_entries
- [x] roll-call module (start, active, mark safe/undo, end)
- [x] visitor lookup endpoint (returning visitors autofill)
- [x] tasks (cron: no-show sweeper, overdue alert)
- [x] app.module.ts, main.ts, health controller
- [x] seed.ts (demo users + 14 days of sample visits)
- [x] drizzle-kit generate (migration SQL in apps/api/drizzle)
- [x] build with tsc, fix errors
- [x] smoke test against a real local Postgres (scripts/smoke.mjs)

Backend status: DONE and verified (54 smoke checks pass, websocket rooms verified).
Local test DB: `pg_ctlcluster 16 main start`, db `foyer`, user postgres/postgres. API .env exists locally (not shipped).
To re-run: `cd apps/api && npm run build && node dist/main.js` then `node scripts/smoke.mjs`.
Phone numbers are normalised to +<country><number> (DEFAULT_COUNTRY_CODE=92), found via smoke test.

## Frontend (apps/web)
App.tsx lazy-imports these page files; ALL must exist before `npm run build` passes:
pages/host/{HostToday,HostNewVisit}.tsx, pages/VisitsPage.tsx (prop mode: host|admin), pages/gate/{FrontDesk,Inside,WalkIn,RollCallPage}.tsx,
pages/admin/{Overview,UsersPage,BlacklistPage,AuditPage}.tsx
Shared DONE: components/{VisitList,VisitRow,VisitSheet,QrScanner,PhotoCapture,StatTile,PrintBadge}.tsx, lib/queries.ts
- [x] vite/tailwind/ts config, theme tokens, fonts (src/index.css, index.html)
- [x] api client, auth context (lib/auth.tsx), live socket (lib/live.tsx), theme (lib/theme.ts), App.tsx routes + guards, main.tsx
- [x] shared UI kit: src/components/ui.tsx, overlays.tsx (Sheet, Modal), toast.tsx, CountUp.tsx; lib/{api,types,format}.ts
- [x] visitor pass component (components/PassCard.tsx), pages/PublicPass.tsx
- [x] login page (pages/Login.tsx) + Shell.tsx, nav.ts, CommandPalette.tsx, Logo.tsx
- [x] host: HostToday, HostNewVisit (WhatsApp share link, returning-visitor autofill), VisitsPage (host+admin)
- [x] guard: FrontDesk, Inside, WalkIn, RollCallPage (all written; not yet type-checked)
- [x] admin: Overview (hand-built charts in components/charts.tsx, insights), UsersPage, BlacklistPage, AuditPage; visit log = VisitsPage mode=admin
- [x] command palette, printable badge, emergency banner (in Shell)
- [x] responsive pass + reduced motion
- [x] vite build passes

NOTE: gate.module.ts code-scan no longer filters by time (judge() says 'too early'); API must be rebuilt (`cd apps/api && npm run build`) before final smoke run.
NEXT: `cd apps/web && npx tsc --noEmit`, fix errors, `npm run build`, rebuild API + rerun smoke, browser screenshots (playwright) for visual QA at 390px / 820px / 1440px, dark mode check.

## Delivery
- [x] README (run locally, env vars, deploy to Neon + Render + Vercel/Netlify, costs)
- [x] docker-compose.yml for local Postgres
- [x] zip and send to the user


## Status
Frontend DONE (tsc + vite build pass, visual QA done). Delivery files written (README, docker-compose, render.yaml, SPA redirects). Remaining: zip and hand over.

## V2 upgrade (roles, notifications, landing page) — RESUME HERE
Backend V2 DONE and verified (smoke.mjs 54 ok, smoke-roles.mjs 50 ok):
- Roles: ADMIN, SENIOR_MANAGER (adds only MANAGER), MANAGER (adds only HOST/EMPLOYEE, invites visitors for team), HOST, EMPLOYEE, GUARD.
- users.manager_id = reporting line. ScopeService (common/scope.module.ts) decides who sees whom.
- Notifications: arrive/leave -> host + manager + senior manager (in-app table + socket event `notification` + email). Endpoints /notifications, /notifications/read-all, /notifications/:id/read.
- Security: 5 wrong passwords = 15 min lock, password policy (8+ chars, letter+number), POST /auth/password, manager can reset team passwords.
- Demo logins added: senior@foyer.demo, manager@foyer.demo, employee@foyer.demo (password Foyer@2026). Run `npm run db:migrate && npm run db:seed` on existing DBs.
- API: GET /users/hosts?scope=team, GET /users/parents?role= (admin), reports summary/CSV scoped by role.
Frontend V2 TODO (tick as done):
- [x] types/auth: new roles, managerId; nav per role; route guards
- [x] Team page (replaces UsersPage for admin/senior/manager) with role-aware add form
- [x] Manager dashboard + senior dashboard (reuse Overview scoped), HostNewVisit host picker for managers
- [x] Notification bell + live toast
- [x] Landing page (/) with typewriter, split text, scroll-driven gradient, hover shadows. NO decorative background shapes: gradients only.
- [x] PasswordInput with show/hide + animated characters; use in Login, Team forms, change password modal
- [x] Theme toggle on landing, login, public pass
- [x] Scan QR button (global, modal with camera + image upload)
- [x] Security headers (_headers, vercel.json CSP)
- [x] vite build, screenshots, zip, README

V2 DONE: frontend built (tsc + vite build pass), screenshots reviewed, README/zip updated. Nothing left unless the user asks for more.

V3: serverless mode for Vercel (common/runtime.ts SERVERLESS): no socket gateway/cron, photos in DB (migration 0002), lazy sweep, awaited emails; web VITE_REALTIME=off polls every 10s. Both modes pass smoke (54) and roles smoke (50).
