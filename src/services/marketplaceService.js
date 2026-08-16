import { supabase } from '../lib/supabase';

export async function searchArtists({ genre = '', region = '', state = '', city = '' } = {}) {
  let query = supabase
    .from('profiles')
    .select(`
      id,
      name,
      avatar_url,
      artist_details(
        main_genre,
        quality_tier,
        rating,
        bio,
        repertoire,
        instagram_url,
        city,
        state,
        region,
        available_for_booking
      )
    `)
    .eq('role', 'artist')
    .order('name', { ascending: true });

  const { data, error } = await query;
  if (error) return { data: [], error };

  const normalized = (data || [])
    .map((profile) => ({
      ...profile,
      artist_details: Array.isArray(profile.artist_details)
        ? profile.artist_details[0]
        : profile.artist_details,
    }))
    .filter((artist) => artist.artist_details?.available_for_booking !== false)
    .filter((artist) => !genre || artist.artist_details?.main_genre === genre)
    .filter((artist) => !region || artist.artist_details?.region === region)
    .filter((artist) => !state || artist.artist_details?.state?.toLowerCase().includes(state.toLowerCase()))
    .filter((artist) => !city || artist.artist_details?.city?.toLowerCase().includes(city.toLowerCase()));

  return { data: normalized, error: null };
}
