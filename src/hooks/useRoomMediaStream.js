import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
};

function getListenerId() {
  const key = '@palco/listener_id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(key, next);
  return next;
}

export function useRoomMediaStream({ roomId, artistId, role, enabled }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const channelRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const listenerPeerRef = useRef(null);
  const artistPeersRef = useRef(new Map());
  const listenerIdRef = useRef(null);
  const sessionIdRef = useRef(crypto.randomUUID());

  const sendSignal = useCallback(async (event, payload) => {
    if (!channelRef.current) return;
    await channelRef.current.send({
      type: 'broadcast',
      event,
      payload: {
        ...payload,
        senderSessionId: sessionIdRef.current,
      },
    });
  }, []);

  const closeAllPeers = useCallback(() => {
    if (listenerPeerRef.current) {
      listenerPeerRef.current.close();
      listenerPeerRef.current = null;
    }

    artistPeersRef.current.forEach((peer) => peer.close());
    artistPeersRef.current.clear();
  }, []);

  const stopLocalStream = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
  }, []);

  const clearRemoteStream = useCallback(() => {
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }
    setRemoteStream(null);
  }, []);

  useEffect(() => {
    if (!enabled || !roomId || !artistId || !role) {
      return undefined;
    }

    let cancelled = false;
    const channel = supabase.channel(`media:${roomId}:${artistId}`);
    channelRef.current = channel;

    if (role === 'listener') {
      stopLocalStream();
    }

    Promise.resolve().then(() => {
      if (!cancelled) {
        setStatus('connecting');
        setError(null);
      }
    });

    async function ensureArtistMedia() {
      if (role !== 'artist') {
        throw new Error('Apenas artistas podem publicar camera e microfone.');
      }

      if (localStreamRef.current) return localStreamRef.current;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      localStreamRef.current = stream;
      if (!cancelled) setLocalStream(stream);
      return stream;
    }

    async function answerListenerOffer(payload) {
      if (payload.senderSessionId === sessionIdRef.current) return;
      if (role !== 'artist' || payload.artistId !== artistId) return;

      try {
        const stream = await ensureArtistMedia();
        const peer = new RTCPeerConnection(RTC_CONFIG);
        artistPeersRef.current.set(payload.listenerId, peer);

        stream.getTracks().forEach((track) => peer.addTrack(track, stream));

        peer.onicecandidate = (event) => {
          if (!event.candidate) return;
          sendSignal('ice-candidate', {
            from: 'artist',
            artistId,
            listenerId: payload.listenerId,
            candidate: event.candidate,
          });
        };

        peer.onconnectionstatechange = () => {
          if (peer.connectionState === 'connected') setStatus('live');
          if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
            peer.close();
            artistPeersRef.current.delete(payload.listenerId);
          }
        };

        await peer.setRemoteDescription(new RTCSessionDescription(payload.offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        await sendSignal('artist-answer', {
          artistId,
          listenerId: payload.listenerId,
          answer,
        });
      } catch (err) {
        console.error('[PALCO media] erro ao responder listener:', err);
        setError('Não foi possível iniciar a transmissão do artista.');
        setStatus('error');
      }
    }

    async function startListenerOffer() {
      if (role !== 'listener') return;

      listenerIdRef.current = getListenerId();
      const peer = new RTCPeerConnection(RTC_CONFIG);
      listenerPeerRef.current = peer;

      peer.addTransceiver('audio', { direction: 'recvonly' });
      peer.addTransceiver('video', { direction: 'recvonly' });

      peer.ontrack = (event) => {
        const incomingStream = event.streams[0] || remoteStreamRef.current || new MediaStream();
        if (!event.streams[0] && !incomingStream.getTracks().some((track) => track.id === event.track.id)) {
          incomingStream.addTrack(event.track);
        }
        remoteStreamRef.current = incomingStream;
        setRemoteStream(incomingStream);
      };

      peer.onicecandidate = (event) => {
        if (!event.candidate) return;
        sendSignal('ice-candidate', {
          from: 'listener',
          artistId,
          listenerId: listenerIdRef.current,
          candidate: event.candidate,
        });
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'connected') setStatus('live');
        if (peer.connectionState === 'failed') {
          setStatus('error');
          setError('Não foi possível conectar ao áudio do artista.');
        }
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      peer.getSenders().forEach((sender) => {
        if (sender.track) sender.track.stop();
        sender.replaceTrack(null).catch(() => {});
      });

      await sendSignal('listener-offer', {
        artistId,
        listenerId: listenerIdRef.current,
        offer,
      });
      setStatus('waiting_artist');
    }

    channel
      .on('broadcast', { event: 'listener-offer' }, ({ payload }) => {
        if (payload.senderSessionId === sessionIdRef.current) return;
        answerListenerOffer(payload);
      })
      .on('broadcast', { event: 'artist-answer' }, async ({ payload }) => {
        if (payload.senderSessionId === sessionIdRef.current) return;
        if (role !== 'listener') return;
        if (payload.artistId !== artistId || payload.listenerId !== listenerIdRef.current) return;
        try {
          await listenerPeerRef.current?.setRemoteDescription(new RTCSessionDescription(payload.answer));
          setStatus('live');
        } catch (err) {
          console.error('[PALCO media] erro ao receber resposta:', err);
          setError('Não foi possível receber a transmissão.');
          setStatus('error');
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.senderSessionId === sessionIdRef.current) return;
        if (payload.artistId !== artistId) return;

        try {
          if (role === 'listener' && payload.from === 'artist' && payload.listenerId === listenerIdRef.current) {
            await listenerPeerRef.current?.addIceCandidate(new RTCIceCandidate(payload.candidate));
          }

          if (role === 'artist' && payload.from === 'listener') {
            await artistPeersRef.current.get(payload.listenerId)?.addIceCandidate(new RTCIceCandidate(payload.candidate));
          }
        } catch (err) {
          console.error('[PALCO media] erro em ICE candidate:', err);
        }
      })
      .subscribe(async (subscriptionStatus) => {
        if (cancelled) return;
        if (subscriptionStatus !== 'SUBSCRIBED') return;

        try {
          if (role === 'artist') {
            await ensureArtistMedia();
            setStatus('ready');
          } else {
            await startListenerOffer();
          }
        } catch (err) {
          console.error('[PALCO media] erro ao iniciar mídia:', err);
          setError(role === 'artist'
            ? 'Permita câmera e microfone para transmitir.'
            : 'Não foi possível conectar ao artista. Tente novamente.'
          );
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
      closeAllPeers();
      stopLocalStream();
      clearRemoteStream();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [artistId, clearRemoteStream, closeAllPeers, enabled, role, roomId, sendSignal, stopLocalStream]);

  return {
    localStream,
    remoteStream,
    status,
    error,
  };
}
