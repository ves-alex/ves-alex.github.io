-- Schedule send-reminders edge function every minute.
-- Run AFTER the function is deployed and `verify_jwt` is disabled on it
-- (Edge Functions → send-reminders → Details → Verify JWT off).
-- The cron sends no Authorization header, which is fine because the function
-- has verify_jwt off and uses SERVICE_ROLE_KEY internally for DB access.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- If a previous schedule exists, remove it first:
-- select cron.unschedule('nudge-send-reminders');

select cron.schedule(
  'nudge-send-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://dhmthosilfhudzygmsst.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- To inspect / debug:
-- select * from cron.job;
-- select * from cron.job_run_details order by start_time desc limit 10;
-- select id, status_code, content from net._http_response order by id desc limit 5;
