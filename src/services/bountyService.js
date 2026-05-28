import { supabase } from '../lib/supabase';
import { sendMessage } from './chatService';

function shouldFallbackToLegacy(error) {
  if (!error) return false;
  const message = `${error.message || ''} ${error.details || ''}`.toLowerCase();
  return (
    message.includes('target_artist_id') ||
    message.includes('request_source') ||
    message.includes('guest_name') ||
    message.includes('dedication') ||
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

function buildRequestAlert(songTitle, bountyValue, dedication) {
  const amount = Number(bountyValue).toFixed(2);
  const extra = dedication ? ` Mensagem: ${dedication.trim()}` : '';
  return `Pediu "${songTitle.trim()}" por R$ ${amount}.${extra}`;
}

async function notifyRequest(roomId, requesterId, songTitle, bountyValue, dedication, targetArtistId = null) {
  const content = buildRequestAlert(songTitle, bountyValue, dedication);
  return sendMessage(roomId, requesterId, content, 'request_alert', targetArtistId);
}

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

  if (!enhanced.error) {
    await notifyRequest(roomId, user.id, payload.song_title, payload.bounty_value, payload.dedication, targetArtistId);
    return enhanced;
  }

  if (!shouldFallbackToLegacy(enhanced.error)) return enhanced;

  const legacyPayload = {
    room_id: payload.room_id,
    requester_id: payload.requester_id,
    song_title: payload.song_title,
    bounty_value: payload.bounty_value,
    status: payload.status,
  };

  const legacy = await supabase
    .from('song_requests')
    .insert(legacyPayload)
    .select()
    .single();

  if (!legacy.error) {
    await notifyRequest(roomId, user.id, payload.song_title, payload.bounty_value, payload.dedication, targetArtistId);
  }

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
    const messageResult = await sendMessage(roomId, user.id, content, 'tip_alert', targetArtistId);
    if (messageResult.error) {
      return {
        data: {
          ...(rpcResult.data || {}),
          chat_warning: `Gorjeta paga, mas nao consegui avisar o artista no chat: ${messageResult.error.message}`,
        },
        error: null,
      };
    }

    return {
      data: { ...(rpcResult.data || {}), chat_message: messageResult.data },
      error: null,
    };
  }

  if (!shouldFallbackTipRpc(rpcResult.error)) {
    return rpcResult;
  }

  // SEGURANÇA: O RPC send_artist_tip não existe ou falhou por schema.
  // NÃO podemos enviar a gorjeta como mensagem no chat sem debitar a carteira,
  // pois isso permitiria gorjetas gratuitas (dinheiro fantasma).
  // Retornamos erro explícito para o frontend informar o usuário.
  console.error('[PALCO bountyService] send_artist_tip RPC indisponível:', rpcResult.error);
  return {
    data: null,
    error: {
      message: 'O sistema de gorjetas está temporariamente indisponível. Tente novamente em instantes.',
      code: 'TIP_RPC_UNAVAILABLE',
    },
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

export async function updateRequestStatus(requestId, status, artistId = null) {
  if (status === 'accepted') {
    let targetArtistId = artistId;
    if (!targetArtistId) {
      const { data: { user } } = await supabase.auth.getUser();
      targetArtistId = user?.id;
    }

    if (!targetArtistId) {
      return { error: new Error('Artista não identificado ou não autenticado.') };
    }

    const { error: rpcError } = await supabase.rpc('process_song_request', {
      p_request_id: requestId,
      p_artist_id: targetArtistId,
    });

    if (rpcError) return { data: null, error: rpcError };

    // Buscar o pedido atualizado para retornar
    const { data, error } = await supabase
      .from('song_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    return { data, error };
  }

  // Demais status (como cancelled ou completed) usam update direto na tabela
  const { data, error } = await supabase
    .from('song_requests')
    .update({ status })
    .eq('id', requestId)
    .select()
    .single();

  return { data, error };
}

