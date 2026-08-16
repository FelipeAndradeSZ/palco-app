import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14.17.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
})

const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') as string

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function safeReturnPath(value: unknown) {
  if (typeof value !== 'string') return '/rooms'
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/rooms'
  return value
}

function getRedirectOrigin(req: Request) {
  const siteUrl = Deno.env.get('SITE_URL')
  if (!siteUrl) throw new Error('SITE_URL nao configurada no Supabase')

  const siteOrigin = new URL(siteUrl).origin
  const allowedOrigins = new Set([
    siteOrigin,
    ...(Deno.env.get('ALLOWED_ORIGINS') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => new URL(value).origin),
  ])
  const requestOrigin = req.headers.get('origin')

  return requestOrigin && allowedOrigins.has(requestOrigin) ? requestOrigin : siteOrigin
}

serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // SEGURANÇA: Verificar autenticação JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Usuário não autenticado')

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) throw new Error('Usuário não autenticado')

    const { amount, userId, returnTo } = await req.json()
    const checkoutAmount = Number(amount)
    const returnPath = safeReturnPath(returnTo)
    const origin = getRedirectOrigin(req)

    if (!checkoutAmount || !userId) {
      throw new Error('Amount and UserId are required')
    }

    // SEGURANÇA: O userId do body deve ser do próprio usuário autenticado
    if (userId !== authData.user.id) {
      throw new Error('Não é permitido criar recarga para outro usuário')
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
      client_reference_id: authData.user.id,
      metadata: {
        userId: authData.user.id,
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
