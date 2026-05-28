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
  onVoteCast,
  onLikeTap,
} = {}) {
  // Use a unique channel for database changes to avoid duplicate/overlapping unsubscribe conflicts
  const dbChannelId = crypto.randomUUID();
  const dbChannel = supabase.channel(`room-db:${roomId}:${dbChannelId}`);
  
  // Use a shared channel name for broadcasts (likes) so that all clients receive it
  const broadcastChannel = supabase.channel(`room-bc:${roomId}`);

  dbChannel.on(
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

  dbChannel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'artist_votes',
      filter: `room_id=eq.${roomId}`,
    },
    (payload) => {
      if (onVoteCast) onVoteCast(payload.new);
    }
  );

  dbChannel.on(
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

  dbChannel.on(
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

  broadcastChannel.on(
    'broadcast',
    { event: 'like_tap' },
    ({ payload }) => {
      if (onLikeTap) onLikeTap(payload);
    }
  );

  // Subscribe to both channels
  dbChannel.subscribe((status) => {
    if (onConnectionStatus) onConnectionStatus(status);

    if (status === 'SUBSCRIBED') {
      console.log(`[PALCO Realtime] Banco de dados conectado a sala ${roomId}`);
    } else if (status === 'CHANNEL_ERROR') {
      console.error(`[PALCO Realtime] Erro de conexao DB na sala ${roomId}`);
    }
  });

  broadcastChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log(`[PALCO Realtime] Canal de likes conectado a sala ${roomId}`);
    }
  });

  return { dbChannel, broadcastChannel };
}

export function unsubscribeFromRoom(channels) {
  if (!channels) return;
  
  if (channels.dbChannel) {
    supabase.removeChannel(channels.dbChannel);
  }
  
  if (channels.broadcastChannel) {
    supabase.removeChannel(channels.broadcastChannel);
  }
}
