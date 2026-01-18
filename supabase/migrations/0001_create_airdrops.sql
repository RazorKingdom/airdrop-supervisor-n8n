create extension if not exists "uuid-ossp";

create table if not exists public.airdrops (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text not null,
  source_url text not null,
  project_url text not null,
  tags text[] not null default '{}',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists airdrops_project_url_unique on public.airdrops (project_url);
create index if not exists airdrops_created_at_idx on public.airdrops (created_at desc);
create index if not exists airdrops_tags_gin on public.airdrops using gin (tags);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_airdrops_updated_at on public.airdrops;
create trigger set_airdrops_updated_at
before update on public.airdrops
for each row execute function public.set_updated_at();
