import { describe, expect, it } from 'vitest';
import { isRequestVisibleToArtist } from './requestVisibility';

describe('song request visibility', () => {
  it('shows open pending requests to every artist in the room', () => {
    expect(isRequestVisibleToArtist({ status: 'pending', target_artist_id: null }, 'artist-a')).toBe(true);
    expect(isRequestVisibleToArtist({ status: 'pending', target_artist_id: null }, 'artist-b')).toBe(true);
  });

  it('keeps directed pending requests private to their target artist', () => {
    const request = { status: 'pending', target_artist_id: 'artist-a' };
    expect(isRequestVisibleToArtist(request, 'artist-a')).toBe(true);
    expect(isRequestVisibleToArtist(request, 'artist-b')).toBe(false);
  });

  it('shows accepted requests only to the artist who accepted them', () => {
    const request = { status: 'accepted', target_artist_id: null, accepted_by: 'artist-b' };
    expect(isRequestVisibleToArtist(request, 'artist-a')).toBe(false);
    expect(isRequestVisibleToArtist(request, 'artist-b')).toBe(true);
  });

  it('hides finished requests', () => {
    expect(isRequestVisibleToArtist({ status: 'completed', accepted_by: 'artist-a' }, 'artist-a')).toBe(false);
  });
});
