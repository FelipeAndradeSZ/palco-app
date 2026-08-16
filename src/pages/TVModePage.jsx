/**
 * TVModePage — Modo TV para Estabelecimentos
 * 
 * Rota protegida: role = venue
 * Interface fullscreen, otimizada para TVs/telões.
 * Visual premium baseado na imagem de referência: split-screen com
 * transmissão ao vivo (WebRTC), fila de pedidos em tempo real e QR code.
 */

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useRooms } from '../hooks/useRooms';
import { useAuth } from '../hooks/useAuth';
import { useRoomRealtime } from '../hooks/useRoomRealtime';
import { useRoomMediaStream } from '../hooks/useRoomMediaStream';
import { joinRoom, leaveRoom } from '../services/roomService';
import { getVenueProfile, upsertVenueProfile } from '../services/venueService';
import { createSubscriptionCheckout, getActiveSubscription } from '../services/subscriptionService';
import Badge from '../components/ui/Badge';
import LiveAlertOverlay from '../components/features/tv/LiveAlertOverlay';
import LiveStreamPlayer from '../components/features/video/LiveStreamPlayer';
import { BRAZIL_REGIONS, MUSIC_GENRES, VIBE_LEVEL_LABELS } from '../lib/constants';
import { getActiveArtists, getArtistInteractionUrl, getPrimaryArtist } from '../lib/roomArtists';

const AUDIO_BARS = [
  { height: 34, duration: 0.9 },
  { height: 72, duration: 1.1 },
  { height: 48, duration: 0.8 },
  { height: 92, duration: 1.2 },
  { height: 56, duration: 0.95 },
  { height: 82, duration: 1.05 },
  { height: 38, duration: 0.85 },
  { height: 68, duration: 1.18 },
  { height: 44, duration: 0.92 },
  { height: 96, duration: 1.15 },
  { height: 52, duration: 1.0 },
  { height: 76, duration: 0.88 },
  { height: 32, duration: 1.08 },
  { height: 64, duration: 0.98 },
  { height: 88, duration: 1.22 },
  { height: 42, duration: 0.9 },
  { height: 70, duration: 1.12 },
  { height: 54, duration: 0.86 },
  { height: 84, duration: 1.2 },
  { height: 46, duration: 0.94 },
];

export default function TVModePage() {
  const { profile } = useAuth();
  const { rooms, loading } = useRooms();
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedArtistId, setSelectedArtistId] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [venueConfig, setVenueConfig] = useState({
    preferred_genre: '',
    vibe_level: 'animado',
    interaction_level: 'medium',
    preferred_region: '',
    audience_participation: true,
    auto_switch_artists: true,
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [startingSubscription, setStartingSubscription] = useState(null);
  const [presenceRoomId, setPresenceRoomId] = useState(null);

  // Relógio atualizado a cada minuto
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  useEffect(() => {
    let cancelled = false;

    async function loadVenueConfig() {
      if (!profile?.id) return;
      const { data } = await getVenueProfile(profile.id);
      const { data: subscriptionData } = await getActiveSubscription(profile.id);
      if (!cancelled) setSubscription(subscriptionData || null);
      if (!cancelled && data) {
        setVenueConfig({
          preferred_genre: data.preferred_genre || '',
          vibe_level: data.vibe_level || 'animado',
          interaction_level: data.interaction_level || 'medium',
          preferred_region: data.preferred_region || '',
          audience_participation: data.audience_participation !== false,
          auto_switch_artists: data.auto_switch_artists !== false,
        });
      }
    }

    loadVenueConfig();

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  async function updateVenueConfig(key, value) {
    const next = { ...venueConfig, [key]: value };
    setVenueConfig(next);

    if (!profile?.id) return;
    setSavingConfig(true);
    try {
      await upsertVenueProfile(profile.id, next);
    } finally {
      setSavingConfig(false);
    }
  }

  async function startSubscription(planTier) {
    setStartingSubscription(planTier);
    try {
      await createSubscriptionCheckout(planTier, '/tv');
    } finally {
      setStartingSubscription(null);
    }
  }

  const activeRoomId = selectedRoom?.id;
  const activeRoom = rooms.find((r) => r.id === activeRoomId) || selectedRoom;
  const activeArtists = getActiveArtists(activeRoom);
  const selectedArtist = getPrimaryArtist(activeRoom, selectedArtistId);
  const recommendedRooms = rooms.filter((room) => {
    const genreOk = !venueConfig.preferred_genre || room.genre === venueConfig.preferred_genre;
    const vibeOk = !venueConfig.vibe_level || !room.vibe_level || room.vibe_level === venueConfig.vibe_level;
    return genreOk && vibeOk;
  });

  useEffect(() => {
    if (!activeRoomId || !profile?.id) return undefined;

    let cancelled = false;

    async function refreshPresence() {
      const { error } = await joinRoom(activeRoomId, profile.id, profile.role);
      if (!cancelled) setPresenceRoomId(error ? null : activeRoomId);
    }

    refreshPresence();
    const timer = setInterval(refreshPresence, 25_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      setPresenceRoomId((current) => current === activeRoomId ? null : current);
      leaveRoom(activeRoomId, profile.id);
    };
  }, [activeRoomId, profile?.id, profile?.role]);

  // Conecta ao WebSocket da sala para chat, alertas e pedidos reais em tempo real
  const { tvAlerts, activeRequests, activeBattles, battleResults } = useRoomRealtime(
    presenceRoomId === activeRoomId ? activeRoomId : null,
    {
    targetArtistId: selectedArtist?.id || null,
    }
  );

  // Conecta ao stream WebRTC (câmera + microfone) do artista
  const listenerMedia = useRoomMediaStream({
    roomId: activeRoomId,
    artistId: selectedArtist?.id,
    role: 'listener',
    enabled: Boolean(activeRoomId && selectedArtist?.id),
  });

  // Se nenhuma sala selecionada, mostra seletor de ambientes
  if (!selectedRoom) {
    return (
      <div className="min-h-screen bg-palco-black flex flex-col items-center justify-center px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-palco-gold/5 via-transparent to-transparent pointer-events-none" />
        
        <h1 className="font-display font-black text-6xl text-palco-gold mb-3 tracking-wider">
          PALCO
        </h1>
        <p className="text-palco-text-muted text-xl mb-12 text-center max-w-lg">
          Selecione um ambiente musical para exibir no telão do seu estabelecimento.
        </p>

        <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
          <Badge variant={subscription ? 'success' : 'default'}>
            Plano {subscription?.plan_tier || 'free'}
          </Badge>
          {!subscription && (
            <>
              <button
                type="button"
                onClick={() => startSubscription('basic')}
                disabled={startingSubscription !== null}
                className="rounded-xl border border-palco-gold/40 px-4 py-2 text-sm font-black text-palco-gold transition hover:bg-palco-gold hover:text-palco-black disabled:opacity-60"
              >
                {startingSubscription === 'basic' ? 'Abrindo...' : 'Assinar Basico'}
              </button>
              <button
                type="button"
                onClick={() => startSubscription('premium')}
                disabled={startingSubscription !== null}
                className="rounded-xl bg-palco-gold px-4 py-2 text-sm font-black text-palco-black transition hover:bg-palco-gold-light disabled:opacity-60"
              >
                {startingSubscription === 'premium' ? 'Abrindo...' : 'Assinar Premium'}
              </button>
            </>
          )}
        </div>

        <div className="mb-8 grid w-full max-w-5xl gap-3 rounded-3xl border border-palco-border bg-palco-card/70 p-4 backdrop-blur lg:grid-cols-5">
          <select
            value={venueConfig.preferred_genre}
            onChange={(event) => updateVenueConfig('preferred_genre', event.target.value)}
            className="rounded-xl border border-palco-border bg-palco-dark px-3 py-2 text-sm text-palco-text outline-none focus:border-palco-gold"
          >
            <option value="">Todos os generos</option>
            {MUSIC_GENRES.map((genre) => (
              <option key={genre} value={genre}>{genre}</option>
            ))}
          </select>
          <select
            value={venueConfig.vibe_level}
            onChange={(event) => updateVenueConfig('vibe_level', event.target.value)}
            className="rounded-xl border border-palco-border bg-palco-dark px-3 py-2 text-sm text-palco-text outline-none focus:border-palco-gold"
          >
            <option value="calmo">Calmo</option>
            <option value="animado">Animado</option>
            <option value="interativo">Interativo</option>
          </select>
          <select
            value={venueConfig.interaction_level}
            onChange={(event) => updateVenueConfig('interaction_level', event.target.value)}
            className="rounded-xl border border-palco-border bg-palco-dark px-3 py-2 text-sm text-palco-text outline-none focus:border-palco-gold"
          >
            <option value="low">Pouca interacao</option>
            <option value="medium">Interacao media</option>
            <option value="high">Muita interacao</option>
          </select>
          <select
            value={venueConfig.preferred_region}
            onChange={(event) => updateVenueConfig('preferred_region', event.target.value)}
            className="rounded-xl border border-palco-border bg-palco-dark px-3 py-2 text-sm text-palco-text outline-none focus:border-palco-gold"
          >
            <option value="">Todas as regioes</option>
            {BRAZIL_REGIONS.map((region) => (
              <option key={region.value} value={region.value}>{region.label}</option>
            ))}
          </select>
          <div className="flex items-center justify-center rounded-xl border border-palco-border bg-palco-dark px-3 py-2 text-xs font-bold text-palco-text-muted">
            {savingConfig ? 'Salvando...' : 'Preferencias ativas'}
          </div>
        </div>

        {loading ? (
          <p className="text-palco-text-muted text-lg">Carregando salas...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full max-w-5xl relative z-10">
            {(recommendedRooms.length > 0 ? recommendedRooms : rooms).map((room) => (
              <button
                key={room.id}
                onClick={() => {
                  setSelectedRoom(room);
                  setSelectedArtistId(null);
                }}
                className="bg-palco-card border border-palco-border rounded-2xl p-6 text-left hover:border-palco-gold/60 hover:bg-palco-card/85 transition-all duration-300 group cursor-pointer shadow-xl"
              >
                <h3 className="font-display font-bold text-xl text-palco-text group-hover:text-palco-gold transition-colors mb-2">
                  {room.name}
                </h3>
                <p className="text-palco-text-subtle text-sm mb-3">
                  {room.genre} • {VIBE_LEVEL_LABELS[room.vibe_level]}
                </p>
                <div className="flex items-center gap-2">
                  {getActiveArtists(room).length > 0 ? (
                    <Badge variant="live" pulse>{getActiveArtists(room).length} AO VIVO</Badge>
                  ) : (
                    <Badge variant="default">Aberta</Badge>
                  )}
                  <span className="text-palco-text-subtle text-xs">
                    {room.listener_count || 0} ouvintes
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const publicInteractionUrl = `${window.location.origin}${getArtistInteractionUrl(selectedRoom.id, selectedArtist?.id)}`;

  // Pedidos na fila (aceitos ou tocando)
  const acceptedRequests = activeRequests.filter(
    (req) => req.status === 'accepted' || req.status === 'playing' || req.status === 'pending'
  );
  const featuredBattle = activeBattles.find((battle) =>
    selectedArtist?.id
      ? [battle.challenger_artist_id, battle.opponent_artist_id].includes(selectedArtist.id)
      : true
  );
  const featuredBattleVotes = featuredBattle
    ? (battleResults[featuredBattle.id] || []).reduce((sum, item) => sum + Number(item.vote_count || 0), 0)
    : 0;

  return (
    <div className="min-h-screen bg-palco-black flex flex-col relative overflow-hidden select-none">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(212,168,67,0.06),transparent_60%)] pointer-events-none" />

      {/* Overlay de Alertas em Tempo Real (Popups na tela da TV) */}
      <LiveAlertOverlay alerts={tvAlerts} />

      {/* Top Header */}
      <header className="relative flex items-center justify-between px-10 h-20 border-b border-palco-border/30 bg-palco-black/40 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <span className="flex items-end gap-[3px] h-5" aria-hidden="true">
            <span className="w-[3px] h-3 rounded-full bg-palco-gold animate-pulse" />
            <span className="w-[3px] h-5 rounded-full bg-palco-gold animate-pulse" style={{ animationDelay: '0.2s' }} />
            <span className="w-[3px] h-4 rounded-full bg-palco-gold animate-pulse" style={{ animationDelay: '0.4s' }} />
          </span>
          <h1 className="font-display font-black text-2xl tracking-wider text-palco-gold">
            PALCO
          </h1>
          <span className="text-palco-border/50">|</span>
          <span className="text-palco-text-muted text-sm font-semibold uppercase tracking-wider">
            {selectedRoom.name}
          </span>
        </div>
        <div className="flex items-center gap-6">
          <Badge variant="live" pulse>AO VIVO</Badge>
          <span className="font-display text-2xl text-palco-text-muted font-bold tabular-nums">
            {timeString}
          </span>
        </div>
      </header>

      {/* Main Split-Screen Dashboard */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px] h-[calc(100vh-5rem)] p-6 gap-6 relative z-10 overflow-hidden">
        
        {/* LEFT COLUMN: Live stream video or visualizer */}
        <div className="relative h-full rounded-3xl border border-palco-border bg-palco-black/50 shadow-2xl overflow-hidden flex flex-col justify-between">
          
          {/* Main Video Stream Container */}
          <div className="absolute inset-0 h-full w-full">
            {selectedArtist ? (
              <LiveStreamPlayer
                stream={listenerMedia.remoteStream}
                status={listenerMedia.status}
                error={listenerMedia.error}
                title={selectedArtist.name}
                subtitle={selectedArtist.current_song || selectedArtist.main_genre || 'Ao vivo'}
                initial={selectedArtist.name.charAt(0).toUpperCase()}
                canStart={false}
                isStarted={true}
                showStatus={false}
                showInfo={false}
                className="absolute inset-0 h-full w-full rounded-none border-0 object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(212,168,67,0.1),transparent_40%),linear-gradient(180deg,rgba(31,33,39,0.9),rgba(5,5,6,0.98))]" />
            )}
          </div>

          {/* Floating Top Info */}
          <div className="relative p-6 flex justify-between items-start pointer-events-none">
            <div className="rounded-full bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-palco-live animate-ping" />
              <span className="text-xs font-black uppercase tracking-wider text-white">
                {selectedRoom.name}
              </span>
            </div>
            {activeArtists.length > 1 && (
              <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md p-3 max-w-xs pointer-events-auto">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-palco-gold">
                  Artistas disponíveis
                </p>
                <div className="flex flex-col gap-1.5">
                  {activeArtists.map((artist) => (
                    <button
                      key={artist.id}
                      type="button"
                      onClick={() => setSelectedArtistId(artist.id)}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${
                        selectedArtist?.id === artist.id
                          ? 'border-palco-gold bg-palco-gold/10 text-palco-gold'
                          : 'border-white/5 bg-white/[0.02] text-palco-text-muted hover:text-white'
                      }`}
                    >
                      <span className="block text-xs font-bold truncate">{artist.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Floating Bottom Singer Info & Audio Bars (Overlay) */}
          <div className="relative p-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col md:flex-row md:items-end md:justify-between gap-6 pointer-events-none">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-palco-gold/15 border-2 border-palco-gold/40 flex items-center justify-center shadow-lg shrink-0">
                {selectedArtist ? (
                  <span className="font-display font-black text-2xl text-palco-gold">
                    {selectedArtist.name.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <span className="text-2xl">🎸</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-palco-gold uppercase tracking-widest mb-0.5">TOCANDO AGORA</p>
                <h2 className="font-display font-black text-3xl text-white truncate">
                  {selectedArtist?.name || 'Aguardando Artista...'}
                </h2>
                <p className="text-sm text-palco-text-muted truncate mt-0.5">
                  {selectedArtist?.current_song 
                    ? `Música: ${selectedArtist.current_song}` 
                    : (selectedArtist?.main_genre || 'Música ao vivo')}
                </p>
              </div>
            </div>

            {/* Audio Waves, Duration & Listeners */}
            <div className="flex flex-col items-start md:items-end gap-3 shrink-0">
              <div className="flex items-end gap-1 h-9">
                {AUDIO_BARS.map((bar, i) => (
                  <div
                    key={i}
                    className="w-1 bg-palco-gold/70 rounded-full"
                    style={{
                      height: selectedArtist ? `${bar.height}%` : '20%',
                      animation: selectedArtist ? `pulse ${bar.duration}s ease-in-out infinite` : 'none',
                      animationDelay: `${i * 0.05}s`
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-4 text-xs font-bold text-palco-text-muted">
                <span className="tabular-nums">02:35</span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  👥 {activeRoom.listener_count || 0} ouvintes
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Pedidos list & QR Code Area */}
        <div className="grid grid-rows-[1fr_auto] gap-6 h-full overflow-hidden">
          
          {/* BOX 1: Pedidos List */}
          <div className="rounded-3xl border border-palco-border bg-palco-card/45 backdrop-blur-sm p-6 flex flex-col overflow-hidden">
            {featuredBattle && (
              <div className="mb-4 rounded-2xl border border-palco-gold/35 bg-palco-gold/10 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-palco-gold">
                  Batalha musical
                </p>
                <h3 className="mt-2 font-display text-xl font-black text-white">
                  {featuredBattle.song_title}
                </h3>
                <p className="mt-1 text-sm text-palco-text-muted">
                  {featuredBattle.status} - {featuredBattleVotes} votos
                </p>
              </div>
            )}
            <h3 className="font-display font-black text-lg text-palco-text mb-4 tracking-wider uppercase border-b border-palco-border/30 pb-3 flex items-center gap-2">
              <span>📋</span> Pedidos na Fila
            </h3>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
              {acceptedRequests.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-palco-text-subtle">
                  <span className="text-3xl mb-2">🎸</span>
                  <p className="text-sm font-semibold">Nenhum pedido tocando</p>
                  <p className="text-xs mt-1">Escaneie o QR Code abaixo para pedir sua música!</p>
                </div>
              ) : (
                acceptedRequests.map((req) => {
                  const requesterName = req.requester?.name || 'Ouvinte';
                  const initials = requesterName
                    .split(' ')
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <div
                      key={req.id}
                      className={`p-4 rounded-2xl border transition-all duration-300 ${
                        req.status === 'playing'
                          ? 'border-palco-gold bg-palco-gold/10'
                          : 'border-palco-border/50 bg-black/30'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-palco-gold/20 border border-palco-gold/30 flex items-center justify-center text-xs font-black text-palco-gold shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold text-palco-text-muted truncate">
                              {requesterName} pediu
                            </p>
                            <span className="text-xs font-bold text-palco-success shrink-0">
                              R$ {Number(req.bounty_value).toFixed(0)}
                            </span>
                          </div>
                          <p className={`font-display text-sm font-black mt-1 ${req.status === 'playing' ? 'text-palco-gold' : 'text-palco-text'}`}>
                            {req.song_title}
                          </p>
                          {req.dedication && (
                            <p className="text-xs text-palco-text-muted italic mt-1.5 border-l border-palco-gold/45 pl-2 truncate">
                              "{req.dedication}"
                            </p>
                          )}
                          {req.status === 'playing' && (
                            <div className="mt-2 flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-palco-gold animate-ping" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-palco-gold">
                                Tocando agora
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* BOX 2: QR Code and Instructions */}
          <div className="rounded-3xl border border-palco-border bg-palco-card/45 backdrop-blur-sm p-6 flex flex-col items-center text-center">
            <h4 className="font-display font-black text-sm uppercase tracking-widest text-palco-text-subtle mb-3">
              Interaja Agora
            </h4>
            
            <div className="bg-white p-3 rounded-2xl shadow-2xl mb-4 border border-palco-border/30">
              <QRCodeSVG 
                value={publicInteractionUrl}
                size={110}
                bgColor="#ffffff"
                fgColor="#000000"
                level="H"
                includeMargin={false}
              />
            </div>
            
            <p className="font-display font-extrabold text-sm text-palco-gold tracking-wide px-3">
              Escaneie o QR Code e peça sua música!
            </p>
            
            {/* Features Bullet List */}
            <div className="mt-4 w-full grid grid-cols-2 gap-x-4 gap-y-2 text-left text-xs font-semibold text-palco-text-muted border-t border-palco-border/30 pt-4">
              <div className="flex items-center gap-1.5">
                <span>🎵</span> Peça músicas
              </div>
              <div className="flex items-center gap-1.5">
                <span>❤️</span> Dedique para alguém
              </div>
              <div className="flex items-center gap-1.5">
                <span>💰</span> Envie sua gorjeta
              </div>
              <div className="flex items-center gap-1.5">
                <span>💬</span> Participe do chat
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Control Button (Bottom Right) to escape fullscreen/return to Selector */}
      <button
        onClick={() => {
          setSelectedRoom(null);
          setSelectedArtistId(null);
        }}
        className="absolute top-5 right-8 z-50 bg-palco-card/85 border border-palco-border rounded-full p-2.5 text-palco-text-subtle hover:text-palco-text hover:border-palco-gold/50 transition-all opacity-40 hover:opacity-100 cursor-pointer shadow-lg"
        title="Trocar de Sala"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
