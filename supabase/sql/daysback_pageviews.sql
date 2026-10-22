-- Cookie-free visitor stats for daysback.si. No IPs stored: visitor_hash is a
-- salted hash of IP + browser + date, so a visitor can be counted once per day
-- but not tracked across days. Private (RLS on, no policies).
create table if not exists daysback_pageviews (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  path text not null,
  referrer text not null default '',
  device text not null default '',
  visitor_hash text not null default ''
);
create index if not exists daysback_pageviews_created on daysback_pageviews (created_at);
alter table daysback_pageviews enable row level security;
