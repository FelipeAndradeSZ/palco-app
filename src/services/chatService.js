/**
 * Chat Service — Comunicação com a tabela chat_messages
 */

import { supabase } from '../lib/supabase';

/**
 * Envia uma mensagem para o chat da sala.
 * RLS garante que o sender_id é o auth.uid() do chamador.
 * 
 * @param {string} roomId 
 * @param {string} senderId 
 * @param {string} content 
 * @param {string} messageType ('text', 'tip_alert', 'request_alert', 'system')
 */
export async function sendMessage(roomId, senderId, content, messageType = 'text', artistId = null) {
  const payload = {
    room_id: roomId,
    sender_id: senderId,
    content: content.trim(),
    message_type: messageType,
  };
  if (artistId) {
    payload.artist_id = artistId;
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .insert(payload)
    .select()
    .single();

  return { data, error };
}

/**
 * Busca as últimas mensagens da sala para hidratar o histórico
 * quando o usuário acaba de entrar.
 * Traz as informações do remetente via JOIN.
 */
export async function getRecentMessages(roomId, artistId = null, limit = 50) {
  let query = supabase
    .from('chat_messages')
    .select(`
      *,
      sender:profiles!chat_messages_sender_id_fkey (
        id, name, avatar_url, role,
        artist_details(quality_tier)
      )
    `)
    .eq('room_id', roomId);

  if (artistId) {
    query = query.eq('artist_id', artistId);
  } else {
    query = query.is('artist_id', null);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(limit);

  // Reverte para ordem cronológica (mais antigas em cima)
  return { data: data ? data.reverse() : [], error };
}
