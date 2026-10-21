-- Address book for the DaysBack Mail tool. Private: RLS on, no policies, so
-- only the daysback-compose function (service key) can read or write it.
create table if not exists daysback_contacts (
  email text primary key,
  name text not null default '',
  source text not null default 'import',
  created_at timestamptz not null default now()
);
alter table daysback_contacts enable row level security;
