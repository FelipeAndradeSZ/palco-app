import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14.17.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { assertAllowedOrigin, corsHeaders, errorResponse, HttpError, jsonResponse } from '../_shared/http.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
})

const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') as string

function safeReturnPath(value: unknown) {
  if (typeof value !== 'string') return '/tv'
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/tv'
  return value
}

function priceForPlan(planTier: string) {
  if (planTier === 'premium') return Deno.env.get('STRIPE_PREMIUM_PRICE_ID')
  return Deno.env.get('STRIPE_BASIC_PRICE_ID')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    try {
      assertAllowedOrigin(req)
      return new Response('ok', { headers: corsHeaders(req) })
    } catch (error) {
      return errorResponse(req, error)
    }
  }

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Metodo nao permitido')
    const origin = assertAllowedOrigin(req)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new HttpError(401, 'Usuario nao autenticado')

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) throw new HttpError(401, 'Usuario nao autenticado')

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single()

    if (profileError || profile?.role !== 'venue') {
      throw new HttpError(403, 'Apenas estabelecimentos podem assinar o Plano Ambiente')
    }

    const { data: activeSubscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, stripe_customer_id, plan_tier, status')
      .eq('profile_id', authData.user.id)
      .in('status', ['active', 'trialing', 'past_due', 'incomplete'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subscriptionError) throw subscriptionError
    if (activeSubscription) {
      throw new HttpError(409, 'Este estabelecimento ja possui uma assinatura em andamento')
    }

    const { data: previousSubscription, error: previousSubscriptionError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('profile_id', authData.user.id)
      .not('stripe_customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (previousSubscriptionError) throw previousSubscriptionError

    const { planTier = 'basic', returnTo } = await req.json()
    if (!['basic', 'premium'].includes(planTier)) throw new HttpError(422, 'Plano invalido')

    const priceId = priceForPlan(planTier)
    if (!priceId) throw new HttpError(503, `Preco Stripe nao configurado para o plano ${planTier}`)

    const returnPath = safeReturnPath(returnTo)

    const customerId = previousSubscription?.stripe_customer_id || null
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}${returnPath}${returnPath.includes('?') ? '&' : '?'}subscription=success`,
      cancel_url: `${origin}${returnPath}${returnPath.includes('?') ? '&' : '?'}subscription=cancel`,
      client_reference_id: authData.user.id,
      ...(customerId
        ? { customer: customerId }
        : { customer_email: authData.user.email || undefined }),
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

    return jsonResponse(req, { url: session.url })
  } catch (error) {
    console.error('[PALCO create-subscription]', error)
    return errorResponse(req, error)
  }
})
