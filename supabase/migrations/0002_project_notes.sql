-- Project notes: written by the developer, visible to the developer and the
-- project's client (meeting summaries, progress updates).

create table public.project_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  developer_id uuid not null references public.profiles (id) on delete cascade,
  title text check (char_length(title) <= 160),
  body text not null check (char_length(body) between 1 and 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_notes_project_idx on public.project_notes (project_id, created_at desc);

-- Reads only; writes go through server actions with the service-role key.
alter table public.project_notes enable row level security;

create policy "project_notes: developer" on public.project_notes
  for select using (developer_id = auth.uid());

create policy "project_notes: client" on public.project_notes
  for select using (
    public.is_approved_client()
    and exists (
      select 1 from public.projects p
      where p.id = project_notes.project_id and p.client_id = auth.uid()
    )
  );
