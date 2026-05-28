import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14.17.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function safeReturnPath(value: unknown) {
  if (typeof value !== 'string') return '/rooms'
  if (!value.startsWith('/') || value.startsWith('//')) return '/rooms'
  return value
}

serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { amount, userId, returnTo } = await req.json()
    const checkoutAmount = Number(amount)
    const returnPath = safeReturnPath(returnTo)
    const origin = req.headers.get('origin') || Deno.env.get('SITE_URL') || 'http://localhost:5173'

    if (!checkoutAmount || !userId) {
      throw new Error('Amount and UserId are required')
    }

    if (!Number.isFinite(checkoutAmount) || checkoutAmount < 5 || checkoutAmount > 5000) {
      throw new Error('Amount must be between R$ 5 and R$ 5000')
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: 'Adicionar Saldo no PALCO',
              description: 'Compre saldo para enviar gorjetas e pedir músicas',
            },
            unit_amount: Math.round(checkoutAmount * 100), // Stripe lida com centavos
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/wallet/return?session_id={CHECKOUT_SESSION_ID}&return_to=${encodeURIComponent(returnPath)}`,
      cancel_url: `${origin}${returnPath}${returnPath.includes('?') ? '&' : '?'}checkout=cancel`,
      client_reference_id: userId,
      metadata: {
        userId: userId,
        amount: checkoutAmount.toString(),
        returnTo: returnPath
      }
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
