import { supabase } from '../lib/supabase';

export const MASTER_ADMIN_EMAIL = 'felipedosreis2002@gmail.com';

export function isAdminUser(user) {
  return (
    user?.email?.toLowerCase() === MASTER_ADMIN_EMAIL ||
    user?.app_metadata?.role === 'admin' ||
    user?.app_metadata?.is_admin === true
  );
}

export async function getAdminStatus() {
  const { data, error } = await supabase.rpc('is_platform_admin');
  return { data: Boolean(data), error };
}

export async function getArtistCandidates() {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      name,
      avatar_url,
      created_at,
      artist_details(
        main_genre,
        quality_tier,
        rating,
        bio,
        repertoire,
        city,
        state,
        region
      )
    `)
    .eq('role', 'artist')
    .order('created_at', { ascending: false });

  if (error) return { data: [], error };

  return {
    data: (data || []).map((artist) => ({
      ...artist,
      artist_details: Array.isArray(artist.artist_details)
        ? artist.artist_details[0]
        : artist.artist_details,
    })),
    error: null,
  };
}

export async function updateArtistTier(profileId, qualityTier) {
  const { data, error } = await supabase.rpc('curator_update_artist_tier', {
    p_profile_id: profileId,
    p_quality_tier: qualityTier,
  });

  return { data, error };
}

export async function getAdminWithdrawals() {
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select(`
      *,
      profile:profiles!withdrawal_requests_profile_id_fkey(id, name, avatar_url)
    `)
    .order('created_at', { ascending: false });

  return { data: data || [], error };
}

export async function approveWithdrawal(requestId) {
  const { data, error } = await supabase.rpc('complete_manual_withdrawal', {
    p_request_id: requestId,
  });

  return { data, error };
}

export async function rejectWithdrawal(requestId, reason) {
  const { data, error } = await supabase.rpc('reject_withdrawal', {
    p_request_id: requestId,
    p_reason: reason,
  });

  return { data, error };
}
