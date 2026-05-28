/**
 * Bounty Service — Gerenciamento de Gorjetas e Pedidos Musicais
 */

import { supabase } from '../lib/supabase';

/**
 * Cria um pedido musical.
 * O trigger `process_song_request` no banco interceptará esse insert,
 * verificará o saldo e fará a dedução automaticamente de forma transacional.
 *
 * @param {Object} params
 * @param {string} params.roomId
 * @param {string} params.songTitle
 * @param {number} params.bountyValue
 * @param {string} [params.dedication]
 */
export async function createSongRequest({ roomId, songTitle, bountyValue, dedication = null }) {
  // Pegamos o ID do usuário atual para segurança via Auth SDK em vez de confiar no input
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: { message: 'Usuário não autenticado' } };

  const { data, error } = await supabase
    .from('song_requests')
    .insert({
      room_id: roomId,
      requester_id: user.id,
      song_title: songTitle.trim(),
      bounty_value: Number(bountyValue),
      dedication: dedication ? dedication.trim() : null,
      status: 'pending',
    })
    .select()
    .single();

  return { data, error };
}

/**
 * Envia uma gorjeta direta para o artista atual da sala.
 * (A ser implementado como transação pura no futuro, por hora reusa a infra do chat).
 */
export async function sendTip(roomId, amount, message) {
   // Apenas um placeholder para MVP. O core é o pedido musical.
   console.log('Enviando gorjeta:', { roomId, amount, message });
}

/**
 * Busca todos os pedidos ativos (pendentes ou aceitos) de uma sala.
 */
export async function getActiveRequests(roomId) {
  const { data, error } = await supabase
    .from('song_requests')
    .select(`
      *,
      requester:profiles!song_requests_requester_id_fkey(name, avatar_url)
    `)
    .eq('room_id', roomId)
    .in('status', ['pending', 'accepted', 'playing'])
    .order('created_at', { ascending: true });

  return { data, error };
}

/**
 * Atualiza o status de um pedido (ex: Artista aceitou ou concluiu).
 * Quando concluído, outra logic no banco (trigger ou rpc) pode repassar o valor
 * definitivamente para a carteira do artista.
 */
export async function updateRequestStatus(requestId, status) {
  const { data, error } = await supabase
    .from('song_requests')
    .update({ status })
    .eq('id', requestId)
    .select()
    .single();

  return { data, error };
}
