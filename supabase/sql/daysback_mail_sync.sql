-- Where the mail tool's contact scan got to in each mailbox folder, so every
-- open only reads new mail after the first full scan. Private (RLS, no policies).
create table if not exists daysback_mail_sync (
  box text not null,
  folder text not null,
  uidvalidity bigint not null default 0,
  last_uid bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (box, folder)
);
alter table daysback_mail_sync enable row level security;
