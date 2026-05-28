import { supabase } from '../lib/supabase';
import { sendMessage } from './chatService';

function shouldFallbackToLegacy(error) {
  if (!error) return false;
  const message = `${error.message || ''} ${error.details || ''}`.toLowerCase();
  return (
    message.includes('target_artist_id') ||
    message.includes('request_source') ||
    message.includes('guest_name') ||
    message.includes('schema cache') ||
    message.includes('could not find')
  );
}

function shouldFallbackTipRpc(error) {
  if (!error) return false;
  const message = `${error.message || ''} ${error.details || ''}`.toLowerCase();
  return (
    message.includes('send_artist_tip') ||
    message.includes('schema cache') ||
    message.includes('could not find') ||
    message.includes('function')
  );
}

const REQUEST_SELECT = `
  *,
  requester:profiles!song_requests_requester_id_fkey(name, avatar_url),
  target_artist:profiles!song_requests_target_artist_id_fkey(id, name, avatar_url)
`;

const LEGACY_REQUEST_SELECT = `
  *,
  requester:profiles!song_requests_requester_id_fkey(name, avatar_url)
`;

export async function createSongRequest({
  roomId,
  songTitle,
  bountyValue,
  dedication = null,
  targetArtistId = null,
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: { message: 'Usuário não autenticado' } };

  const payload = {
    room_id: roomId,
    requester_id: user.id,
    target_artist_id: targetArtistId,
    song_title: songTitle.trim(),
    bounty_value: Number(bountyValue),
    dedication: dedication ? dedication.trim() : null,
    status: 'pending',
    request_source: 'app',
  };

  const enhanced = await supabase
    .from('song_requests')
    .insert(payload)
    .select()
    .single();

  if (!enhanced.error) return enhanced;

  if (!shouldFallbackToLegacy(enhanced.error)) return enhanced;

  const { target_artist_id, request_source, ...legacyPayload } = payload;
  void target_artist_id;
  void request_source;

  const legacy = await supabase
    .from('song_requests')
    .insert(legacyPayload)
    .select()
    .single();

  return legacy;
}

export async function sendTip(roomId, amount, message, targetArtistId = null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: { message: 'Usuário não autenticado' } };

  const tipAmount = Number(amount);
  if (!Number.isFinite(tipAmount) || tipAmount < 5) {
    return { error: { message: 'Valor mínimo da gorjeta é R$ 5,00.' } };
  }

  const cleanMessage = message?.trim();
  const content = cleanMessage
    ? `Enviou R$ ${tipAmount.toFixed(2)} de gorjeta: ${cleanMessage}`
    : `Enviou R$ ${tipAmount.toFixed(2)} de gorjeta.`;

  const rpcResult = await supabase.rpc('send_artist_tip', {
    target_room_id: roomId,
    target_artist_id: targetArtistId,
    tip_amount: tipAmount,
    tip_message: cleanMessage || null,
  });

  if (!rpcResult.error) {
    await sendMessage(roomId, user.id, content, 'tip_alert');
    return rpcResult;
  }

  if (!shouldFallbackTipRpc(rpcResult.error)) {
    return rpcResult;
  }

  const messageResult = await sendMessage(roomId, user.id, content, 'tip_alert');
  if (messageResult.error) return messageResult;

  return {
    data: {
      fallback: true,
      amount: tipAmount,
      room_id: roomId,
      target_artist_id: targetArtistId,
    },
    error: null,
  };
}

export async function getActiveRequests(roomId, targetArtistId = null) {
  const enhanced = await supabase
    .from('song_requests')
    .select(REQUEST_SELECT)
    .eq('room_id', roomId)
    .in('status', ['pending', 'accepted', 'playing'])
    .order('created_at', { ascending: true });

  if (!enhanced.error) {
    const data = targetArtistId
      ? enhanced.data.filter((request) => !request.target_artist_id || request.target_artist_id === targetArtistId)
      : enhanced.data;
    return { data, error: null };
  }

  if (!shouldFallbackToLegacy(enhanced.error)) {
    return { data: null, error: enhanced.error };
  }

  const legacy = await supabase
    .from('song_requests')
    .select(LEGACY_REQUEST_SELECT)
    .eq('room_id', roomId)
    .in('status', ['pending', 'accepted', 'playing'])
    .order('created_at', { ascending: true });

  return { data: legacy.data || [], error: legacy.error };
}

export async function updateRequestStatus(requestId, status) {
  const { data, error } = await supabase
    .from('song_requests')
    .update({ status })
    .eq('id', requestId)
    .select()
    .single();

  return { data, error };
}
