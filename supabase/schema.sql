create table if not exists public.league_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.league_state enable row level security;

revoke all on table public.league_state from anon, authenticated;
grant select on table public.league_state to anon, authenticated;
grant insert, update on table public.league_state to authenticated;

drop policy if exists "league state is public" on public.league_state;
create policy "league state is public"
on public.league_state
for select
to anon, authenticated
using (id = 'main');

drop policy if exists "admins can create league state" on public.league_state;
create policy "admins can create league state"
on public.league_state
for insert
to authenticated
with check (id = 'main');

drop policy if exists "admins can update league state" on public.league_state;
create policy "admins can update league state"
on public.league_state
for update
to authenticated
using (id = 'main')
with check (id = 'main');
