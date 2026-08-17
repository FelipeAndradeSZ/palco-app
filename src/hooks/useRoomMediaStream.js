import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  MAX_P2P_LISTENERS,
  appendBoundedCandidate,
  isValidIceCandidate,
  isValidSessionDescription,
  isValidSignalId,
} from '../lib/webrtcSignals';

const TURN_URL = import.meta.env.VITE_TURN_URL;
const TURN_USERNAME = import.meta.env.VITE_TURN_USERNAME;
const TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL;

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    ...(TURN_URL && TURN_USERNAME && TURN_CREDENTIAL
      ? [{
          urls: TURN_URL.split(',').map((url) => url.trim()).filter(Boolean),
          username: TURN_USERNAME,
          credential: TURN_CREDENTIAL,
        }]
      : []),
  ],
  iceCandidatePoolSize: 4,
};

function optimizeSdp(sdp) {
  let lines = sdp.split('\r\n');
  let inVideoSection = false;
  let newLines = [];

  for (let line of lines) {
    if (line.startsWith('a=fmtp:') && line.includes('useinbandfec=1')) {
      line = line.replace('useinbandfec=1', 'useinbandfec=1;maxaveragebitrate=256000;stereo=1;sprop-stereo=1;cbr=1');
    }

    if (line.startsWith('m=video')) {
      inVideoSection = true;
    } else if (line.startsWith('m=')) {
      inVideoSection = false;
    }

    newLines.push(line);

    if (inVideoSection && line.startsWith('c=IN')) {
      newLines.push('b=AS:2500');
      inVideoSection = false;
    }
  }
  return newLines.join('\r\n');
}

export function useRoomMediaStream({ roomId, artistId, role, enabled }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const listenerPeerRef = useRef(null);
  const artistPeersRef = useRef(new Map());
  const iceQueuesRef = useRef(new Map());
  const listenerIdRef = useRef(null);
  const listenerOfferIdRef = useRef(null);
  const sessionIdRef = useRef(crypto.randomUUID());

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
      setStatus('idle');
      setError(null);
      setLocalStream(null);
      setRemoteStream(null);
      return undefined;
    }

    let cancelled = false;
    let listenerRetryTimer = null;
    let listenerRetryCount = 0;
    const iceQueues = iceQueuesRef.current;

    async function sendSignal(event, payload, recipientId = null) {
      const { error: signalError } = await supabase
        .from('webrtc_signals')
        .insert({
          room_id: roomId,
          artist_id: artistId,
          recipient_id: role === 'artist' ? recipientId : artistId,
          sender_role: role,
          event,
          listener_id: payload.listenerId || null,
          offer_id: payload.offerId || null,
          sender_session_id: sessionIdRef.current,
          payload,
        });

      if (signalError) throw signalError;
    }

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
          autoGainControl: false,
          channelCount: 1,
        },
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      stream.getAudioTracks().forEach((track) => {
        track.contentHint = 'music';
      });

      stream.getTracks().forEach((track) => {
        track.onended = () => {
          if (cancelled || localStreamRef.current !== stream) return;
          setError('Camera ou microfone foi desconectado. Inicie a transmissao novamente.');
          setStatus('error');
          closeAllPeers();
          stopLocalStream();
          void sendSignal('artist-leave', { artistId }).catch(() => {});
        };
      });

      localStreamRef.current = stream;
      if (!cancelled) setLocalStream(stream);
      return stream;
    }

    async function answerListenerOffer(payload) {
      if (!payload || !isValidSignalId(payload.listenerId) || !isValidSignalId(payload.offerId)) return;
      if (payload.senderSessionId === sessionIdRef.current) return;
      if (role !== 'artist' || payload.artistId !== artistId) return;

      if (!isValidSessionDescription(payload.offer, 'offer')) {
        console.warn('[PALCO media] oferta de ouvinte invalida ignorada.');
        return;
      }

      const existingPeer = artistPeersRef.current.get(payload.listenerId);
      if (!existingPeer && artistPeersRef.current.size >= MAX_P2P_LISTENERS) {
        await sendSignal('stream-unavailable', {
          artistId,
          listenerId: payload.listenerId,
          offerId: payload.offerId,
          reason: 'capacity',
        }, payload.senderProfileId);
        return;
      }

      let stream;
      try {
        stream = await ensureArtistMedia();
      } catch (err) {
        console.error('[PALCO media] erro ao acessar camera e microfone:', err);
        if (!cancelled) {
          setError('Nao foi possivel iniciar camera e microfone do artista.');
          setStatus('error');
        }
        return;
      }

      try {
        // Safely close pre-existing peer connection for this listener
        if (existingPeer) {
          try {
            existingPeer.close();
          } catch (e) {
            console.error('[PALCO media] erro ao fechar peer anterior do artista para listener:', payload.listenerId, e);
          }
        }

        const peer = new RTCPeerConnection(RTC_CONFIG);
        peer.palcoOfferId = payload.offerId;
        peer.palcoListenerProfileId = payload.senderProfileId;
        artistPeersRef.current.set(payload.listenerId, peer);

        peer.onicecandidate = (event) => {
          if (!event.candidate) return;
          void sendSignal('ice-candidate', {
            from: 'artist',
            artistId,
            listenerId: payload.listenerId,
            offerId: payload.offerId,
            candidate: event.candidate,
          }, payload.senderProfileId).catch((err) => {
            console.error('[PALCO media] erro ao enviar candidato do artista:', err);
          });
        };

        peer.onconnectionstatechange = () => {
          if (peer.connectionState === 'connected') setStatus('live');
          if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
            peer.close();
            artistPeersRef.current.delete(payload.listenerId);
          }
        };

        // Unified Plan: remote description MUST be set before calling addTrack so the browser
        // associates the local track to the correct remote transceiver.
        await peer.setRemoteDescription(new RTCSessionDescription(payload.offer));

        stream.getTracks().forEach((track) => peer.addTrack(track, stream));

        // Flush queued candidates
        const listenerQueueKey = `${payload.listenerId}:${payload.offerId}`;
        const queue = iceQueues.get(listenerQueueKey) || [];
        for (const cand of queue) {
          try {
            await peer.addIceCandidate(new RTCIceCandidate(cand));
          } catch (err) {
            console.error('[PALCO media] erro ao esvaziar fila de cand do listener:', err);
          }
        }
        iceQueues.delete(listenerQueueKey);

        const answer = await peer.createAnswer();
        const optimizedAnswer = new RTCSessionDescription({
          type: answer.type,
          sdp: optimizeSdp(answer.sdp),
        });
        await peer.setLocalDescription(optimizedAnswer);

        await sendSignal('artist-answer', {
          artistId,
          listenerId: payload.listenerId,
          offerId: payload.offerId,
          answer: optimizedAnswer,
        }, payload.senderProfileId);
      } catch (err) {
        console.error('[PALCO media] erro ao responder listener:', err);
        const failedPeer = artistPeersRef.current.get(payload.listenerId);
        failedPeer?.close();
        artistPeersRef.current.delete(payload.listenerId);
        iceQueues.delete(`${payload.listenerId}:${payload.offerId}`);
      }
    }

    async function startListenerOffer() {
      if (role !== 'listener') return;

      const activePeer = listenerPeerRef.current;
      if (activePeer && ['new', 'connecting', 'connected'].includes(activePeer.connectionState)) {
        return;
      }

      listenerIdRef.current ||= crypto.randomUUID();
      const offerId = crypto.randomUUID();
      listenerOfferIdRef.current = offerId;
      [...iceQueues.keys()]
        .filter((key) => key.startsWith('artist:'))
        .forEach((key) => iceQueues.delete(key));

      // Safely close pre-existing listener peer connection
      if (listenerPeerRef.current) {
        try {
          listenerPeerRef.current.close();
        } catch (e) {
          console.error('[PALCO media] erro ao fechar peer anterior do listener:', e);
        }
      }

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
        void sendSignal('ice-candidate', {
          from: 'listener',
          artistId,
          listenerId: listenerIdRef.current,
          offerId,
          candidate: event.candidate,
        }).catch((err) => {
          console.error('[PALCO media] erro ao enviar candidato do ouvinte:', err);
        });
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'connected') {
          listenerRetryCount = 0;
          setError(null);
          setStatus('live');
        }

        if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
          scheduleListenerRetry(peer);
        }
      };

      const offer = await peer.createOffer();
      const optimizedOffer = new RTCSessionDescription({
        type: offer.type,
        sdp: optimizeSdp(offer.sdp),
      });
      await peer.setLocalDescription(optimizedOffer);

      peer.getSenders().forEach((sender) => {
        if (sender.track) sender.track.stop();
        sender.replaceTrack(null).catch(() => {});
      });

      await sendSignal('listener-offer', {
        artistId,
        listenerId: listenerIdRef.current,
        offerId,
        offer: optimizedOffer,
      });
      setStatus('waiting_artist');
    }

    function scheduleListenerRetry(peer) {
      if (cancelled || role !== 'listener' || listenerRetryTimer) return;

      const failedState = peer?.connectionState || 'failed';
      const delay = failedState === 'disconnected' ? 2500 : Math.min(1000 * (2 ** listenerRetryCount), 8000);
      setStatus('reconnecting');
      setError(null);

      listenerRetryTimer = setTimeout(async () => {
        listenerRetryTimer = null;
        if (cancelled || peer?.connectionState === 'connected') return;

        if (listenerRetryCount >= 4) {
          setStatus('error');
          setError('A conexão com o artista caiu. Toque em tentar novamente.');
          return;
        }

        listenerRetryCount += 1;
        try {
          await startListenerOffer();
        } catch (err) {
          console.error('[PALCO media] erro ao reconectar ouvinte:', err);
          scheduleListenerRetry(listenerPeerRef.current || peer);
        }
      }, delay);
    }

    async function startListenerSafely() {
      try {
        await startListenerOffer();
      } catch (err) {
        console.error('[PALCO media] erro ao iniciar ouvinte:', err);
        scheduleListenerRetry(listenerPeerRef.current);
      }
    }

    async function handleSignalRecord(signal) {
      if (!signal || signal.artist_id !== artistId) return;

      const payload = {
        ...(signal.payload || {}),
        artistId: signal.artist_id,
        listenerId: signal.listener_id,
        offerId: signal.offer_id,
        senderSessionId: signal.sender_session_id,
        senderProfileId: signal.sender_id,
        from: signal.sender_role,
      };

      if (payload.senderSessionId === sessionIdRef.current) return;

      if (signal.event === 'listener-offer') {
        await answerListenerOffer(payload);
        return;
      }

      if (signal.event === 'listener-leave') {
        if (role !== 'artist' || !isValidSignalId(payload.listenerId)) return;
        const peer = artistPeersRef.current.get(payload.listenerId);
        if (peer) {
          peer.close();
          artistPeersRef.current.delete(payload.listenerId);
        }
        return;
      }

      if (signal.event === 'artist-ready') {
        if (role === 'listener') await startListenerSafely();
        return;
      }

      if (signal.event === 'artist-leave') {
        if (role !== 'listener') return;
        clearTimeout(listenerRetryTimer);
        listenerRetryTimer = null;
        listenerRetryCount = 0;
        clearRemoteStream();
        if (listenerPeerRef.current) {
          try {
            listenerPeerRef.current.close();
          } catch {
            // Peer was already closed by the browser.
          }
          listenerPeerRef.current = null;
        }
        listenerOfferIdRef.current = null;
        setStatus('waiting_artist');
        return;
      }

      if (signal.event === 'artist-answer') {
        if (role !== 'listener' || !isValidSessionDescription(payload.answer, 'answer')) return;
        if (!isValidSignalId(payload.offerId) || payload.offerId !== listenerOfferIdRef.current) return;
        if (payload.listenerId !== listenerIdRef.current) return;
        try {
          await listenerPeerRef.current?.setRemoteDescription(new RTCSessionDescription(payload.answer));
          const artistQueueKey = `artist:${payload.offerId}`;
          const queue = iceQueues.get(artistQueueKey) || [];
          for (const cand of queue) {
            try {
              await listenerPeerRef.current?.addIceCandidate(new RTCIceCandidate(cand));
            } catch (err) {
              console.error('[PALCO media] erro ao esvaziar fila de cand do artista:', err);
            }
          }
          iceQueues.delete(artistQueueKey);
        } catch (err) {
          console.error('[PALCO media] erro ao receber resposta:', err);
          setError('Nao foi possivel receber a transmissao.');
          setStatus('error');
        }
        return;
      }

      if (signal.event === 'stream-unavailable') {
        if (role !== 'listener'
          || payload.listenerId !== listenerIdRef.current
          || payload.offerId !== listenerOfferIdRef.current) return;
        clearTimeout(listenerRetryTimer);
        listenerRetryTimer = null;
        setError('A transmissao atingiu o limite temporario de ouvintes. Tente novamente em instantes.');
        setStatus('error');
        return;
      }

      if (signal.event !== 'ice-candidate'
        || !isValidSignalId(payload.listenerId)
        || !isValidSignalId(payload.offerId)
        || !isValidIceCandidate(payload.candidate)) return;

      const candidate = payload.candidate;
      try {
        if (role === 'listener'
          && payload.from === 'artist'
          && payload.listenerId === listenerIdRef.current
          && payload.offerId === listenerOfferIdRef.current) {
          const peer = listenerPeerRef.current;
          if (peer && peer.remoteDescription) {
            await peer.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            const artistQueueKey = `artist:${payload.offerId}`;
            const queue = iceQueues.get(artistQueueKey) || [];
            iceQueues.set(artistQueueKey, appendBoundedCandidate(queue, candidate));
          }
        }

        if (role === 'artist' && payload.from === 'listener') {
          const peer = artistPeersRef.current.get(payload.listenerId);
          if (peer?.palcoOfferId !== payload.offerId) return;
          if (peer && peer.remoteDescription) {
            await peer.addIceCandidate(new RTCIceCandidate(candidate));
          } else if (peer) {
            const listenerQueueKey = `${payload.listenerId}:${payload.offerId}`;
            const queue = iceQueues.get(listenerQueueKey) || [];
            iceQueues.set(listenerQueueKey, appendBoundedCandidate(queue, candidate));
          }
        }
      } catch (err) {
        console.error('[PALCO media] erro em ICE candidate:', err);
      }
    }

    const receiveChannel = supabase
      .channel(`webrtc-signals:${roomId}:${artistId}:${sessionIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webrtc_signals',
          filter: `artist_id=eq.${artistId}`,
        },
        ({ new: signal }) => {
          void handleSignalRecord(signal).catch((err) => {
            console.error('[PALCO media] erro ao processar sinal:', err);
          });
        }
      );

    let mediaStarted = false;

    async function handleSubscription(subscriptionStatus) {
        if (cancelled) return;
        if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(subscriptionStatus)) {
          setError('A conexao em tempo real com esta sala falhou. Entre novamente.');
          setStatus('error');
          return;
        }
        if (subscriptionStatus !== 'SUBSCRIBED' || mediaStarted) return;
        mediaStarted = true;
        let artistMediaReady = false;

        try {
          if (role === 'artist') {
            await ensureArtistMedia();
            artistMediaReady = true;
            setStatus('ready');
            await sendSignal('artist-ready', { artistId });
          } else {
            await startListenerSafely();
          }
        } catch (err) {
          console.error('[PALCO media] erro ao iniciar mídia:', err);
          setError(role === 'artist'
            ? artistMediaReady
              ? 'Nao foi possivel conectar a transmissao com esta sala.'
              : 'Permita câmera e microfone para transmitir.'
            : 'Não foi possível conectar ao artista. Tente novamente.'
          );
          setStatus('error');
        }
    }

    receiveChannel.subscribe((statusValue) => {
      void handleSubscription(statusValue);
    });

    return () => {
      cancelled = true;
      clearTimeout(listenerRetryTimer);
      if (mediaStarted && role === 'listener' && listenerIdRef.current) {
        sendSignal('listener-leave', {
          artistId,
          listenerId: listenerIdRef.current,
        }).catch(() => {});
      } else if (mediaStarted && role === 'artist') {
        sendSignal('artist-leave', {
          artistId,
        }).catch(() => {});
      }
      closeAllPeers();
      listenerOfferIdRef.current = null;
      stopLocalStream();
      clearRemoteStream();
      iceQueues.clear();
      supabase.removeChannel(receiveChannel);
    };
  }, [artistId, clearRemoteStream, closeAllPeers, enabled, role, roomId, stopLocalStream]);

  return {
    localStream,
    remoteStream,
    status,
    error,
  };
}
