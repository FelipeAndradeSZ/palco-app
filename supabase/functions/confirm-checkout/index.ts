import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14.17.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const stripe = new Stripe(stripeSecretKey as string, {
  apiVersion: '2023-10-16',
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!stripeSecretKey) throw new Error('STRIPE_SECRET_KEY nao configurada no Supabase')
    if (!supabaseUrl) throw new Error('SUPABASE_URL nao configurada no Supabase')
    if (!supabaseAnonKey) throw new Error('SUPABASE_ANON_KEY nao configurada no Supabase')
    if (!supabaseServiceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY nao configurada no Supabase')

    const authHeader = req.headers.get('Authorization')
    const { sessionId } = await req.json()

    if (!authHeader) throw new Error('Usuario nao autenticado')
    if (!sessionId) throw new Error('Sessao de pagamento ausente')

    const supabaseAuth = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: authData, error: authError } = await supabaseAuth.auth.getUser()
    if (authError || !authData.user) throw new Error('Usuario nao autenticado')

    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const userId = session.client_reference_id || session.metadata?.userId
    const amount = Number(session.metadata?.amount || 0)

    if (userId !== authData.user.id) {
      throw new Error('Esta recarga pertence a outro usuario')
    }

    if (session.payment_status !== 'paid') {
      throw new Error('Pagamento ainda nao confirmado')
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceRoleKey
    )

    const { data, error } = await supabaseAdmin.rpc('credit_wallet_topup', {
      checkout_session_id: session.id,
      target_profile_id: userId,
      credit_amount: amount,
    })

    if (error) throw error

    return new Response(
      JSON.stringify({ ok: true, balance: data, amount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[PALCO confirm-checkout]', error)
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
