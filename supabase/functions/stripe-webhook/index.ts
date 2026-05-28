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
    target_profile_id: userId,
    credit_amount: amount,
  })

  if (error) {
    console.error('[PALCO stripe-webhook] Erro ao creditar carteira', error)
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
