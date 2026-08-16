/**
 * Profile Service — Comunicação com tabelas de perfil
 */

import { supabase } from '../lib/supabase';

/**
 * Busca o perfil completo de um usuário.
 * Inclui artist_details ou venue_details conforme o role.
 */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      role,
      name,
      avatar_url,
      bio,
      city,
      created_at,
      onboarding_completed,
      artist_details (
        profile_id,
        quality_tier,
        main_genre,
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
    .eq('id', userId)
    .single();

  return { data, error };
}

export async function getOwnProfile() {
  const { data, error } = await supabase.rpc('get_own_profile');
  return { data, error };
}

/**
 * Atualiza dados do perfil do usuário.
 * RLS garante que só o próprio usuário pode editar.
 */
export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  return { data, error };
}

/**
 * Atualiza dados específicos do artista.
 */
export async function updateArtistDetails(profileId, updates) {
  const { error } = await supabase
    .from('artist_details')
    .update(updates)
    .eq('profile_id', profileId);

  return { data: null, error };
}

export async function upsertArtistDetails(profileId, updates) {
  const { error } = await supabase
    .from('artist_details')
    .upsert(
      {
        profile_id: profileId,
        ...updates,
      },
      { onConflict: 'profile_id' }
    );

  return { data: null, error };
}

export async function saveOwnProfile(profile) {
  const { data, error } = await supabase.rpc('save_own_profile', {
    p_name: profile.name,
    p_main_genre: profile.mainGenre || null,
    p_bio: profile.bio || null,
    p_repertoire: profile.repertoire || null,
    p_pix_key: profile.pixKey || null,
    p_instagram_url: profile.instagramUrl || null,
    p_booking_whatsapp: profile.bookingWhatsapp || null,
    p_city: profile.city || null,
    p_state: profile.state || null,
    p_region: profile.region || null,
    p_available_for_booking: profile.availableForBooking,
  });

  return { data, error };
}

export async function completeOnboarding(role, mainGenre = null) {
  const { data, error } = await supabase.rpc('complete_profile_onboarding', {
    p_role: role,
    p_main_genre: mainGenre || null,
  });

  return { data, error };
}
