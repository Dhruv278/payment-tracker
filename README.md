# Payment Tracker

Track freelance projects, milestones and client payments. Clients get a portal
to see what they owe, pay via your Wise link and upload proof; you verify and
record what you actually received (private to you).

Design: [`docs/superpowers/specs/2026-09-26-freelance-payment-tracker-design.md`](docs/superpowers/specs/2026-09-26-freelance-payment-tracker-design.md)

**Stack:** Next.js 16 · Supabase (Postgres, Auth, Storage) · Tailwind · Nodemailer (Gmail) · Vercel

## How it works

1. Client signs up → you get an email → you approve on **Clients** (or invite them directly).
2. Create a **Project** for the client with its total price and currency (e.g. $1600 USD).
3. Add **Milestones** (e.g. $400 — Phase 1).
4. When a milestone is done, **Request payment**: attach your Wise payment link and/or invoice PDF. The client is emailed.
5. Client pays, then uploads the receipt PDF + date + Wise reference. You're emailed.
6. You **verify** and record the net amount you received — any currency, e.g. ₹36,000 or $350. Clients never see this.
7. **Reports** show billed vs. net earned by client, project and date range (incl. Indian FY presets), with CSV export.

## Run locally (no cloud accounts needed)

Requires Node 20+ and Docker Desktop running.

```bash
npm install
npm run db:start          # local Supabase: Postgres, Auth, Storage, mail catcher (first run downloads images)
cp .env.example .env.local
```

Fill `.env.local` with the keys printed by `db:start` (or run `npx supabase status`):

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_BRAND_NAME=Your Name
NEXT_PUBLIC_BRAND_TAGLINE=Freelance software developer
DEVELOPER_EMAILS=you@example.com
SMTP_HOST=127.0.0.1
SMTP_PORT=54325
EMAIL_FROM=billing@example.local
```

Then `npm run dev` and open http://localhost:3000.

| Local service | URL |
|---|---|
| App | http://localhost:3000 |
| Mail inbox (every email the app sends) | http://127.0.0.1:54324 |
| Supabase Studio (browse tables & files) | http://127.0.0.1:54323 |

1. Sign up with the email in `DEVELOPER_EMAILS` → confirm via the link in the mail inbox → you land on the dashboard.
2. Sign up as a client in a private window (or invite one from **Clients**) and walk through the flow.

`npm run db:reset` wipes the local database and re-applies the migration. `npm run db:stop` shuts Supabase down.

## Deploy (Supabase cloud + Vercel)

1. Create a project at [supabase.com](https://supabase.com). In **SQL Editor**, run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) (tables, security policies, private `documents` bucket).
   Or link the CLI and run `npx supabase db push`.
2. **Authentication → URL Configuration**: Site URL = your Vercel URL; Redirect URLs = `https://your-app.vercel.app/**`.
3. **Authentication → Emails → SMTP Settings**: enable custom SMTP so confirm/reset emails come from your Gmail — host `smtp.gmail.com`, port `465`, your Gmail + app password.
4. Gmail app password: Google Account → Security → 2-Step Verification → **App passwords**.
5. Import the repo in Vercel and set the env vars from `.env.example` (use `GMAIL_USER` / `GMAIL_APP_PASSWORD` instead of `SMTP_HOST`, and your real `NEXT_PUBLIC_SITE_URL`).

## Notes

- **Security:** RLS is enabled on every table. Pages read with the user's session; all writes go through Server Actions that check role + ownership, then use the service-role key. Net earnings live in a separate developer-only table.
- **Files:** PDFs/images up to 4 MB, stored in a private bucket, downloaded via 10-minute signed URLs.
- **Multiple developers later:** every record already has a `developer_id`. Add more emails to `DEVELOPER_EMAILS` — each developer only sees their own clients and projects. (New self sign-ups are visible to every developer until one approves them; per-developer invite links would be the next step.)
- **Invites & sign-in links:** the app sends its own branded invite and "new sign-in link" emails (Clients → client → *Send a new sign-in link*) — useful when an invite expires or a client forgets their password.
- **Partial payments** aren't supported by design — one payment request per milestone. Split work into more milestones instead.
