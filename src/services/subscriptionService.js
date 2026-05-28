import { supabase } from '../lib/supabase';

export async function getActiveSubscription(profileId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('profile_id', profileId)
    .in('status', ['active', 'trialing', 'past_due', 'incomplete'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return { data, error };
}

export async function createSubscriptionCheckout(planTier, returnTo = '/tv') {
  const { data, error } = await supabase.functions.invoke('create-subscription', {
    body: { planTier, returnTo },
  });

  if (error) throw error;
  if (!data?.url) throw new Error('Checkout de assinatura nao retornou URL.');

  window.location.href = data.url;
}
