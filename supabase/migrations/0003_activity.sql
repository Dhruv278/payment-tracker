-- Activity history: one row per event on a project (the money trail).
-- Rows carry their own title/amount so they survive invoice cancellation.
-- client_visible = false rows (e.g. what the developer actually received)
-- are never readable by the client.

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  developer_id uuid not null references public.profiles (id) on delete cascade,
  payment_request_id uuid references public.payment_requests (id) on delete set null,
  -- A deleted note takes its "note added" event with it.
  note_id uuid references public.project_notes (id) on delete cascade,
  kind text not null check (kind in (
    'project_created', 'project_status', 'project_price',
    'invoice_sent', 'invoice_reminder', 'invoice_cancelled',
    'proof_submitted', 'proof_rejected', 'payment_verified',
    'earning_recorded', 'earning_updated',
    'note_added'
  )),
  client_visible boolean not null default true,
  title text,
  amount numeric(12, 2),
  currency char(3),
  detail text,
  created_at timestamptz not null default now()
);

create index activity_project_idx on public.activity (project_id, created_at desc);
create index activity_developer_idx on public.activity (developer_id, created_at desc);
create index activity_request_idx on public.activity (payment_request_id);

-- Reads only; rows are written by server actions with the service-role key.
alter table public.activity enable row level security;

create policy "activity: developer" on public.activity
  for select using (developer_id = auth.uid());

create policy "activity: client" on public.activity
  for select using (
    client_visible
    and public.is_approved_client()
    and exists (
      select 1 from public.projects p
      where p.id = activity.project_id and p.client_id = auth.uid()
    )
  );
