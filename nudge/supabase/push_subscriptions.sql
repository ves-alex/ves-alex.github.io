-- Push subscriptions table for Nudge daily reminders
create table public.push_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  reminder_time text not null default '09:00',
  timezone text not null default 'UTC',
  enabled boolean not null default true,
  last_sent_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "Users can view own subscriptions" on public.push_subscriptions
  for select using (auth.uid() = user_id);
create policy "Users can insert own subscriptions" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "Users can update own subscriptions" on public.push_subscriptions
  for update using (auth.uid() = user_id);
create policy "Users can delete own subscriptions" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;
