import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14.17.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
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
    const authHeader = req.headers.get('Authorization')
    const { sessionId } = await req.json()

    if (!authHeader) throw new Error('Usuario nao autenticado')
    if (!sessionId) throw new Error('Sessao de pagamento ausente')

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') as string,
      Deno.env.get('SUPABASE_ANON_KEY') as string,
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
      Deno.env.get('SUPABASE_URL') as string,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
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
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
