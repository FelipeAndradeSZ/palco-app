import { supabase } from '../lib/supabase';

const MULTI_ARTIST_ROOM_SELECT = `
  *,
  current_artist:profiles!rooms_current_artist_id_fkey (
    id, name, avatar_url,
    artist_details (quality_tier, main_genre, rating)
  ),
  active_artists:room_artists!room_artists_room_id_fkey (
    id,
    status,
    is_featured,
    performance_order,
    current_song,
    started_at,
    artist:profiles!room_artists_artist_id_fkey (
      id, name, avatar_url,
      artist_details (quality_tier, main_genre, rating)
    )
  )
`;

function onlyLiveArtists(room) {
  if (!Array.isArray(room?.active_artists)) return room;
  return {
    ...room,
    active_artists: room.active_artists.filter((entry) => !entry.status || entry.status === 'live'),
  };
}

export async function getRooms() {
  const enhanced = await supabase
    .from('rooms')
    .select(MULTI_ARTIST_ROOM_SELECT)
    .eq('is_active', true)
    .order('listener_count', { ascending: false });

  if (enhanced.error) return { data: null, error: enhanced.error };
  return { data: enhanced.data?.map(onlyLiveArtists) || [], error: null };
}

export async function getRoomById(roomId) {
  const enhanced = await supabase
    .from('rooms')
    .select(MULTI_ARTIST_ROOM_SELECT)
    .eq('id', roomId)
    .single();

  if (enhanced.error) return { data: null, error: enhanced.error };
  return { data: onlyLiveArtists(enhanced.data), error: null };
}

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

export async function leaveRoom(roomId, profileId) {
  const { error } = await supabase
    .from('room_participants')
    .delete()
    .eq('room_id', roomId)
    .eq('profile_id', profileId);

  return { error };
}

export async function updateRoomArtist(roomId, artistId) {
  const { data: authData } = await supabase.auth.getUser();
  const authenticatedArtistId = authData?.user?.id;

  if (!authenticatedArtistId || (artistId && artistId !== authenticatedArtistId)) {
    throw new Error('Artista nao autenticado.');
  }

  const result = await supabase.rpc('set_artist_live_state', {
    p_room_id: roomId,
    p_is_live: Boolean(artistId),
  });

  if (result.error) throw result.error;
  return result;
}
