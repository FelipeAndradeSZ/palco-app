import { useState, useEffect, useCallback, useRef } from 'react';
import { subscribeToRoom, unsubscribeFromRoom } from '../services/realtimeService';
import { getRecentMessages, sendMessage } from '../services/chatService';
import { getActiveRequests } from '../services/bountyService';
import { getProfile } from '../services/profileService';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

export function useRoomRealtime(roomId, options = {}) {
  const { user } = useAuth();
  const userId = user?.id;
  const { onRoomUpdate, targetArtistId = null } = options;
  const [messages, setMessages] = useState([]);
  const [activeRequests, setActiveRequests] = useState([]);
  const [tvAlerts, setTvAlerts] = useState([]);
  const [votes, setVotes] = useState({ voice: 0, repertoire: 0, presence: 0 });
  const [userVotes, setUserVotes] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef(null);

  const appendMessage = useCallback((message) => {
    setMessages((prev) => {
      if (prev.some((item) => item.id === message.id)) return prev;
      return [...prev, message];
    });
  }, []);

  const triggerTvAlert = useCallback((alertPayload) => {
    const alertId = crypto.randomUUID();
    const newAlert = { id: alertId, ...alertPayload, timestamp: Date.now() };

    setTvAlerts((prev) => [...prev, newAlert]);
    setTimeout(() => {
      setTvAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
    }, 5000);
  }, []);

  const resolveMessageSender = useCallback(async (messageData) => {
    try {
      const { data: profileData } = await getProfile(messageData.sender_id);
      return { ...messageData, sender: profileData };
    } catch {
      return messageData;
    }
  }, []);

  useEffect(() => {
    setMessages([]);
    setActiveRequests([]);
    setTvAlerts([]);
    setVotes({ voice: 0, repertoire: 0, presence: 0 });
    setUserVotes([]);
    setIsConnected(false);

    if (!roomId) return undefined;
    let isMounted = true;

    async function hydrate() {
      try {
        const { data: recentMessages } = await getRecentMessages(roomId);
        if (isMounted && recentMessages) setMessages(recentMessages);

        const { data: requests } = await getActiveRequests(roomId, targetArtistId);
        if (isMounted && requests) setActiveRequests(requests);

        if (targetArtistId) {
          const { data: votesData } = await supabase.rpc('get_artist_votes', {
            p_room_id: roomId,
            p_artist_id: targetArtistId,
          });
          if (isMounted && votesData) {
            setVotes({
              voice: votesData.voice || 0,
              repertoire: votesData.repertoire || 0,
              presence: votesData.presence || 0,
            });
            setUserVotes(votesData.user_votes || []);
          }
        }
      } catch (err) {
        console.error('[useRoomRealtime] Erro ao hidratar dados iniciais:', err);
      }
    }

    hydrate();

    console.log('[useRoomRealtime] Subscribing to room:', roomId, 'with artist:', targetArtistId);
    const channel = subscribeToRoom(roomId, {
      onConnectionStatus: (status) => {
        console.log('[useRoomRealtime] Connection status changed:', status);
        if (!isMounted) return;
        setIsConnected(status === 'SUBSCRIBED');
      },
      onNewMessage: async (newMsg) => {
        console.log('[useRoomRealtime] onNewMessage event fired:', newMsg);
        if (!isMounted) return;
        const enrichedMsg = await resolveMessageSender(newMsg);

        if (!isMounted) return;
        appendMessage(enrichedMsg);

        if (newMsg.message_type === 'tip_alert' || newMsg.message_type === 'request_alert') {
          triggerTvAlert(enrichedMsg);
        }
      },
      onSongRequestUpdate: async ({ eventType, newRecord, oldRecord }) => {
        console.log('[useRoomRealtime] onSongRequestUpdate event fired:', eventType, newRecord);
        if (!isMounted) return;

        if (eventType === 'INSERT') {
          if (targetArtistId && newRecord.target_artist_id && newRecord.target_artist_id !== targetArtistId) {
            return;
          }

          try {
            const { data: profileData } = await getProfile(newRecord.requester_id);
            const enrichedRequest = { ...newRecord, requester: profileData };
            setActiveRequests((prev) => {
              if (prev.some((request) => request.id === enrichedRequest.id)) return prev;
              return [...prev, enrichedRequest].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            });
          } catch (err) {
            console.error('[useRoomRealtime] Erro ao enriquecer pedido:', err);
          }
        } else if (eventType === 'UPDATE') {
          if (newRecord.status === 'completed' || newRecord.status === 'cancelled') {
            setActiveRequests((prev) => prev.filter((request) => request.id !== newRecord.id));
          } else {
            setActiveRequests((prev) =>
              prev.map((request) => (request.id === newRecord.id ? { ...request, ...newRecord } : request))
            );
          }
        } else if (eventType === 'DELETE') {
          setActiveRequests((prev) => prev.filter((request) => request.id !== oldRecord.id));
        }
      },
      onRoomUpdate: (updatedRoom) => {
        console.log('[useRoomRealtime] onRoomUpdate event fired:', updatedRoom);
        if (isMounted && onRoomUpdate) onRoomUpdate(updatedRoom);
      },
      onVoteCast: (newVote) => {
        console.log('[useRoomRealtime] onVoteCast event fired:', newVote);
        if (!isMounted) return;
        if (targetArtistId && newVote.artist_id !== targetArtistId) return;

        setVotes((prev) => ({
          ...prev,
          [newVote.category]: (prev[newVote.category] || 0) + 1,
        }));
      },
      onLikeTap: (payload) => {
        console.log('[useRoomRealtime] onLikeTap event fired:', payload);
        if (isMounted && options.onLikeReceived) {
          options.onLikeReceived(payload);
        }
      },
    });

    channelRef.current = channel;

    return () => {
      console.log('[useRoomRealtime] Cleaning up subscription for room:', roomId);
      isMounted = false;
      unsubscribeFromRoom(channelRef.current);
      channelRef.current = null;
    };
  }, [appendMessage, roomId, resolveMessageSender, triggerTvAlert, onRoomUpdate, targetArtistId]);

  const sendChatMessage = useCallback(async (content) => {
    if (!userId || !roomId) return { error: { message: 'Nao autorizado' } };
    const result = await sendMessage(roomId, userId, content, 'text');

    if (!result.error && result.data) {
      const enrichedMsg = await resolveMessageSender(result.data);
      appendMessage(enrichedMsg);
    }

    return result;
  }, [appendMessage, resolveMessageSender, roomId, userId]);

  const castVote = useCallback(async (category) => {
    if (!userId || !roomId || !targetArtistId) return { error: new Error('Não autorizado') };

    const { data, error } = await supabase.rpc('cast_artist_vote', {
      p_room_id: roomId,
      p_artist_id: targetArtistId,
      p_category: category,
    });

    if (!error && data?.success) {
      setUserVotes((prev) => [...prev, category]);
    }

    return { data, error };
  }, [roomId, targetArtistId, userId]);

  const sendLike = useCallback(async (x = 50, y = 50) => {
    if (!channelRef.current?.broadcastChannel) return;
    await channelRef.current.broadcastChannel.send({
      type: 'broadcast',
      event: 'like_tap',
      payload: { x, y, senderName: user?.name || 'Ouvinte' },
    });
  }, [user]);

  return { messages, activeRequests, tvAlerts, isConnected, sendChatMessage, votes, userVotes, castVote, sendLike };
}

