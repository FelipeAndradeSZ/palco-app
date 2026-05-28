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
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { amount, userId },
  });

  if (error) throw error;
  if (data?.url) {
    window.location.href = data.url; // Redireciona pro Stripe
  }
}
