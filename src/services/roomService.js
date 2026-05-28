import { supabase } from '../lib/supabase';

const LEGACY_ROOM_SELECT = `
  *,
  current_artist:profiles!rooms_current_artist_id_fkey (
    id, name, avatar_url,
    artist_details (quality_tier, main_genre, rating)
  )
`;

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

function shouldFallbackToLegacy(error) {
  if (!error) return false;
  const message = `${error.message || ''} ${error.details || ''}`.toLowerCase();
  return (
    message.includes('room_artists') ||
    message.includes('relationship') ||
    message.includes('schema cache') ||
    message.includes('could not find')
  );
}

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

  if (!enhanced.error) {
    return { data: enhanced.data?.map(onlyLiveArtists) || [], error: null };
  }

  if (!shouldFallbackToLegacy(enhanced.error)) {
    return { data: null, error: enhanced.error };
  }

  const legacy = await supabase
    .from('rooms')
    .select(LEGACY_ROOM_SELECT)
    .eq('is_active', true)
    .order('listener_count', { ascending: false });

  return { data: legacy.data || [], error: legacy.error };
}

export async function getRoomById(roomId) {
  const enhanced = await supabase
    .from('rooms')
    .select(MULTI_ARTIST_ROOM_SELECT)
    .eq('id', roomId)
    .single();

  if (!enhanced.error) {
    return { data: onlyLiveArtists(enhanced.data), error: null };
  }

  if (!shouldFallbackToLegacy(enhanced.error)) {
    return { data: null, error: enhanced.error };
  }

  const legacy = await supabase
    .from('rooms')
    .select(LEGACY_ROOM_SELECT)
    .eq('id', roomId)
    .single();

  return { data: legacy.data, error: legacy.error };
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

async function syncLegacyCurrentArtist(roomId, artistId) {
  return supabase
    .from('rooms')
    .update({ current_artist_id: artistId })
    .eq('id', roomId)
    .select()
    .single();
}

async function chooseNextFeaturedArtist(roomId) {
  const { data } = await supabase
    .from('room_artists')
    .select('artist_id')
    .eq('room_id', roomId)
    .eq('status', 'live')
    .order('is_featured', { ascending: false })
    .order('performance_order', { ascending: true })
    .limit(1);

  return data?.[0]?.artist_id || null;
}

export async function updateRoomArtist(roomId, artistId, currentArtistIdOverride = null) {
  if (artistId) {
    const upsert = await supabase
      .from('room_artists')
      .upsert(
        {
          room_id: roomId,
          artist_id: artistId,
          status: 'live',
          started_at: new Date().toISOString(),
          ended_at: null,
        },
        { onConflict: 'room_id,artist_id' }
      )
      .select()
      .single();

    if (!upsert.error) {
      await syncLegacyCurrentArtist(roomId, artistId);
      return upsert;
    }

    if (!shouldFallbackToLegacy(upsert.error)) {
      throw upsert.error;
    }

    const legacy = await syncLegacyCurrentArtist(roomId, artistId);
    if (legacy.error) throw legacy.error;
    return legacy;
  }

  const { data: authData } = await supabase.auth.getUser();
  const currentArtistId = currentArtistIdOverride || authData?.user?.id;

  if (currentArtistId) {
    const update = await supabase
      .from('room_artists')
      .update({
        status: 'offline',
        ended_at: new Date().toISOString(),
        is_featured: false,
      })
      .eq('room_id', roomId)
      .eq('artist_id', currentArtistId)
      .select()
      .maybeSingle();

    if (!update.error) {
      const nextArtistId = await chooseNextFeaturedArtist(roomId);
      await syncLegacyCurrentArtist(roomId, nextArtistId);
      return { data: update.data, error: null };
    }

    if (!shouldFallbackToLegacy(update.error)) {
      throw update.error;
    }
  }

  const legacy = await syncLegacyCurrentArtist(roomId, null);
  if (legacy.error) throw legacy.error;
  return legacy;
}
