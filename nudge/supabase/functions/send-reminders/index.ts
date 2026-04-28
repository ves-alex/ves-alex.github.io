// Supabase Edge Function: send-reminders
// Triggered by pg_cron every minute. For each task whose due_at is now (within
// the catch-up window) and reminded_at is null, send a push to every enabled
// subscription belonging to that user, then mark reminded_at.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:alexves.tech@pm.me";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const TASK_CATCHUP_MIN = 15;

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
    return { ok: true as const };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", sub.user_id)
        .eq("endpoint", sub.endpoint);
    }
    return { ok: false as const, error: (e as Error).message ?? String(e) };
  }
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const errors: Array<{ scope: string; user_id?: string; task_id?: string; error: string }> = [];
  let sent = 0, skipped = 0;

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
    return new Response(
      JSON.stringify({ sent: 0, skipped: 0, errors: [{ scope: "tasks-query", error: tasksErr.message }] }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

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
        skipped++;
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
        else errors.push({ scope: "task-push", task_id: task.id, user_id: sub.user_id, error: res.error });
      }

      await supabase.from("tasks").update({ reminded_at: nowIso }).eq("id", task.id);
      if (anyOk) sent++; else skipped++;
    } catch (e) {
      errors.push({ scope: "task", task_id: task.id, error: (e as Error).message ?? String(e) });
    }
  }

  return new Response(
    JSON.stringify({ sent, skipped, errors }),
    { headers: { "content-type": "application/json" } },
  );
});
