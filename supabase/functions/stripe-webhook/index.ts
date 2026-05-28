import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14.17.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
})

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') as string,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
  )
}

async function creditCheckoutSession(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id || session.metadata?.userId
  const amount = Number(session.metadata?.amount || 0)

  if (!session.id || !userId || !Number.isFinite(amount) || amount <= 0) {
    console.error('[PALCO stripe-webhook] Sessao sem dados suficientes', {
      sessionId: session.id,
      userId,
      amount,
    })
    return
  }

  const supabase = getSupabaseAdmin()
  const { error } = await supabase.rpc('credit_wallet_topup', {
    checkout_session_id: session.id,
    credit_amount: amount,
    target_profile_id: userId,
  })

  if (error) {
    console.error('[PALCO stripe-webhook] Erro ao creditar carteira', error)
    throw error
  }
}

function fromUnix(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const supabase = getSupabaseAdmin()
  const userId = subscription.metadata?.userId
  const planTier = subscription.metadata?.planTier || 'basic'

  if (!userId) {
    console.error('[PALCO stripe-webhook] Assinatura sem userId', subscription.id)
    return
  }

  const { error } = await supabase
    .from('subscriptions')
    .upsert(
      {
        profile_id: userId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: String(subscription.customer || ''),
        plan_tier: planTier,
        status: subscription.status,
        current_period_start: fromUnix(subscription.current_period_start),
        current_period_end: fromUnix(subscription.current_period_end),
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      },
      { onConflict: 'stripe_subscription_id' }
    )

  if (error) {
    console.error('[PALCO stripe-webhook] Erro ao sincronizar assinatura', error)
    throw error
  }
}

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('No signature', { status: 400 })

  const body = await req.text()
  let event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET') as string
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.payment_status === 'paid') {
        await creditCheckoutSession(session)
      }
    }

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object as Stripe.Subscription
      await syncSubscription(subscription)
    }
  } catch (err) {
    return new Response(JSON.stringify({ received: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
