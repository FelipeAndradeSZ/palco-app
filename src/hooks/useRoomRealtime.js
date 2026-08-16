import { useState, useEffect, useCallback, useRef } from 'react';
import { subscribeToRoom, unsubscribeFromRoom } from '../services/realtimeService';
import { getRecentMessages, sendMessage } from '../services/chatService';
import { getActiveRequests } from '../services/bountyService';
import { getActiveBattles, getBattleResults } from '../services/battleService';
import { getProfile } from '../services/profileService';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import { isRequestVisibleToArtist } from '../lib/requestVisibility';

export function useRoomRealtime(roomId, options = {}) {
  const { user } = useAuth();
  const userId = user?.id;
  const { onRoomUpdate, onLikeReceived, targetArtistId = null } = options;
  const [messages, setMessages] = useState([]);
  const [activeRequests, setActiveRequests] = useState([]);
  const [activeBattles, setActiveBattles] = useState([]);
  const [battleResults, setBattleResults] = useState({});
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
    setActiveBattles([]);
    setBattleResults({});
    setTvAlerts([]);
    setVotes({ voice: 0, repertoire: 0, presence: 0 });
    setUserVotes([]);
    setIsConnected(false);

    if (!roomId) return undefined;
    let isMounted = true;

    async function hydrate() {
      try {
        const { data: recentMessages } = await getRecentMessages(roomId, targetArtistId);
        if (isMounted && recentMessages) setMessages(recentMessages);

        const { data: requests } = await getActiveRequests(roomId, targetArtistId);
        if (isMounted && requests) setActiveRequests(requests);

        const { data: battles } = await getActiveBattles(roomId);
        if (isMounted && battles) {
          setActiveBattles(battles);

          const resultEntries = await Promise.all(
            battles.map(async (battle) => {
              const { data: results } = await getBattleResults(battle.id);
              return [battle.id, results || []];
            })
          );

          if (isMounted) setBattleResults(Object.fromEntries(resultEntries));
        }

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

    const channel = subscribeToRoom(roomId, {
      onConnectionStatus: (status) => {
        if (!isMounted) return;
        setIsConnected(status === 'SUBSCRIBED');
      },
      onNewMessage: async (newMsg) => {
        if (!isMounted) return;
        if (newMsg.artist_id !== targetArtistId) return;
        const enrichedMsg = await resolveMessageSender(newMsg);

        if (!isMounted) return;
        appendMessage(enrichedMsg);

      },
      onSongRequestUpdate: async ({ eventType, newRecord, oldRecord }) => {
        if (!isMounted) return;

        if (eventType === 'INSERT') {
          if (targetArtistId && !isRequestVisibleToArtist(newRecord, targetArtistId)) {
            return;
          }

          try {
            const { data: profileData } = await getProfile(newRecord.requester_id);
            const enrichedRequest = { ...newRecord, requester: profileData };
            setActiveRequests((prev) => {
              if (prev.some((request) => request.id === enrichedRequest.id)) return prev;
              return [...prev, enrichedRequest].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            });
            triggerTvAlert({
              ...enrichedRequest,
              message_type: 'request_alert',
              content: `"${enrichedRequest.song_title}" por R$ ${Number(enrichedRequest.bounty_value).toFixed(2)}${enrichedRequest.dedication ? `. ${enrichedRequest.dedication}` : ''}`,
              sender: profileData,
            });
          } catch (err) {
            console.error('[useRoomRealtime] Erro ao enriquecer pedido:', err);
          }
        } else if (eventType === 'UPDATE') {
          const isTerminal = newRecord.status === 'completed' || newRecord.status === 'cancelled';
          if (isTerminal || (targetArtistId && !isRequestVisibleToArtist(newRecord, targetArtistId))) {
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
        if (isMounted && onRoomUpdate) onRoomUpdate(updatedRoom);
      },
      onVoteCast: (newVote) => {
        if (!isMounted) return;
        if (targetArtistId && newVote.artist_id !== targetArtistId) return;

        setVotes((prev) => ({
          ...prev,
          [newVote.category]: (prev[newVote.category] || 0) + 1,
        }));
      },
      onArtistInteraction: async (interaction) => {
        if (!isMounted || interaction.artist_id !== targetArtistId) return;

        const enrichedInteraction = await resolveMessageSender({
          ...interaction,
          sender_id: interaction.sender_id,
        });
        if (!isMounted) return;

        if (interaction.interaction_type === 'tip') {
          triggerTvAlert({
            ...enrichedInteraction,
            message_type: 'tip_alert',
            content: `R$ ${Number(interaction.amount || 0).toFixed(2)}${interaction.message ? ` - ${interaction.message}` : ''}`,
          });
        }
      },
      onBattleUpdate: ({ eventType, newRecord, oldRecord }) => {
        if (!isMounted) return;

        if (eventType === 'INSERT') {
          setActiveBattles((prev) => {
            if (prev.some((battle) => battle.id === newRecord.id)) return prev;
            return [newRecord, ...prev];
          });
        } else if (eventType === 'UPDATE') {
          if (newRecord.status === 'finished' || newRecord.status === 'cancelled') {
            setActiveBattles((prev) => prev.filter((battle) => battle.id !== newRecord.id));
          } else {
            setActiveBattles((prev) =>
              prev.map((battle) => (battle.id === newRecord.id ? { ...battle, ...newRecord } : battle))
            );
          }
        } else if (eventType === 'DELETE') {
          setActiveBattles((prev) => prev.filter((battle) => battle.id !== oldRecord.id));
        }
      },
      onBattleVote: async (payload) => {
        if (!isMounted) return;
        const battleId = payload.new?.battle_id || payload.old?.battle_id;
        if (!battleId) return;

        const { data: results } = await getBattleResults(battleId);
        if (isMounted) {
          setBattleResults((prev) => ({ ...prev, [battleId]: results || [] }));
        }
      },
      onLikeTap: (payload) => {
        if (isMounted && onLikeReceived && payload.artistId === targetArtistId) {
          onLikeReceived(payload);
        }
      },
    });

    channelRef.current = channel;

    return () => {
      isMounted = false;
      unsubscribeFromRoom(channelRef.current);
      channelRef.current = null;
    };
  }, [appendMessage, roomId, resolveMessageSender, triggerTvAlert, onRoomUpdate, onLikeReceived, targetArtistId]);

  const sendChatMessage = useCallback(async (content) => {
    if (!userId || !roomId) return { error: { message: 'Nao autorizado' } };
    const result = await sendMessage(roomId, userId, content, 'text', targetArtistId);

    if (!result.error && result.data) {
      const enrichedMsg = await resolveMessageSender(result.data);
      appendMessage(enrichedMsg);
    }

    return result;
  }, [appendMessage, resolveMessageSender, roomId, userId, targetArtistId]);

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
    if (!channelRef.current?.broadcastChannel || !targetArtistId) return;
    await channelRef.current.broadcastChannel.send({
      type: 'broadcast',
      event: 'like_tap',
      payload: {
        artistId: targetArtistId,
        x,
        y,
        senderName: user?.user_metadata?.name || 'Ouvinte',
      },
    });
  }, [targetArtistId, user]);

  return {
    messages,
    activeRequests,
    activeBattles,
    battleResults,
    tvAlerts,
    isConnected,
    sendChatMessage,
    votes,
    userVotes,
    castVote,
    sendLike,
  };
}
