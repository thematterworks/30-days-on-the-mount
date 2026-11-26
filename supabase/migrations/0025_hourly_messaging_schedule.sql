-- The hourly driver for the messaging crons, run by the database itself
-- (pg_cron + pg_net) instead of GitHub's scheduler, which had silently
-- stopped firing (no runs after 2026-11-01) and often skipped hours before.
--
-- Each run calls the four endpoints; every one picks its recipients by their
-- own local hour, so this must run exactly once an hour.
--
-- Needs the cron password in Vault first (never commit it):
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
-- It must match CRON_SECRET in the Vercel production environment.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.run_scheduled_messaging() returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base text := 'https://www.30daysonthemount.com/api/cron/';
  auth jsonb;
  endpoint text;
begin
  select jsonb_build_object('Authorization', 'Bearer ' || decrypted_secret)
    into auth
    from vault.decrypted_secrets
   where name = 'cron_secret';
  if auth is null then
    raise warning 'run_scheduled_messaging: no cron_secret in vault';
    return;
  end if;
  foreach endpoint in array array['daily-push', 'evening-checkin', 'midday', 'walking-groups'] loop
    perform net.http_get(url := base || endpoint, headers := auth, timeout_milliseconds := 300000);
  end loop;
end;
$$;

revoke all on function public.run_scheduled_messaging() from public, anon, authenticated;

-- Top of every hour, UTC.
select cron.unschedule('scheduled-messaging') where exists (select 1 from cron.job where jobname = 'scheduled-messaging');
select cron.schedule('scheduled-messaging', '0 * * * *', 'select public.run_scheduled_messaging()');
