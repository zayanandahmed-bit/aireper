-- Summary for the DaysBack Mail tool's Stats tab. Only callable with the
-- service key (execute revoked from public roles).
create or replace function daysback_stats(days int default 30)
returns json language sql stable security definer set search_path = public as $$
  with v as (select * from daysback_pageviews where created_at > now() - make_interval(days => days))
  select json_build_object(
    'views', (select count(*) from v),
    'visitors', (select count(distinct visitor_hash || created_at::date) from v),
    'today_views', (select count(*) from v where created_at::date = now()::date),
    'today_visitors', (select count(distinct visitor_hash) from v where created_at::date = now()::date),
    'enquiries', (select count(*) from daysback_enquiries where created_at > now() - make_interval(days => days)),
    'by_day', (select coalesce(json_agg(d order by d.day), '[]') from (
        select created_at::date as day, count(*) as views, count(distinct visitor_hash) as visitors from v group by 1) d),
    'pages', (select coalesce(json_agg(p), '[]') from (
        select path, count(*) as views from v group by 1 order by 2 desc limit 10) p),
    'sources', (select coalesce(json_agg(s), '[]') from (
        select coalesce(nullif(referrer, ''), 'Direct') as source, count(distinct visitor_hash || created_at::date) as visitors
        from v group by 1 order by 2 desc limit 10) s),
    'devices', (select coalesce(json_agg(x), '[]') from (
        select device, count(distinct visitor_hash || created_at::date) as visitors from v group by 1 order by 2 desc) x)
  );
$$;
revoke execute on function daysback_stats(int) from public, anon, authenticated;
