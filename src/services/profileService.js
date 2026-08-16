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
      *,
      artist_details (*),
      venue_details (*)
    `)
    .eq('id', userId)
    .single();

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
  const { data, error } = await supabase
    .from('artist_details')
    .update(updates)
    .eq('profile_id', profileId)
    .select()
    .single();

  return { data, error };
}

export async function upsertArtistDetails(profileId, updates) {
  const { data, error } = await supabase
    .from('artist_details')
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

export async function completeOnboarding(role, mainGenre = null) {
  const { data, error } = await supabase.rpc('complete_profile_onboarding', {
    p_role: role,
    p_main_genre: mainGenre || null,
  });

  return { data, error };
}
