import { supabase } from '../lib/supabase';

/**
 * Subscribe a client to realtime updates for one room.
 * One channel handles chat, song requests and room status updates.
 */
export function subscribeToRoom(roomId, {
  onNewMessage,
  onSongRequestUpdate,
  onRoomUpdate,
  onConnectionStatus,
} = {}) {
  const channel = supabase.channel(`room:${roomId}`);

  channel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'chat_messages',
      filter: `room_id=eq.${roomId}`,
    },
    (payload) => {
      if (onNewMessage) onNewMessage(payload.new);
    }
  );

  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'song_requests',
      filter: `room_id=eq.${roomId}`,
    },
    (payload) => {
      if (!onSongRequestUpdate) return;

      onSongRequestUpdate({
        eventType: payload.eventType,
        newRecord: payload.new,
        oldRecord: payload.old,
      });
    }
  );

  channel.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'rooms',
      filter: `id=eq.${roomId}`,
    },
    (payload) => {
      if (onRoomUpdate) onRoomUpdate(payload.new);
    }
  );

  channel.subscribe((status) => {
    if (onConnectionStatus) onConnectionStatus(status);

    if (status === 'SUBSCRIBED') {
      console.log(`[PALCO Realtime] Conectado a sala ${roomId}`);
    } else if (status === 'CLOSED') {
      console.log(`[PALCO Realtime] Desconectado da sala ${roomId}`);
    } else if (status === 'CHANNEL_ERROR') {
      console.error(`[PALCO Realtime] Erro de conexao na sala ${roomId}`);
    }
  });

  return channel;
}

export function unsubscribeFromRoom(channel) {
  if (channel) {
    supabase.removeChannel(channel);
  }
}
