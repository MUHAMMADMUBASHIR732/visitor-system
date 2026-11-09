# Foyer — visitor management for offices

Pre-register visitors, send them a QR pass, check them in at the front desk, and know who is in the building at all times.

**Stack:** NestJS 11 + Drizzle + PostgreSQL + Socket.IO · React 19 + Vite + Tailwind 4 + Motion.

## What makes it different
- **Lanyard pass card**: animated visitor pass with QR and a 6-digit backup code; shareable by email or a free WhatsApp link.
- **Emergency roll call**: freezes the list of everyone inside, guards mark people safe, and everyone sees a live banner.
- **Live everything** via WebSockets (walk-in approvals, arrivals, check-outs).
- Returning-visitor autofill, blacklist, audit trail, CSV export, no-show and overdue sweeps, insights on the admin overview.
- `Ctrl+K` command palette, dark mode, printable badge, installable (PWA manifest).

## Roles
| Role | Can add | Sees | Lands on |
|---|---|---|---|
| Administrator | anyone (senior managers, managers, hosts, employees, guards) | everything | `/admin` |
| Senior manager | managers only | every manager and everyone under them | `/manage` |
| Manager | hosts and employees only; invites visitors for them | their own team | `/manage` |
| Host / Employee | nobody; invites their own visitors | their own visits | `/host` |
| Security | nobody | the front desk, roll call | `/gate` |

When a visitor **arrives or leaves**, the host, the host's manager and the senior manager above them each get an in-app notification (bell icon) and an email.

## Security
Accounts lock for 15 minutes after 5 wrong passwords (a manager or admin can unlock by resetting the password). Passwords need 8+ characters with a letter and a number. People can change their own password from the sidebar. Pass QR codes are signed and expire. The web app ships strict security headers (`public/_headers`, `vercel.json`: CSP, no framing, camera only for this site). Login is rate limited.

## Upgrading an existing database
If you already ran an earlier version, in `apps/api` run `npm run build && npm run db:migrate && npm run db:seed`. The migration adds the new roles and tables; the seed only adds the missing demo senior manager, manager and employee (it does not touch your data).

## Run locally
```bash
docker compose up -d                       # Postgres (or point DATABASE_URL at any Postgres)
cd apps/api && cp .env.example .env        # then set JWT_SECRET and QR_SECRET
npm install && npm run build
npm run db:migrate && npm run db:seed      # seed creates demo users + 14 days of sample data
npm run start                              # API on :4000

cd ../web && cp .env.example .env          # VITE_API_URL=http://localhost:4000
npm install && npm run dev                 # app on :5173
```
Check the API with `npm run smoke` inside `apps/api` (54 checks), then `node scripts/smoke-roles.mjs` (50 more, about 2 minutes).

**Demo logins** (password `Foyer@2026`): `admin@foyer.demo`, `senior@foyer.demo`, `manager@foyer.demo`, `host@foyer.demo`, `sana@foyer.demo`, `employee@foyer.demo`, `guard@foyer.demo`.
**Change or delete these before real use** (Admin → Team).

## Deploy for free, no card: everything on Vercel + Neon
Both the website and the API run as two Vercel projects from the same GitHub repo. No server and no card needed.

1. **Database (Neon).** You will use two connection strings from Neon's **Connect** panel: the **direct** one for migrations (on your computer) and the **pooled** one (host contains `-pooler`) for Vercel. Remove `&channel_binding=require` from both and keep `?sslmode=require`.
2. **Migrate once from your computer** (`apps/api/.env` holding the direct string): `npm run build && npm run db:migrate && npm run db:seed`.
3. **API project on Vercel.** Add New Project → import the repo → click **Import single project** next to `api` (or set Root Directory to `apps/api`). Framework: NestJS (detected). Environment variables:

| Name | Value |
|---|---|
| `DATABASE_URL` | the **pooled** Neon string |
| `JWT_SECRET` | long random string (32+ chars) |
| `QR_SECRET` | a different long random string |
| `CORS_ORIGIN` | your web project URL (add after step 4, then redeploy) |
| `WEB_URL` | same as `CORS_ORIGIN` |
| `OFFICE_TIMEZONE` | `Asia/Karachi` |
| `DEFAULT_COUNTRY_CODE` | `92` |
| `RESEND_API_KEY` | optional, see email notes |

   Check `https://<api-project>.vercel.app/api/health` shows `"status":"ok"`.
4. **Web project on Vercel.** Add New Project → same repo → **Import single project** next to `web` (Root Directory `apps/web`, Framework Vite). Environment variables: `VITE_API_URL` = the API project URL (no trailing `/`, no `/api`) and `VITE_REALTIME` = `off`.
5. Put the web URL into the API's `CORS_ORIGIN` and `WEB_URL`, then **Redeploy** the API.

In this mode there is no WebSocket server, so the app refreshes itself every 10 seconds (the sidebar says "Auto" instead of "Live"). Visitor photos are stored in the database (they survive redeploys). The no-show cleanup runs when someone opens a dashboard (at most every 5 minutes). The API detects Vercel automatically (`VERCEL=1`); set `SERVERLESS=true` to force this mode elsewhere.

## Deploy on a normal server (Render, Railway, a VPS)
Use `render.yaml` (needs a card on Render). Set `DATABASE_URL`, `CORS_ORIGIN`, `WEB_URL`; the start command (`npm run start:prod`) runs migrations. Then deploy `apps/web` to Vercel/Netlify with `VITE_API_URL` only (live WebSocket updates stay on).

## Things to know
- **Camera scanning needs HTTPS** (fine on Vercel/Netlify; on plain http use the 6-digit code).
- **On Vercel** each request may start a cold function (a second or two), rate limits are per instance, and the free Hobby plan has usage limits. **Render free sleeps** after ~15 min idle (first request is slow, and live updates and the scheduled sweeps pause). Use the ~$7/month plan for a real office.
- **Vercel Hobby is non-commercial.** Use Netlify, Cloudflare Pages, or a paid Vercel plan for a company.
- **Photos** are stored on local disk (`UPLOAD_DIR`) on a normal server (wiped on redeploy on Render; mount a disk or move `storage` to R2/S3) and in the database on Vercel.
- WhatsApp uses a free `wa.me` share link (no paid API). Email is the only automatic notification.
- Limits: login 10/min, API 240/min per IP.

## Resuming development
See `PROGRESS.md`.
