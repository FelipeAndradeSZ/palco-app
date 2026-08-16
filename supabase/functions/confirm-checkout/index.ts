import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14.17.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { assertAllowedOrigin, corsHeaders, errorResponse, HttpError, jsonResponse } from '../_shared/http.ts'

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const stripe = new Stripe(stripeSecretKey as string, {
  apiVersion: '2023-10-16',
})

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
    assertAllowedOrigin(req)
    if (!stripeSecretKey || !supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new HttpError(503, 'Pagamentos temporariamente indisponiveis')
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new HttpError(401, 'Usuario nao autenticado')
    const { sessionId } = await req.json()
    if (!sessionId) throw new HttpError(422, 'Sessao de pagamento ausente')

    const supabaseAuth = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: authData, error: authError } = await supabaseAuth.auth.getUser()
    if (authError || !authData.user) throw new HttpError(401, 'Usuario nao autenticado')

    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const userId = session.client_reference_id || session.metadata?.userId
    const amount = Number(session.amount_total || 0) / 100

    if (userId !== authData.user.id) {
      throw new HttpError(403, 'Esta recarga pertence a outro usuario')
    }

    if (session.payment_status !== 'paid') {
      throw new HttpError(409, 'Pagamento ainda nao confirmado')
    }

    if (session.mode !== 'payment' || session.currency !== 'brl') {
      throw new HttpError(422, 'Sessao de pagamento invalida')
    }

    if (!Number.isFinite(amount) || amount < 5 || amount > 5000) {
      throw new HttpError(422, 'Valor confirmado fora dos limites permitidos')
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceRoleKey
    )

    const { data, error } = await supabaseAdmin.rpc('credit_wallet_topup', {
      checkout_session_id: session.id,
      credit_amount: amount,
      target_profile_id: userId,
    })

    if (error) throw error

    return jsonResponse(req, { ok: true, balance: data, amount })
  } catch (error) {
    console.error('[PALCO confirm-checkout]', error)
    const response = errorResponse(req, error)
    const payload = await response.json()
    return jsonResponse(req, { ok: false, ...payload }, response.status)
  }
})
