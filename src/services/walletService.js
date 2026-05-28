/**
 * Wallet Service — Gerenciamento de Saldo e Fundos
 */

import { supabase } from '../lib/supabase';

/**
 * Busca a carteira do usuário logado.
 */
export async function getWallet(profileId) {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('profile_id', profileId)
    .single();

  return { data, error };
}

/**
 * [PRODUÇÃO] Cria uma sessão de checkout no Stripe para adicionar fundos.
 */
export async function addFundsCheckout(amount, userId) {
  const checkoutAmount = Number(amount);
  if (!Number.isFinite(checkoutAmount) || checkoutAmount < 5) {
    throw new Error('Valor mínimo para adicionar créditos é R$ 5,00.');
  }

  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { amount: checkoutAmount, userId },
  });

  if (error) throw error;
  if (data?.url) {
    window.location.href = data.url; // Redireciona pro Stripe
  }
}

export async function confirmCheckoutSession(sessionId) {
  const { data, error } = await supabase.functions.invoke('confirm-checkout', {
    body: { sessionId },
  });

  if (error) {
    let details = null;

    try {
      if (error.context) {
        details = await error.context.json();
      }
    } catch {
      details = null;
    }

    throw new Error(details?.error || error.message || 'Nao foi possivel confirmar o pagamento.');
  }

  if (!data?.ok) throw new Error(data?.error || 'Nao foi possivel confirmar o pagamento.');

  return data;
}
