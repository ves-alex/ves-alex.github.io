// Supabase Edge Function: send-reminders
// Triggered by pg_cron every 15 minutes. Sends a push to each enabled subscription
// whose local time matches reminder_time (within +/- 7 minutes), once per local day.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:veslin.alex@gmail.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const TOLERANCE_MIN = 7;

function localParts(timezone: string) {
  const now = new Date();
  const time = now.toLocaleTimeString("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false });
  const date = now.toLocaleDateString("en-CA", { timeZone: timezone });
  return { time, date };
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("enabled", true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  let sent = 0;
  let skipped = 0;
  const errors: Array<{ user_id: string; error: string }> = [];

  for (const sub of subs ?? []) {
    try {
      const { time: localTime, date: localDate } = localParts(sub.timezone || "UTC");
      const [lh, lm] = localTime.split(":").map(Number);
      const [rh, rm] = (sub.reminder_time || "09:00").split(":").map(Number);
      const localTotal = lh * 60 + lm;
      const reminderTotal = rh * 60 + rm;
      const diff = Math.abs(localTotal - reminderTotal);

      if (diff > TOLERANCE_MIN) {
        skipped++;
        continue;
      }
      if (sub.last_sent_date === localDate) {
        skipped++;
        continue;
      }

      const payload = JSON.stringify({
        title: "Nudge",
        body: "C'est l'heure de ta prochaine action.",
        url: "./",
      });

      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      );

      await supabase
        .from("push_subscriptions")
        .update({ last_sent_date: localDate })
        .eq("user_id", sub.user_id)
        .eq("endpoint", sub.endpoint);

      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", sub.user_id)
          .eq("endpoint", sub.endpoint);
      }
      errors.push({ user_id: sub.user_id, error: (e as Error).message ?? String(e) });
    }
  }

  return new Response(
    JSON.stringify({ sent, skipped, errors }),
    { headers: { "content-type": "application/json" } },
  );
});
