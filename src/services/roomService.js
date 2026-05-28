/**
 * Room Service — Comunicação com tabelas de salas
 */

import { supabase } from '../lib/supabase';

/**
 * Lista todas as salas ativas com contagem de participantes.
 */
export async function getRooms() {
  const { data, error } = await supabase
    .from('rooms')
    .select(`
      *,
      current_artist:profiles!rooms_current_artist_id_fkey (
        id, name, avatar_url
      )
    `)
    .eq('is_active', true)
    .order('listener_count', { ascending: false });

  return { data, error };
}

/**
 * Busca uma sala específica com detalhes completos.
 */
export async function getRoomById(roomId) {
  const { data, error } = await supabase
    .from('rooms')
    .select(`
      *,
      current_artist:profiles!rooms_current_artist_id_fkey (
        id, name, avatar_url, 
        artist_details (quality_tier, main_genre, rating)
      )
    `)
    .eq('id', roomId)
    .single();

  return { data, error };
}

/**
 * Entra em uma sala como participante.
 */
export async function joinRoom(roomId, profileId, role = 'listener') {
  const { data, error } = await supabase
    .from('room_participants')
    .upsert(
      { room_id: roomId, profile_id: profileId, role },
      { onConflict: 'room_id,profile_id' }
    )
    .select()
    .single();

  return { data, error };
}

/**
 * Sai de uma sala.
 */
export async function leaveRoom(roomId, profileId) {
  const { error } = await supabase
    .from('room_participants')
    .delete()
    .eq('room_id', roomId)
    .eq('profile_id', profileId);

  return { error };
}

/**
 * [ARTISTA] Define ou remove o artista atual da sala.
 */
export async function updateRoomArtist(roomId, artistId) {
  const { data, error } = await supabase
    .from('rooms')
    .update({ current_artist_id: artistId })
    .eq('id', roomId)
    .select()
    .single();

  return { data, error };
}
