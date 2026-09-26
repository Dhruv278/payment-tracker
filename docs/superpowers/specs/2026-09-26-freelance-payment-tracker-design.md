# Freelance Payment Tracker — Design

## Purpose

A personal web app for a freelance developer to track client payments per
project and milestone. Payments arrive via Wise, but today there is no record
linking a Wise transfer to a project/milestone. The app provides that ledger
plus a client portal where clients see what they owe and upload proof of
payment.

Success: for any client, project, or date range the developer can see billed
amount, paid amount, outstanding amount, and their own private net earnings.

## Decisions

| Topic | Decision |
|---|---|
| Stack | Next.js 16 (App Router, Server Actions), TypeScript, Tailwind v4 |
| Hosting | Vercel |
| Data / Auth / Files | Supabase Postgres, Supabase Auth, Supabase Storage (private bucket) |
| Email | Nodemailer via Gmail app password (app notifications). Supabase Auth emails use the same Gmail as custom SMTP. |
| Tenancy | Single developer today; every business row carries `developer_id` so more developers can be added later (option C). |
| Developer accounts | Emails listed in `DEVELOPER_EMAILS` env are promoted to `developer` + `approved` on sign-in. Everyone else is a `client`. |
| Client onboarding | Clients self sign-up → `pending` → developer approves/rejects. Developer can also invite a client by email (pre-approved). |
| Currency | Each project has one currency (default USD). Milestones and payment requests use it. No conversion anywhere. |
| Net received | On verification the developer records a private net amount in any currency (e.g. ₹36,000 or $350) + note. Never visible to clients. |
| Partial payments | Not supported. One payment request = one full milestone. Split work into more milestones instead. |
| Wise | No API integration. Developer attaches a Wise payment link and/or invoice PDF to a payment request. |

## Data model

- `profiles` — `id` (= auth user), `email`, `full_name`, `company`, `role`
  (`developer`|`client`), `status` (`pending`|`approved`|`rejected`),
  `developer_id` (client's owning developer), timestamps.
- `projects` — `developer_id`, `client_id`, `name`, `description`,
  `currency`, `total_amount`, `status` (`active`|`on_hold`|`completed`|`cancelled`),
  `start_date`, `end_date`.
- `milestones` — `project_id`, `developer_id`, `title`, `description`,
  `amount`, `due_date`, `position`.
- `payment_requests` — one per milestone (unique `milestone_id`):
  `amount`, `currency` (copied from project), `wise_link`, `invoice_path`,
  `message`, `status` (`requested`|`proof_submitted`|`verified`),
  client proof fields (`client_paid_on`, `client_reference`, `client_note`,
  `proof_path`, `proof_submitted_at`), `rejection_reason`, `verified_at`.
- `payment_earnings` — private, developer-only: `payment_request_id`,
  `net_amount`, `net_currency`, `received_on`, `note`.

Milestone status is derived, not stored:
no request → **Pending**; request `requested` → **Payment requested**;
`proof_submitted` → **Proof submitted**; `verified` → **Paid**.

## Security

- RLS enabled on every table. Reads use the signed-in user's session:
  developers see rows where `developer_id = auth.uid()`; approved clients see
  their own projects, milestones, payment requests. `payment_earnings` has a
  developer-only policy, so clients can never read net amounts.
- All writes go through Server Actions that authenticate, authorise
  (role + ownership) and then write with the service-role client.
- Files live in a private `documents` bucket; downloads use short-lived
  signed URLs generated after an authorisation check. PDFs/images ≤ 4 MB.

## Flows

1. **Sign up** (client) → confirm email → pending screen → developer gets email.
2. **Approve** → client gets email → client sees portal.
3. **Project** → developer creates project for a client with total + currency.
4. **Milestones** → developer adds milestones (warning if sum exceeds total).
5. **Request payment** → pick milestone, add Wise link / invoice PDF / message
   → client emailed.
6. **Submit proof** → client enters paid date, Wise reference, note, uploads
   PDF → developer emailed.
7. **Verify** → developer enters private net received (amount + currency +
   date + note) → milestone Paid → client emailed. Or **reject proof** with a
   reason → back to `requested` → client emailed.

## Screens

Developer: Dashboard, Clients (approve/reject/invite), Client detail,
Projects, New/Edit project, Project detail (milestones, requests, progress),
Payments (filter by status), Payment detail (verify/reject), Reports
(filters: client, project, date range; totals per currency; CSV export).

Client: Portal (projects + payments needing action), Project detail,
Payment detail (Wise link, invoice, submit proof).

Shared: Login, Sign up, Forgot/Update password, Pending approval.

## Reports

Filter verified payments by client, project and `verified_at` range.
Show: billed total per currency, net earned per currency, per-client and
per-project breakdown, row list, CSV export. Currencies are never summed
together.

## Out of scope (v1)

Wise API sync, exchange rates, partial payments, multi-developer signup UI,
recurring invoices, generated invoice PDFs.
