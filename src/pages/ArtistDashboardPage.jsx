import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useRooms } from '../hooks/useRooms';
import { useRoomRealtime } from '../hooks/useRoomRealtime';
import { useRoomMediaStream } from '../hooks/useRoomMediaStream';
import { updateRoomArtist } from '../services/roomService';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ArtistRequestQueue from '../components/features/bounty/ArtistRequestQueue';
import ChatBox from '../components/features/chat/ChatBox';
import LocalCamera from '../components/features/video/LocalCamera';
import { QUALITY_TIER_LABELS } from '../lib/constants';
import { getActiveArtists, roomHasArtist } from '../lib/roomArtists';

export default function ArtistDashboardPage() {
  const { profile } = useAuth();
  const { rooms, loading: roomsLoading, refetch: refetchRooms } = useRooms();
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const assignedRoomId = useMemo(() => {
    if (!profile?.id) return null;
    return rooms.find((room) => roomHasArtist(room, profile.id))?.id || null;
  }, [profile, rooms]);

  const activeRoomId = selectedRoomId || assignedRoomId;
  const activeRoom = rooms.find((room) => room.id === activeRoomId);
  const { activeRequests, messages, isConnected, sendChatMessage } = useRoomRealtime(activeRoomId, {
    targetArtistId: profile?.id || null,
  });
  const mediaStream = useRoomMediaStream({
    roomId: activeRoomId,
    artistId: profile?.id,
    role: 'artist',
    enabled: Boolean(activeRoomId && profile?.id),
  });
  const artistDetails = profile?.artist_details?.[0] || profile?.artist_details || {};
  const tierLabel = QUALITY_TIER_LABELS[artistDetails.quality_tier] || 'Bronze';

  const handleGoLive = async (roomId) => {
    setIsProcessing(true);
    try {
      await updateRoomArtist(roomId, profile.id);
      setSelectedRoomId(roomId);
      await refetchRooms();
    } catch (err) {
      console.error('Erro ao entrar ao vivo', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStopLive = async () => {
    if (!activeRoomId) return;
    setIsProcessing(true);
    try {
      await updateRoomArtist(activeRoomId, null, profile.id);
      setSelectedRoomId(null);
      await refetchRooms();
    } catch (err) {
      console.error('Erro ao sair do ar', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Badge variant={activeRoomId ? 'live' : 'default'} pulse={!!activeRoomId}>
              {activeRoomId ? 'AO VIVO' : 'OFFLINE'}
            </Badge>
            <Badge variant="tier">{tierLabel}</Badge>
          </div>
          <h1 className="font-display text-3xl font-black text-palco-text">
            Painel do artista
          </h1>
          <p className="mt-1 text-palco-text-muted">
            Entre em uma sala, transmita e controle pedidos sem editar perfil toda hora.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/profile"
            className="rounded-xl border border-palco-border px-4 py-2 text-sm font-bold text-palco-text-muted no-underline transition hover:border-palco-gold/50 hover:text-palco-gold"
          >
            Editar perfil
          </Link>
          {activeRoomId && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleStopLive}
              loading={isProcessing}
            >
              Encerrar show
            </Button>
          )}
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <div className="p-5">
            <p className="mb-1 text-sm text-palco-text-subtle">Genero</p>
            <p className="truncate font-display text-xl font-bold text-palco-text">
              {artistDetails.main_genre || '-'}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="mb-1 text-sm text-palco-text-subtle">Avaliacao</p>
            <p className="font-display text-xl font-bold text-palco-text">
              {Number(artistDetails.rating || 0).toFixed(1)}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="mb-1 text-sm text-palco-text-subtle">Horas ao vivo</p>
            <p className="font-display text-xl font-bold text-palco-text">
              {artistDetails.total_hours_streamed || 0}h
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="mb-1 text-sm text-palco-text-subtle">Sala atual</p>
            <p className="truncate font-display text-xl font-bold text-palco-gold">
              {activeRoom?.name || 'Nenhuma'}
            </p>
          </div>
        </Card>
      </div>

      {activeRoomId ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-6">
            <div className="flex flex-col gap-4 rounded-2xl border border-palco-live/30 bg-palco-live/10 p-4 shadow-[0_0_20px_rgba(220,38,38,0.15)] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="h-3 w-3 shrink-0 rounded-full bg-palco-live" />
                <div>
                  <p className="font-bold text-palco-live">Voce esta no ar</p>
                  <p className="text-sm text-palco-text-muted">
                    Camera e microfone estao sendo enviados para ouvintes desta sala.
                  </p>
                </div>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={handleStopLive}
                loading={isProcessing}
                className="w-full sm:w-auto"
              >
                Sair da sala
              </Button>
            </div>

            <LocalCamera
              isActive
              stream={mediaStream.localStream}
              status={mediaStream.status}
              error={mediaStream.error}
              artistName={profile?.name}
            />
            <ArtistRequestQueue activeRequests={activeRequests} />
          </div>

          <div className="min-w-0 space-y-4">
            <h3 className="font-display font-bold text-palco-text">Chat ao vivo</h3>
            <div className="h-[560px]">
              <ChatBox
                messages={messages}
                isConnected={isConnected}
                onSendMessage={sendChatMessage}
              />
            </div>
          </div>
        </div>
      ) : (
        <section>
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-display text-2xl font-bold text-palco-text">
                Escolha uma sala para tocar
              </h2>
              <p className="mt-1 text-sm text-palco-text-muted">
                Uma sala pode ter varios artistas ao mesmo tempo. O publico escolhe voce dentro dela.
              </p>
            </div>
          </div>

          {roomsLoading ? (
            <p className="text-palco-text-muted">Carregando salas...</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => {
                const artists = getActiveArtists(room);
                return (
                  <Card key={room.id} hover>
                    <div className="p-5">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h3 className="font-display font-bold text-palco-text">{room.name}</h3>
                        {artists.length > 0 && (
                          <Badge variant="live" pulse>
                            {artists.length} ao vivo
                          </Badge>
                        )}
                      </div>
                      <p className="mb-4 text-sm text-palco-text-subtle">
                        {room.genre} - {room.listener_count || 0} ouvintes
                      </p>
                      {artists.length > 0 && (
                        <p className="mb-4 text-xs text-palco-text-subtle">
                          Tocando agora: {artists.map((artist) => artist.name).join(', ')}
                        </p>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        disabled={isProcessing || roomHasArtist(room, profile?.id)}
                        loading={isProcessing && !activeRoomId}
                        onClick={() => handleGoLive(room.id)}
                      >
                        {roomHasArtist(room, profile?.id) ? 'Voce ja esta nesta sala' : 'Entrar ao vivo'}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
