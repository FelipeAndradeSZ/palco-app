-- Stripe recurring subscriptions for venue ambiente plans.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  stripe_subscription_id text unique,
  stripe_customer_id text,
  stripe_checkout_session_id text unique,
  plan_tier text not null default 'basic' check (plan_tier in ('basic', 'premium')),
  status text not null default 'incomplete'
    check (status in ('active', 'trialing', 'canceled', 'past_due', 'incomplete', 'incomplete_expired', 'unpaid')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_profile_idx on public.subscriptions (profile_id, status);
create index if not exists subscriptions_stripe_subscription_idx on public.subscriptions (stripe_subscription_id);
create index if not exists subscriptions_stripe_customer_idx on public.subscriptions (stripe_customer_id);

alter table public.subscriptions enable row level security;

drop policy if exists "Users can read own subscriptions" on public.subscriptions;
create policy "Users can read own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = profile_id);

drop trigger if exists tr_subscriptions_touch_updated_at on public.subscriptions;
create trigger tr_subscriptions_touch_updated_at
  before update on public.subscriptions
  for each row execute function public.touch_updated_at();

notify pgrst, 'reload schema';
