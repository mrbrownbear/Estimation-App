-- Run this in Supabase SQL Editor
create extension if not exists pgcrypto;

create table if not exists public.app_estimates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  local_estimate_id text not null,
  title text,
  client_name text,
  primary_event_date date,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, local_estimate_id)
);

create index if not exists idx_app_estimates_owner_updated
  on public.app_estimates(owner_id, updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_app_estimates_updated_at on public.app_estimates;
create trigger trg_app_estimates_updated_at
before update on public.app_estimates
for each row execute function public.set_updated_at();

alter table public.app_estimates enable row level security;

drop policy if exists "Users can read own estimates" on public.app_estimates;
create policy "Users can read own estimates"
  on public.app_estimates
  for select
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "Users can insert own estimates" on public.app_estimates;
create policy "Users can insert own estimates"
  on public.app_estimates
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "Users can update own estimates" on public.app_estimates;
create policy "Users can update own estimates"
  on public.app_estimates
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Users can delete own estimates" on public.app_estimates;
create policy "Users can delete own estimates"
  on public.app_estimates
  for delete
  to authenticated
  using (auth.uid() = owner_id);

-- Optional future tables if you want reporting later without parsing jsonb.
create table if not exists public.app_contract_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  template_name text not null,
  page_1_terms text,
  page_3_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_contract_templates enable row level security;

drop trigger if exists trg_app_contract_templates_updated_at on public.app_contract_templates;
create trigger trg_app_contract_templates_updated_at
before update on public.app_contract_templates
for each row execute function public.set_updated_at();

drop policy if exists "Users can manage own contract templates" on public.app_contract_templates;
create policy "Users can manage own contract templates"
  on public.app_contract_templates
  for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
