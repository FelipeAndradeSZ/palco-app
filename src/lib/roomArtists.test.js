import { describe, expect, it } from 'vitest';
import {
  getActiveArtists,
  getArtistInteractionUrl,
  getPrimaryArtist,
  roomHasArtist,
} from './roomArtists';

const room = {
  id: 'room-1',
  active_artists: [
    {
      id: 'membership-2',
      artist_id: 'artist-2',
      status: 'live',
      performance_order: 2,
      artist: { id: 'artist-2', name: 'Bia', artist_details: [{ main_genre: 'MPB' }] },
    },
    {
      id: 'membership-1',
      artist_id: 'artist-1',
      status: 'live',
      is_featured: true,
      performance_order: 10,
      artist: { id: 'artist-1', name: 'Caio', artist_details: [{ main_genre: 'Sertanejo' }] },
    },
    {
      id: 'membership-3',
      artist_id: 'artist-3',
      status: 'offline',
      artist: { id: 'artist-3', name: 'Dani' },
    },
  ],
};

describe('multi-artist rooms', () => {
  it('returns every live artist with the featured artist first', () => {
    expect(getActiveArtists(room).map((artist) => artist.id)).toEqual(['artist-1', 'artist-2']);
  });

  it('selects a requested artist without collapsing the room to one singer', () => {
    expect(getPrimaryArtist(room, 'artist-2')?.name).toBe('Bia');
    expect(roomHasArtist(room, 'artist-1')).toBe(true);
    expect(roomHasArtist(room, 'artist-3')).toBe(false);
  });

  it('builds a QR destination scoped to both room and artist', () => {
    expect(getArtistInteractionUrl('room 1', 'artist/2'))
      .toBe('/interact/room%201?artist=artist%2F2');
  });
});
