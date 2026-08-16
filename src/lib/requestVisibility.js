export function isRequestVisibleToArtist(request, artistId) {
  if (!artistId) return true;

  if (request?.status === 'pending') {
    return !request.target_artist_id || request.target_artist_id === artistId;
  }

  if (request?.status === 'accepted' || request?.status === 'playing') {
    return request.accepted_by === artistId;
  }

  return false;
}
