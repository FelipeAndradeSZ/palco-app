/**
 * useRoomRealtime — Hook centralizador de tempo real
 * 
 * Gerencia o estado e as assinaturas de WebSocket para uma sala ativa.
 * Previne memory leaks garantindo desconexão na desmontagem.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { subscribeToRoom, unsubscribeFromRoom } from '../services/realtimeService';
import { getRecentMessages, sendMessage } from '../services/chatService';
import { getActiveRequests } from '../services/bountyService';
import { getProfile } from '../services/profileService';
import { useAuth } from './useAuth';

export function useRoomRealtime(roomId) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [activeRequests, setActiveRequests] = useState([]);
  const [tvAlerts, setTvAlerts] = useState([]); // Fila de alertas para a TV
  const [isConnected, setIsConnected] = useState(false);
  
  // Ref para guardar o canal e evitar race conditions de re-render
  const channelRef = useRef(null);

  const triggerTvAlert = useCallback((alertPayload) => {
    const alertId = crypto.randomUUID();
    const newAlert = { id: alertId, ...alertPayload, timestamp: Date.now() };
    
    setTvAlerts((prev) => [...prev, newAlert]);
    setTimeout(() => {
      setTvAlerts((prev) => prev.filter((a) => a.id !== alertId));
    }, 5000);
  }, []);

  const resolveMessageSender = useCallback(async (messageData) => {
    try {
      const { data: profileData } = await getProfile(messageData.sender_id);
      return { ...messageData, sender: profileData };
    } catch (err) {
      return messageData;
    }
  }, []);

  useEffect(() => {
    if (!roomId) return;
    let isMounted = true;

    async function hydrate() {
      try {
        const { data: recentMessages } = await getRecentMessages(roomId);
        if (isMounted && recentMessages) setMessages(recentMessages);
        
        // Fase 4: Hidratar pedidos musicais ativos
        const { data: requests } = await getActiveRequests(roomId);
        if (isMounted && requests) setActiveRequests(requests);
      } catch (err) {
        console.error('[useRoomRealtime] Erro ao hidratar dados iniciais:', err);
      }
    }
    
    hydrate();

    const channel = subscribeToRoom(roomId, {
      onNewMessage: async (newMsg) => {
        if (!isMounted) return;
        const enrichedMsg = await resolveMessageSender(newMsg);
        
        if (isMounted) {
          setMessages((prev) => [...prev, enrichedMsg]);
          if (newMsg.message_type === 'tip_alert' || newMsg.message_type === 'request_alert') {
            triggerTvAlert(enrichedMsg);
          }
        }
      },
      onSongRequestUpdate: async ({ eventType, newRecord, oldRecord }) => {
        if (!isMounted) return;
        
        if (eventType === 'INSERT') {
          // Precisamos enriquecer com o nome do requester
          try {
            const { data: profileData } = await getProfile(newRecord.requester_id);
            const enrichedRequest = { ...newRecord, requester: profileData };
            setActiveRequests((prev) => [...prev, enrichedRequest].sort((a,b) => new Date(a.created_at) - new Date(b.created_at)));
          } catch(e) {}
        } 
        else if (eventType === 'UPDATE') {
          if (newRecord.status === 'completed' || newRecord.status === 'cancelled') {
            setActiveRequests((prev) => prev.filter(req => req.id !== newRecord.id));
          } else {
            setActiveRequests((prev) => prev.map(req => req.id === newRecord.id ? { ...req, ...newRecord } : req));
          }
        }
        else if (eventType === 'DELETE') {
          setActiveRequests((prev) => prev.filter(req => req.id !== oldRecord.id));
        }
      }
    });

    channelRef.current = channel;
    setIsConnected(true);

    return () => {
      isMounted = false;
      setIsConnected(false);
      unsubscribeFromRoom(channelRef.current);
      channelRef.current = null;
    };
  }, [roomId, resolveMessageSender, triggerTvAlert]);

  const sendChatMessage = useCallback(async (content) => {
    if (!user?.id || !roomId) return { error: { message: 'Não autorizado' } };
    const result = await sendMessage(roomId, user.id, content, 'text');
    return result;
  }, [roomId, user?.id]);

  return { messages, activeRequests, tvAlerts, isConnected, sendChatMessage };
}
