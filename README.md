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

## Deploy (all have free tiers)
1. **Database: Neon.** Create a project, copy the connection string.
2. **API: Render.** New → Blueprint, pick this repo (`render.yaml`). Set `DATABASE_URL`, `CORS_ORIGIN` (your web URL), `WEB_URL`. The start command runs migrations automatically. Run `npm run db:seed` once from the Render shell, or create your own admin.
3. **Web: Vercel or Netlify.** Root directory `apps/web`, build `npm run build`, output `dist`, env `VITE_API_URL=https://<your-api>.onrender.com`.
4. **Email: Resend.** Create an API key, set `RESEND_API_KEY` and `MAIL_FROM` (verify your domain to send to anyone).

## Things to know
- **Camera scanning needs HTTPS** (fine on Vercel/Netlify; on plain http use the 6-digit code).
- **Render free sleeps** after ~15 min idle (first request is slow, and live updates and the scheduled sweeps pause). Use the ~$7/month plan for a real office.
- **Vercel Hobby is non-commercial.** Use Netlify, Cloudflare Pages, or a paid Vercel plan for a company.
- **Photos** are stored on local disk (`UPLOAD_DIR`), which is wiped on redeploy on Render. For production, mount a persistent disk or move `storage` to Cloudflare R2/S3.
- WhatsApp uses a free `wa.me` share link (no paid API). Email is the only automatic notification.
- Limits: login 10/min, API 240/min per IP.

## Resuming development
See `PROGRESS.md`.
