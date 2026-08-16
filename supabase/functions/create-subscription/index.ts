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
  if (typeof value !== 'string') return '/tv'
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/tv'
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

function priceForPlan(planTier: string) {
  if (planTier === 'premium') return Deno.env.get('STRIPE_PREMIUM_PRICE_ID')
  return Deno.env.get('STRIPE_BASIC_PRICE_ID')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Usuario nao autenticado')

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) throw new Error('Usuario nao autenticado')

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single()

    if (profileError || profile?.role !== 'venue') {
      throw new Error('Apenas estabelecimentos podem assinar o Plano Ambiente')
    }

    const { planTier = 'basic', returnTo } = await req.json()
    if (!['basic', 'premium'].includes(planTier)) throw new Error('Plano invalido')

    const priceId = priceForPlan(planTier)
    if (!priceId) throw new Error(`Preco Stripe nao configurado para o plano ${planTier}`)

    const returnPath = safeReturnPath(returnTo)
    const origin = getRedirectOrigin(req)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}${returnPath}${returnPath.includes('?') ? '&' : '?'}subscription=success`,
      cancel_url: `${origin}${returnPath}${returnPath.includes('?') ? '&' : '?'}subscription=cancel`,
      client_reference_id: authData.user.id,
      customer_email: authData.user.email || undefined,
      metadata: {
        userId: authData.user.id,
        planTier,
      },
      subscription_data: {
        metadata: {
          userId: authData.user.id,
          planTier,
        },
      },
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
