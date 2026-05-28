import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14.17.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
})

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
    console.error(`Webhook signature verif failed:`, err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  // Se o pagamento for confirmado
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const userId = session.client_reference_id
    const amount = Number(session.metadata.amount)

    // Usa a Service Role Key para ignorar RLS e forçar a atualização do saldo
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') as string,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
    )

    // Busca saldo atual
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('profile_id', userId)
      .single()

    if (wallet) {
      await supabase
        .from('wallets')
        .update({ balance: wallet.balance + amount })
        .eq('profile_id', userId)
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
