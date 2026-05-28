export function normalizeArtistEntry(entry) {
  if (!entry) return null;

  const artist = entry.artist || entry.profile || entry;
  if (!artist?.id && !entry.artist_id) return null;

  const details = Array.isArray(artist.artist_details)
    ? artist.artist_details[0]
    : artist.artist_details;

  return {
    id: artist.id || entry.artist_id,
    name: artist.name || entry.name || 'Artista PALCO',
    avatar_url: artist.avatar_url || entry.avatar_url || null,
    status: entry.status || 'live',
    room_artist_id: entry.id || null,
    is_featured: Boolean(entry.is_featured),
    performance_order: entry.performance_order || 0,
    current_song: entry.current_song || null,
    quality_tier: details?.quality_tier || entry.quality_tier || null,
    main_genre: details?.main_genre || entry.main_genre || null,
    rating: details?.rating || entry.rating || null,
  };
}

export function getActiveArtists(room) {
  if (!room) return [];

  const roomArtists = Array.isArray(room.active_artists)
    ? room.active_artists
    : Array.isArray(room.room_artists)
      ? room.room_artists
      : [];

  const activeArtists = roomArtists
    .filter((entry) => !entry.status || entry.status === 'live')
    .map(normalizeArtistEntry)
    .filter(Boolean);

  if (activeArtists.length > 0) {
    return activeArtists.sort((a, b) => {
      if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
      return a.performance_order - b.performance_order;
    });
  }

  if (room.current_artist) {
    return [
      normalizeArtistEntry({
        artist: room.current_artist,
        artist_id: room.current_artist_id || room.current_artist.id,
        status: 'live',
        is_featured: true,
      }),
    ].filter(Boolean);
  }

  return [];
}

export function getPrimaryArtist(room, selectedArtistId) {
  const artists = getActiveArtists(room);
  if (selectedArtistId) {
    return artists.find((artist) => artist.id === selectedArtistId) || artists[0] || null;
  }
  return artists[0] || null;
}

export function roomHasArtist(room, artistId) {
  if (!artistId) return false;
  return getActiveArtists(room).some((artist) => artist.id === artistId);
}

export function getArtistInteractionUrl(roomId, artistId) {
  const artistParam = artistId ? `?artist=${encodeURIComponent(artistId)}` : '';
  return `/interact/${roomId}${artistParam}`;
}
