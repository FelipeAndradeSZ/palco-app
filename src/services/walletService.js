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
export async function addFundsCheckout(amount, userId, returnTo = '/rooms') {
  const checkoutAmount = Number(amount);
  if (!Number.isFinite(checkoutAmount) || checkoutAmount < 5) {
    throw new Error('Valor mínimo para adicionar créditos é R$ 5,00.');
  }

  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { amount: checkoutAmount, userId, returnTo },
  });

  if (error) throw error;
  if (data?.url) {
    window.location.href = data.url; // Redireciona pro Stripe
    return;
  }

  throw new Error('Checkout nao retornou uma URL de pagamento.');
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

/**
 * Solicita um saque de saldo do artista.
 */
export async function requestWithdrawal(amount, pixKey) {
  const { data, error } = await supabase.rpc('request_withdrawal', {
    p_amount: Number(amount),
    p_pix_key: pixKey,
  });

  return { data, error };
}

/**
 * Busca o histórico de solicitações de saques.
 */
export async function getWithdrawalRequests(profileId) {
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  return { data, error };
}

/**
 * Busca o extrato de transações de um perfil (entrada/saída).
 */
export async function getTransactions(profileId) {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      sender:profiles!transactions_sender_id_fkey(name, avatar_url),
      receiver:profiles!transactions_receiver_id_fkey(name, avatar_url)
    `)
    .or(`sender_id.eq.${profileId},receiver_id.eq.${profileId}`)
    .order('created_at', { ascending: false });

  return { data, error };
}

