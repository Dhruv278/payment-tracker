-- Freelance Payment Tracker: initial schema
-- Run in Supabase SQL editor (or `supabase db push`).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  company text,
  role text not null default 'client' check (role in ('developer', 'client')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  developer_id uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index profiles_developer_idx on public.profiles (developer_id);

-- Create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, company)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'company', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers used by RLS policies (security definer avoids recursive RLS).
create or replace function public.is_developer()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'developer' and status = 'approved'
  );
$$;

create or replace function public.is_approved_client()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'client' and status = 'approved'
  );
$$;

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete restrict,
  name text not null,
  description text,
  currency char(3) not null default 'USD',
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  status text not null default 'active'
    check (status in ('active', 'on_hold', 'completed', 'cancelled')),
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_developer_idx on public.projects (developer_id);
create index projects_client_idx on public.projects (client_id);

-- ---------------------------------------------------------------------------
-- Milestones (status is derived from payment_requests)
-- ---------------------------------------------------------------------------
create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  developer_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  amount numeric(12, 2) not null check (amount > 0),
  due_date date,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index milestones_project_idx on public.milestones (project_id);

-- ---------------------------------------------------------------------------
-- Payment requests (one per milestone)
-- ---------------------------------------------------------------------------
create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null unique references public.milestones (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  developer_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  currency char(3) not null,
  wise_link text,
  invoice_path text,
  message text,
  status text not null default 'requested'
    check (status in ('requested', 'proof_submitted', 'verified')),
  requested_at timestamptz not null default now(),
  client_paid_on date,
  client_reference text,
  client_note text,
  proof_path text,
  proof_submitted_at timestamptz,
  rejection_reason text,
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

create index payment_requests_developer_idx on public.payment_requests (developer_id, status);
create index payment_requests_client_idx on public.payment_requests (client_id, status);
create index payment_requests_verified_idx on public.payment_requests (developer_id, verified_at);

-- ---------------------------------------------------------------------------
-- Private earnings (developer only — never exposed to clients)
-- ---------------------------------------------------------------------------
create table public.payment_earnings (
  payment_request_id uuid primary key references public.payment_requests (id) on delete cascade,
  developer_id uuid not null references public.profiles (id) on delete cascade,
  net_amount numeric(12, 2) not null check (net_amount >= 0),
  net_currency char(3) not null,
  received_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index payment_earnings_developer_idx on public.payment_earnings (developer_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Reads use the user's session; all writes happen server-side with the
-- service-role key after explicit authorisation checks, so there are no
-- insert/update/delete policies.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.payment_requests enable row level security;
alter table public.payment_earnings enable row level security;

create policy "profiles: read own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles: developer reads own clients and unassigned signups" on public.profiles
  for select using (
    public.is_developer()
    and role = 'client'
    and (developer_id = auth.uid() or developer_id is null)
  );

create policy "projects: developer" on public.projects
  for select using (developer_id = auth.uid());

create policy "projects: client" on public.projects
  for select using (client_id = auth.uid() and public.is_approved_client());

create policy "milestones: developer" on public.milestones
  for select using (developer_id = auth.uid());

create policy "milestones: client" on public.milestones
  for select using (
    public.is_approved_client()
    and exists (
      select 1 from public.projects p
      where p.id = milestones.project_id and p.client_id = auth.uid()
    )
  );

create policy "payment_requests: developer" on public.payment_requests
  for select using (developer_id = auth.uid());

create policy "payment_requests: client" on public.payment_requests
  for select using (client_id = auth.uid() and public.is_approved_client());

create policy "payment_earnings: developer only" on public.payment_earnings
  for select using (developer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: private bucket, accessed only via server-generated signed URLs
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  4194304,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;
