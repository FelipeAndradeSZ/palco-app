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
  if (typeof value !== 'string') return '/rooms'
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/rooms'
  return value
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

    const { amount, userId, returnTo } = await req.json()
    const checkoutAmount = Number(amount)
    const returnPath = safeReturnPath(returnTo)
    if (!checkoutAmount || !userId) {
      throw new HttpError(422, 'Valor e usuario sao obrigatorios')
    }

    if (userId !== authData.user.id) {
      throw new HttpError(403, 'Nao e permitido criar recarga para outro usuario')
    }

    if (!Number.isFinite(checkoutAmount) || checkoutAmount < 5 || checkoutAmount > 5000) {
      throw new HttpError(422, 'O valor deve ficar entre R$ 5 e R$ 5.000')
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

    return jsonResponse(req, { url: session.url })
  } catch (error) {
    console.error('[PALCO create-checkout]', error)
    return errorResponse(req, error)
  }
})
