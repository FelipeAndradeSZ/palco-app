import { useState, useEffect, useCallback, useRef } from 'react';
import { subscribeToRoom, unsubscribeFromRoom } from '../services/realtimeService';
import { getRecentMessages, sendMessage } from '../services/chatService';
import { getActiveRequests } from '../services/bountyService';
import { getProfile } from '../services/profileService';
import { useAuth } from './useAuth';

export function useRoomRealtime(roomId, options = {}) {
  const { user } = useAuth();
  const userId = user?.id;
  const { onRoomUpdate } = options;
  const [messages, setMessages] = useState([]);
  const [activeRequests, setActiveRequests] = useState([]);
  const [tvAlerts, setTvAlerts] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef(null);

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
    if (!roomId) return undefined;
    let isMounted = true;

    async function hydrate() {
      try {
        const { data: recentMessages } = await getRecentMessages(roomId);
        if (isMounted && recentMessages) setMessages(recentMessages);

        const { data: requests } = await getActiveRequests(roomId);
        if (isMounted && requests) setActiveRequests(requests);
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
        const enrichedMsg = await resolveMessageSender(newMsg);

        if (!isMounted) return;
        setMessages((prev) => [...prev, enrichedMsg]);

        if (newMsg.message_type === 'tip_alert' || newMsg.message_type === 'request_alert') {
          triggerTvAlert(enrichedMsg);
        }
      },
      onSongRequestUpdate: async ({ eventType, newRecord, oldRecord }) => {
        if (!isMounted) return;

        if (eventType === 'INSERT') {
          try {
            const { data: profileData } = await getProfile(newRecord.requester_id);
            const enrichedRequest = { ...newRecord, requester: profileData };
            setActiveRequests((prev) =>
              [...prev, enrichedRequest].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            );
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
        if (isMounted && onRoomUpdate) onRoomUpdate(updatedRoom);
      },
    });

    channelRef.current = channel;

    return () => {
      isMounted = false;
      unsubscribeFromRoom(channelRef.current);
      channelRef.current = null;
    };
  }, [roomId, resolveMessageSender, triggerTvAlert, onRoomUpdate]);

  const sendChatMessage = useCallback(async (content) => {
    if (!userId || !roomId) return { error: { message: 'Nao autorizado' } };
    return sendMessage(roomId, userId, content, 'text');
  }, [roomId, userId]);

  return { messages, activeRequests, tvAlerts, isConnected, sendChatMessage };
}
