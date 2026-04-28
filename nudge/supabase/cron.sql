-- Schedule send-reminders edge function every 15 minutes
-- Run AFTER the function is deployed and secrets are set.
-- Replace <ANON_OR_SERVICE_KEY> with your project's anon key
-- (or use vault.create_secret for production-grade secret storage).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'nudge-send-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://dhmthosilfhudzygmsst.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_OR_SERVICE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To inspect / debug:
-- select * from cron.job;
-- select * from cron.job_run_details order by start_time desc limit 10;
-- To unschedule: select cron.unschedule('nudge-send-reminders');
