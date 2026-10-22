-- HQ v2: richer page-view fields + shared settings (home tiles) for DaysBack HQ.
alter table daysback_pageviews add column if not exists kind text not null default 'view';  -- view | leave
alter table daysback_pageviews add column if not exists seconds int;                         -- time on page (leave rows)
alter table daysback_pageviews add column if not exists browser text not null default '';
alter table daysback_pageviews add column if not exists os text not null default '';
alter table daysback_pageviews add column if not exists tz text not null default '';        -- visitor time zone (location, no IP)
alter table daysback_pageviews add column if not exists campaign text not null default '';  -- utm_source / utm_campaign

create table if not exists daysback_hq (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table daysback_hq enable row level security;

create or replace function daysback_stats(days int default 30)
returns json language sql stable security definer set search_path = public as $$
  with
  cur as (select * from daysback_pageviews where created_at > now() - make_interval(days => days)),
  prev as (select * from daysback_pageviews where created_at <= now() - make_interval(days => days)
                                             and created_at > now() - make_interval(days => days * 2)),
  cv as (select * from cur where kind = 'view'),
  pv as (select * from prev where kind = 'view'),
  -- one row per visitor-day
  sess as (select visitor_hash, created_at::date d, count(*) n, min(created_at) first_at,
                  (array_agg(path order by created_at))[1] entry,
                  (array_agg(coalesce(nullif(campaign,''), nullif(referrer,''), 'Direct') order by created_at))[1] source,
                  max(tz) tz, max(device) device, max(browser) browser, max(os) os
           from cv group by 1, 2),
  psess as (select visitor_hash, created_at::date d, count(*) n from pv group by 1, 2),
  lv as (select path, least(seconds, 1800) s from cur where kind = 'leave' and seconds between 1 and 7200),
  plv as (select least(seconds, 1800) s from prev where kind = 'leave' and seconds between 1 and 7200)
  select json_build_object(
    'days', days,
    'live', (select count(distinct visitor_hash) from daysback_pageviews where created_at > now() - interval '5 minutes'),
    'today_visitors', (select count(distinct visitor_hash) from cv where created_at::date = now()::date),
    'cur', json_build_object(
      'visitors', (select count(*) from sess),
      'views', (select count(*) from cv),
      'enquiries', (select count(*) from daysback_enquiries where created_at > now() - make_interval(days => days)),
      'avg_seconds', (select coalesce(round(avg(s)), 0) from lv),
      'bounce', (select coalesce(round(100.0 * count(*) filter (where n = 1) / nullif(count(*), 0)), 0) from sess),
      'pages_per_visit', (select coalesce(round(avg(n)::numeric, 1), 0) from sess)),
    'prev', json_build_object(
      'visitors', (select count(*) from psess),
      'views', (select count(*) from pv),
      'enquiries', (select count(*) from daysback_enquiries where created_at <= now() - make_interval(days => days)
                                                               and created_at > now() - make_interval(days => days * 2)),
      'avg_seconds', (select coalesce(round(avg(s)), 0) from plv),
      'bounce', (select coalesce(round(100.0 * count(*) filter (where n = 1) / nullif(count(*), 0)), 0) from psess),
      'pages_per_visit', (select coalesce(round(avg(n)::numeric, 1), 0) from psess)),
    'by_day', (select coalesce(json_agg(x order by x.day), '[]') from (
        select created_at::date as day, count(*) as views, count(distinct visitor_hash) as visitors from cv group by 1) x),
    'by_hour', (select coalesce(json_agg(x order by x.hour), '[]') from (
        select extract(hour from created_at at time zone 'Europe/London')::int as hour, count(*) as views,
               count(distinct visitor_hash) as visitors
        from cv where created_at > now() - interval '24 hours' group by 1) x),
    'pages', (select coalesce(json_agg(x), '[]') from (
        select v.path, count(*) as views, count(distinct v.visitor_hash || v.created_at::date) as visitors,
               (select round(avg(s)) from lv where lv.path = v.path) as avg_seconds
        from cv v group by v.path order by 2 desc limit 12) x),
    'entries', (select coalesce(json_agg(x), '[]') from (
        select entry as path, count(*) as visitors from sess group by 1 order by 2 desc limit 8) x),
    'sources', (select coalesce(json_agg(x), '[]') from (
        select source, count(*) as visitors from sess group by 1 order by 2 desc limit 10) x),
    'locations', (select coalesce(json_agg(x), '[]') from (
        select coalesce(nullif(tz, ''), 'Unknown') as tz, count(*) as visitors from sess group by 1 order by 2 desc limit 10) x),
    'devices', (select coalesce(json_agg(x), '[]') from (
        select device as name, count(*) as visitors from sess group by 1 order by 2 desc) x),
    'browsers', (select coalesce(json_agg(x), '[]') from (
        select coalesce(nullif(browser, ''), 'Other') as name, count(*) as visitors from sess group by 1 order by 2 desc limit 6) x),
    'systems', (select coalesce(json_agg(x), '[]') from (
        select coalesce(nullif(os, ''), 'Other') as name, count(*) as visitors from sess group by 1 order by 2 desc limit 6) x),
    'funnel', json_build_array(
        json_build_object('step', 'Visited the site', 'n', (select count(*) from sess)),
        json_build_object('step', 'Viewed Services', 'n', (select count(distinct visitor_hash || created_at::date) from cv where path like '/services%')),
        json_build_object('step', 'Opened Contact', 'n', (select count(distinct visitor_hash || created_at::date) from cv where path like '/contact%')),
        json_build_object('step', 'Sent an enquiry', 'n', (select count(*) from daysback_enquiries where created_at > now() - make_interval(days => days))))
  );
$$;
revoke execute on function daysback_stats(int) from public, anon, authenticated;
