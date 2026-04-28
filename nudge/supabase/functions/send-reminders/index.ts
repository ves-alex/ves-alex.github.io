// Supabase Edge Function: send-reminders
// Triggered by pg_cron every minute. Two pass:
//  - daily reminders: each enabled subscription whose local time matches reminder_time
//  - per-task reminders: tasks whose due_at is now and reminded_at is null

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:alexves.tech@pm.me";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const DAILY_TOLERANCE_MIN = 1;
const TASK_CATCHUP_MIN = 15;

function localParts(timezone: string) {
  const now = new Date();
  const time = now.toLocaleTimeString("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false });
  const date = now.toLocaleDateString("en-CA", { timeZone: timezone });
  return { time, date };
}

type SupabaseClient = ReturnType<typeof createClient>;

async function pushToSubscription(
  supabase: SupabaseClient,
  sub: { endpoint: string; p256dh: string; auth: string; user_id: string },
  payload: string,
) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
    );
    return { ok: true };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", sub.user_id)
        .eq("endpoint", sub.endpoint);
    }
    return { ok: false, error: (e as Error).message ?? String(e) };
  }
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const errors: Array<{ scope: string; user_id?: string; task_id?: string; error: string }> = [];
  let dailySent = 0, dailySkipped = 0;
  let taskSent = 0, taskSkipped = 0;

  // ---- DAILY REMINDERS ----
  const { data: subs, error: subsErr } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("enabled", true);

  if (subsErr) {
    errors.push({ scope: "subs-query", error: subsErr.message });
  } else {
    for (const sub of subs ?? []) {
      try {
        const { time: localTime, date: localDate } = localParts(sub.timezone || "UTC");
        const [lh, lm] = localTime.split(":").map(Number);
        const [rh, rm] = (sub.reminder_time || "09:00").split(":").map(Number);
        const diff = Math.abs((lh * 60 + lm) - (rh * 60 + rm));

        if (diff > DAILY_TOLERANCE_MIN) { dailySkipped++; continue; }
        if (sub.last_sent_date === localDate) { dailySkipped++; continue; }

        const payload = JSON.stringify({
          title: "Nudge",
          body: "C'est l'heure de ta prochaine action.",
          url: "./",
        });
        const res = await pushToSubscription(supabase, sub, payload);
        if (res.ok) {
          await supabase
            .from("push_subscriptions")
            .update({ last_sent_date: localDate })
            .eq("user_id", sub.user_id)
            .eq("endpoint", sub.endpoint);
          dailySent++;
        } else {
          errors.push({ scope: "daily", user_id: sub.user_id, error: res.error! });
        }
      } catch (e) {
        errors.push({ scope: "daily", user_id: sub.user_id, error: (e as Error).message ?? String(e) });
      }
    }
  }

  // ---- PER-TASK REMINDERS ----
  const nowIso = new Date().toISOString();
  const catchupIso = new Date(Date.now() - TASK_CATCHUP_MIN * 60 * 1000).toISOString();

  const { data: tasks, error: tasksErr } = await supabase
    .from("tasks")
    .select("id, name, user_id, due_at")
    .is("reminded_at", null)
    .is("completed_at", null)
    .not("due_at", "is", null)
    .lte("due_at", nowIso)
    .gte("due_at", catchupIso);

  if (tasksErr) {
    errors.push({ scope: "tasks-query", error: tasksErr.message });
  } else {
    for (const task of tasks ?? []) {
      try {
        const { data: userSubs, error: usErr } = await supabase
          .from("push_subscriptions")
          .select("*")
          .eq("user_id", task.user_id)
          .eq("enabled", true);
        if (usErr) {
          errors.push({ scope: "task-subs", task_id: task.id, error: usErr.message });
          continue;
        }
        if (!userSubs || userSubs.length === 0) {
          taskSkipped++;
          await supabase.from("tasks").update({ reminded_at: nowIso }).eq("id", task.id);
          continue;
        }

        const payload = JSON.stringify({
          title: "Nudge — rappel",
          body: task.name,
          url: "./",
        });

        let anyOk = false;
        for (const sub of userSubs) {
          const res = await pushToSubscription(supabase, sub, payload);
          if (res.ok) anyOk = true;
          else errors.push({ scope: "task-push", task_id: task.id, user_id: sub.user_id, error: res.error! });
        }

        await supabase.from("tasks").update({ reminded_at: nowIso }).eq("id", task.id);
        if (anyOk) taskSent++; else taskSkipped++;
      } catch (e) {
        errors.push({ scope: "task", task_id: task.id, error: (e as Error).message ?? String(e) });
      }
    }
  }

  return new Response(
    JSON.stringify({
      daily: { sent: dailySent, skipped: dailySkipped },
      tasks: { sent: taskSent, skipped: taskSkipped },
      errors,
    }),
    { headers: { "content-type": "application/json" } },
  );
});
