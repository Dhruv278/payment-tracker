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

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   This creates the tables, RLS policies and the private `documents` storage bucket.
3. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000` (later your Vercel URL)
   - Redirect URLs: `http://localhost:3000/**` and `https://your-app.vercel.app/**`
4. **Authentication → Emails → SMTP Settings** → enable custom SMTP so auth emails (confirm, reset, invite) come from your Gmail:
   - Host `smtp.gmail.com`, port `465`, user = your Gmail, password = your app password.
5. **Project Settings → API** → copy the URL, publishable (anon) key and secret (service role) key.

### 2. Gmail app password

Google Account → Security → 2-Step Verification (must be on) → **App passwords** → create one and use it as `GMAIL_APP_PASSWORD`.

### 3. Run locally

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev
```

Open http://localhost:3000/signup and sign up with the email listed in `DEVELOPER_EMAILS` — that account becomes the developer (admin). Everyone else who signs up is a client awaiting approval.

### 4. Deploy to Vercel

Import the repo in Vercel, add the same environment variables (set `NEXT_PUBLIC_SITE_URL` to your Vercel URL), deploy, then add the Vercel URL to Supabase's Site URL / Redirect URLs.

## Notes

- **Security:** RLS is enabled on every table. Pages read with the user's session; all writes go through Server Actions that check role + ownership, then use the service-role key. Net earnings live in a separate developer-only table.
- **Files:** PDFs/images up to 4 MB, stored in a private bucket, downloaded via 10-minute signed URLs.
- **Multiple developers later:** every record already has a `developer_id`. Add more emails to `DEVELOPER_EMAILS` — each developer only sees their own clients and projects. (New self sign-ups are visible to every developer until one approves them; per-developer invite links would be the next step.)
- **Partial payments** aren't supported by design — one payment request per milestone. Split work into more milestones instead.
