-- Messages sent through the website's contact form.
-- Row level security is on with no policies, so the public site key can't
-- read or write this table at all; only the daysback-enquiry function (which
-- uses the project's service key) can add rows. Read them in the Supabase
-- dashboard under Table Editor.
create table if not exists daysback_enquiries (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  email       text not null,
  company     text not null default '',
  interest    text not null default '',
  page        text not null default '',
  emailed     boolean not null default false
);
alter table daysback_enquiries enable row level security;
create index if not exists daysback_enquiries_created_at on daysback_enquiries (created_at desc);
