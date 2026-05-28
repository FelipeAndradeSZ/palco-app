import { useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useRooms } from '../hooks/useRooms';
import { useRoomRealtime } from '../hooks/useRoomRealtime';
import { updateRoomArtist } from '../services/roomService';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ArtistRequestQueue from '../components/features/bounty/ArtistRequestQueue';
import ChatBox from '../components/features/chat/ChatBox';
import LocalCamera from '../components/features/video/LocalCamera';
import { QUALITY_TIER_LABELS } from '../lib/constants';

export default function ArtistDashboardPage() {
  const { profile } = useAuth();
  const { rooms, loading: roomsLoading, refetch: refetchRooms } = useRooms();
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const assignedRoomId = useMemo(() => {
    if (!profile?.id) return null;
    return rooms.find((room) => room.current_artist_id === profile.id)?.id || null;
  }, [profile, rooms]);

  const activeRoomId = selectedRoomId || assignedRoomId;
  const { activeRequests, messages, isConnected, sendChatMessage } = useRoomRealtime(activeRoomId);
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
      await updateRoomArtist(activeRoomId, null);
      setSelectedRoomId(null);
      await refetchRooms();
    } catch (err) {
      console.error('Erro ao sair do ar', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-3xl font-bold text-palco-text">Meu Painel</h1>
          <p className="mt-1 text-palco-text-muted">Bem-vindo, {profile?.name || 'Artista'}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={activeRoomId ? 'live' : 'default'} pulse={!!activeRoomId}>
            {activeRoomId ? 'AO VIVO' : 'OFFLINE'}
          </Badge>
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
            <p className="mb-1 text-sm text-palco-text-subtle">Tier</p>
            <p className="font-display text-xl font-bold text-palco-gold">{tierLabel}</p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="mb-1 text-sm text-palco-text-subtle">Avaliação</p>
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
            <p className="mb-1 text-sm text-palco-text-subtle">Gênero</p>
            <p className="truncate font-display text-xl font-bold text-palco-text">
              {artistDetails.main_genre || '-'}
            </p>
          </div>
        </Card>
      </div>

      {activeRoomId ? (
        <div className="mt-8 flex flex-col gap-6 lg:flex-row">
          <div className="flex flex-1 flex-col gap-6">
            <div className="flex items-center gap-4 rounded-xl border border-palco-live/30 bg-palco-live/10 p-4 shadow-[0_0_20px_rgba(220,38,38,0.15)]">
              <span className="h-3 w-3 rounded-full bg-palco-live" />
              <div>
                <p className="font-bold text-palco-live">Você está no ar</p>
                <p className="text-sm text-palco-text-muted">Seu público está acompanhando sua apresentação.</p>
              </div>
            </div>

            <LocalCamera isActive />
            <ArtistRequestQueue activeRequests={activeRequests} />
          </div>

          <div className="flex w-full flex-col gap-4 lg:w-96">
            <h3 className="flex items-center gap-2 font-display font-bold text-palco-text">
              <svg className="h-5 w-5 text-palco-gold" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
              </svg>
              Chat ao vivo
            </h3>
            <div className="min-h-[400px] flex-1 lg:max-h-[600px]">
              <ChatBox
                messages={messages}
                isConnected={isConnected}
                onSendMessage={sendChatMessage}
              />
            </div>
          </div>
        </div>
      ) : (
        <div>
          <h2 className="mb-4 font-display text-xl font-bold text-palco-text">
            Escolha uma sala para tocar
          </h2>
          {roomsLoading ? (
            <p className="text-palco-text-muted">Carregando salas...</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => (
                <Card key={room.id} hover>
                  <div className="p-5">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="font-display font-bold text-palco-text">{room.name}</h3>
                      {room.current_artist_id && room.current_artist_id !== profile?.id && (
                        <Badge variant="default">Ocupada</Badge>
                      )}
                    </div>
                    <p className="mb-4 text-sm text-palco-text-subtle">
                      {room.genre} - {room.listener_count || 0} ouvintes
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      disabled={isProcessing || (room.current_artist_id && room.current_artist_id !== profile?.id)}
                      loading={isProcessing && !activeRoomId}
                      onClick={() => handleGoLive(room.id)}
                    >
                      {room.current_artist_id ? 'Sala indisponível' : 'Entrar na sala e tocar'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
