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
  const channelRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const listenerPeerRef = useRef(null);
  const artistPeersRef = useRef(new Map());
  const iceQueuesRef = useRef(new Map());
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
      setStatus('idle');
      setError(null);
      setLocalStream(null);
      setRemoteStream(null);
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
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          latency: 0,
          channelCount: 2,
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

        // Safely close pre-existing peer connection for this listener
        const existingPeer = artistPeersRef.current.get(payload.listenerId);
        if (existingPeer) {
          try {
            existingPeer.close();
          } catch (e) {
            console.error('[PALCO media] erro ao fechar peer anterior do artista para listener:', payload.listenerId, e);
          }
        }

        const peer = new RTCPeerConnection(RTC_CONFIG);
        artistPeersRef.current.set(payload.listenerId, peer);

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

        // Unified Plan: remote description MUST be set before calling addTrack so the browser
        // associates the local track to the correct remote transceiver.
        await peer.setRemoteDescription(new RTCSessionDescription(payload.offer));

        stream.getTracks().forEach((track) => peer.addTrack(track, stream));

        // Flush queued candidates
        const queue = iceQueuesRef.current.get(payload.listenerId) || [];
        for (const cand of queue) {
          try {
            await peer.addIceCandidate(new RTCIceCandidate(cand));
          } catch (err) {
            console.error('[PALCO media] erro ao esvaziar fila de cand do listener:', err);
          }
        }
        iceQueuesRef.current.delete(payload.listenerId);

        const answer = await peer.createAnswer();
        const optimizedAnswer = new RTCSessionDescription({
          type: answer.type,
          sdp: optimizeSdp(answer.sdp),
        });
        await peer.setLocalDescription(optimizedAnswer);

        await sendSignal('artist-answer', {
          artistId,
          listenerId: payload.listenerId,
          answer: optimizedAnswer,
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
        offer: optimizedOffer,
      });
      setStatus('waiting_artist');
    }

    channel
      .on('broadcast', { event: 'listener-offer' }, ({ payload }) => {
        if (payload.senderSessionId === sessionIdRef.current) return;
        answerListenerOffer(payload);
      })
      .on('broadcast', { event: 'listener-leave' }, ({ payload }) => {
        if (payload.senderSessionId === sessionIdRef.current) return;
        if (role !== 'artist') return;
        const peer = artistPeersRef.current.get(payload.listenerId);
        if (peer) {
          peer.close();
          artistPeersRef.current.delete(payload.listenerId);
        }
      })
      .on('broadcast', { event: 'artist-ready' }, ({ payload }) => {
        if (payload.senderSessionId === sessionIdRef.current) return;
        if (role !== 'listener') return;
        if (payload.artistId !== artistId) return;
        console.log('[PALCO media] artista ficou pronto para transmitir, iniciando offer...');
        startListenerOffer();
      })
      .on('broadcast', { event: 'artist-leave' }, ({ payload }) => {
        if (payload.senderSessionId === sessionIdRef.current) return;
        if (role !== 'listener') return;
        if (payload.artistId !== artistId) return;
        console.log('[PALCO media] artista encerrou transmissão, limpando conexão...');
        clearRemoteStream();
        if (listenerPeerRef.current) {
          try {
            listenerPeerRef.current.close();
          } catch (e) {}
          listenerPeerRef.current = null;
        }
        setStatus('waiting_artist');
      })
      .on('broadcast', { event: 'artist-answer' }, async ({ payload }) => {
        if (payload.senderSessionId === sessionIdRef.current) return;
        if (role !== 'listener') return;
        if (payload.artistId !== artistId || payload.listenerId !== listenerIdRef.current) return;
        try {
          await listenerPeerRef.current?.setRemoteDescription(new RTCSessionDescription(payload.answer));
          setStatus('live');

          // Flush queued candidates
          const queue = iceQueuesRef.current.get('artist') || [];
          for (const cand of queue) {
            try {
              await listenerPeerRef.current?.addIceCandidate(new RTCIceCandidate(cand));
            } catch (err) {
              console.error('[PALCO media] erro ao esvaziar fila de cand do artista:', err);
            }
          }
          iceQueuesRef.current.delete('artist');
        } catch (err) {
          console.error('[PALCO media] erro ao receber resposta:', err);
          setError('Não foi possível receber a transmissão.');
          setStatus('error');
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.senderSessionId === sessionIdRef.current) return;
        if (payload.artistId !== artistId) return;

        const candidate = payload.candidate;

        try {
          if (role === 'listener' && payload.from === 'artist' && payload.listenerId === listenerIdRef.current) {
            const peer = listenerPeerRef.current;
            if (peer && peer.remoteDescription) {
              await peer.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
              const queue = iceQueuesRef.current.get('artist') || [];
              queue.push(candidate);
              iceQueuesRef.current.set('artist', queue);
            }
          }

          if (role === 'artist' && payload.from === 'listener') {
            const peer = artistPeersRef.current.get(payload.listenerId);
            if (peer && peer.remoteDescription) {
              await peer.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
              const queue = iceQueuesRef.current.get(payload.listenerId) || [];
              queue.push(candidate);
              iceQueuesRef.current.set(payload.listenerId, queue);
            }
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
            // Notify any active waiting listeners that the stream is ready
            sendSignal('artist-ready', { artistId });
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
      if (role === 'listener' && listenerIdRef.current) {
        sendSignal('listener-leave', {
          artistId,
          listenerId: listenerIdRef.current,
        }).catch(() => {});
      } else if (role === 'artist') {
        sendSignal('artist-leave', {
          artistId,
        }).catch(() => {});
      }
      closeAllPeers();
      stopLocalStream();
      clearRemoteStream();
      iceQueuesRef.current.clear();
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
