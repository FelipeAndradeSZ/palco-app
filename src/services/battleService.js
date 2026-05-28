import { supabase } from '../lib/supabase';

const BATTLE_SELECT = `
  *,
  requester:profiles!battles_requester_id_fkey(id, name, avatar_url),
  challenger:profiles!battles_challenger_artist_id_fkey(id, name, avatar_url, artist_details(main_genre, quality_tier)),
  opponent:profiles!battles_opponent_artist_id_fkey(id, name, avatar_url, artist_details(main_genre, quality_tier)),
  winner:profiles!battles_winner_id_fkey(id, name, avatar_url)
`;

export async function getActiveBattles(roomId) {
  const { data, error } = await supabase
    .from('battles')
    .select(BATTLE_SELECT)
    .eq('room_id', roomId)
    .in('status', ['pending', 'active', 'voting'])
    .order('created_at', { ascending: false });

  return { data: data || [], error };
}

export async function getBattleResults(battleId) {
  const { data, error } = await supabase.rpc('get_battle_results', {
    p_battle_id: battleId,
  });

  return { data: data || [], error };
}

export async function createBattle({ roomId, challengerArtistId, opponentArtistId, songTitle, bountyValue = 0 }) {
  const { data, error } = await supabase.rpc('create_battle', {
    p_room_id: roomId,
    p_challenger_artist_id: challengerArtistId,
    p_opponent_artist_id: opponentArtistId,
    p_song_title: songTitle,
    p_bounty_value: Number(bountyValue || 0),
  });

  return { data, error };
}

export async function acceptBattle(battleId) {
  const { data, error } = await supabase.rpc('accept_battle', {
    p_battle_id: battleId,
  });

  return { data, error };
}

export async function startBattleVoting(battleId) {
  const { data, error } = await supabase.rpc('start_battle_voting', {
    p_battle_id: battleId,
  });

  return { data, error };
}

export async function voteBattle({ battleId, artistId, category }) {
  const { data, error } = await supabase.rpc('vote_battle', {
    p_battle_id: battleId,
    p_artist_id: artistId,
    p_category: category,
  });

  return { data, error };
}

export async function finishBattle(battleId, winnerId = null) {
  const { data, error } = await supabase.rpc('finish_battle', {
    p_battle_id: battleId,
    p_winner_id: winnerId,
  });

  return { data, error };
}

export async function cancelBattle(battleId) {
  const { data, error } = await supabase.rpc('cancel_battle', {
    p_battle_id: battleId,
  });

  return { data, error };
}
