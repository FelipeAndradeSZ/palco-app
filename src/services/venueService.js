import { supabase } from '../lib/supabase';

export async function getVenueProfile(profileId) {
  const { data, error } = await supabase
    .from('venue_profiles')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle();

  return { data, error };
}

export async function upsertVenueProfile(profileId, updates) {
  const { data, error } = await supabase
    .from('venue_profiles')
    .upsert(
      {
        profile_id: profileId,
        ...updates,
      },
      { onConflict: 'profile_id' }
    )
    .select()
    .single();

  return { data, error };
}

export async function createBookingRequest({ venueId, artistId, eventDate, city, state, budget, message }) {
  const payload = {
    venue_id: venueId,
    artist_id: artistId,
    event_date: eventDate || null,
    city: city?.trim() || null,
    state: state?.trim() || null,
    budget: budget ? Number(budget) : null,
    message: message?.trim() || null,
  };

  const { data, error } = await supabase
    .from('booking_requests')
    .insert(payload)
    .select()
    .single();

  return { data, error };
}

export async function getBookingRequests(profileId, role) {
  const column = role === 'artist' ? 'artist_id' : 'venue_id';
  const { data, error } = await supabase
    .from('booking_requests')
    .select(`
      *,
      venue:profiles!booking_requests_venue_id_fkey(id, name, avatar_url),
      artist:profiles!booking_requests_artist_id_fkey(id, name, avatar_url)
    `)
    .eq(column, profileId)
    .order('created_at', { ascending: false });

  return { data: data || [], error };
}

export async function updateBookingStatus(requestId, status) {
  const allowedStatuses = ['accepted', 'declined', 'cancelled'];
  if (!allowedStatuses.includes(status)) {
    return { data: null, error: new Error('Status de contratacao invalido.') };
  }

  const { data, error } = await supabase
    .from('booking_requests')
    .update({ status })
    .eq('id', requestId)
    .select()
    .single();

  return { data, error };
}
