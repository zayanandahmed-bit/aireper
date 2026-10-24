-- Daily cap for the website AI chat: one row per day, counted atomically so
-- every edge instance shares the same total. Private (RLS on, no policies).
create table if not exists daysback_chat_usage (
  day date primary key,
  messages int not null default 0
);
alter table daysback_chat_usage enable row level security;

create or replace function daysback_chat_take(cap int)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into daysback_chat_usage (day, messages) values ((now() at time zone 'Europe/London')::date, 1)
  on conflict (day) do update set messages = daysback_chat_usage.messages + 1
  returning messages into n;
  return n;   -- the caller refuses the message when n > cap
end $$;
revoke execute on function daysback_chat_take(int) from public, anon, authenticated;
