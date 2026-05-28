/**
 * Realtime Service — Gerenciador Otimizado de WebSockets
 * 
 * ESCOPO DE ALTA ESCALABILIDADE:
 * Para evitar esgotar conexões do Supabase, usamos apenas UM canal
 * por sala (`room:${roomId}`). Este canal escuta alterações em 
 * MÚLTIPLAS tabelas ao mesmo tempo.
 */

import { supabase } from '../lib/supabase';

/**
 * Inscreve um cliente em todas as atualizações de tempo real
 * de uma sala específica (chat e fila de pedidos).
 * 
 * @param {string} roomId O UUID da sala.
 * @param {Object} callbacks Objeto com as funções de callback.
 * @returns {import('@supabase/supabase-js').RealtimeChannel} O canal instanciado (para cleanup).
 */
export function subscribeToRoom(roomId, { onNewMessage, onSongRequestUpdate }) {
  // Nome único do canal para essa sala
  const channel = supabase.channel(`room:${roomId}`);

  // 1. Escutar Novas Mensagens de Chat
  channel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'chat_messages',
      filter: `room_id=eq.${roomId}`,
    },
    (payload) => {
      // Como o evento do Supabase não traz o JOIN automático, 
      // precisamos tratar isso no hook (ex: fazer fetch rápido do profile)
      // ou apenas injetar a mensagem com dados básicos dependendo da urgência.
      if (onNewMessage) onNewMessage(payload.new);
    }
  );

  // 2. Escutar Alterações na Fila de Pedidos
  channel.on(
    'postgres_changes',
    {
      event: '*', // Escuta INSERT, UPDATE e DELETE
      schema: 'public',
      table: 'song_requests',
      filter: `room_id=eq.${roomId}`,
    },
    (payload) => {
      if (onSongRequestUpdate) {
        onSongRequestUpdate({
          eventType: payload.eventType,
          newRecord: payload.new,
          oldRecord: payload.old,
        });
      }
    }
  );

  // Inicia a inscrição
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log(`[PALCO Realtime] Conectado à sala ${roomId}`);
    } else if (status === 'CLOSED') {
      console.log(`[PALCO Realtime] Desconectado da sala ${roomId}`);
    } else if (status === 'CHANNEL_ERROR') {
      console.error(`[PALCO Realtime] Erro de conexão na sala ${roomId}`);
    }
  });

  return channel;
}

/**
 * Encerra a conexão WebSocket atrelada a este canal.
 * CRÍTICO para evitar vazamento de memória.
 * 
 * @param {import('@supabase/supabase-js').RealtimeChannel} channel 
 */
export function unsubscribeFromRoom(channel) {
  if (channel) {
    supabase.removeChannel(channel);
  }
}
