/**
 * ArtistDashboardPage — Painel do Artista
 * 
 * Rota protegida: role = artist
 * Mostra estatísticas, status online/offline e salas disponíveis.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useRooms } from '../hooks/useRooms';
import { useRoomRealtime } from '../hooks/useRoomRealtime';
import { updateRoomArtist } from '../services/roomService';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ArtistRequestQueue from '../components/features/bounty/ArtistRequestQueue';
import { QUALITY_TIER_LABELS } from '../lib/constants';

export default function ArtistDashboardPage() {
  const { profile } = useAuth();
  const { rooms, loading: roomsLoading, refetch: refetchRooms } = useRooms();
  
  // No MVP o artista pode selecionar uma sala para ficar ao vivo
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Hook realtime para gerenciar fila quando ao vivo
  const { activeRequests } = useRoomRealtime(activeRoomId);

  const artistDetails = profile?.artist_details?.[0] || profile?.artist_details || {};
  const tierLabel = QUALITY_TIER_LABELS[artistDetails.quality_tier] || 'Bronze';
  
  // Se o artista já for o current_artist de alguma sala, setar como ativa
  useEffect(() => {
    if (profile?.id && rooms.length > 0 && !activeRoomId) {
      const myRoom = rooms.find(r => r.current_artist_id === profile.id);
      if (myRoom) setActiveRoomId(myRoom.id);
    }
  }, [rooms, profile, activeRoomId]);

  const handleGoLive = async (roomId) => {
    setIsProcessing(true);
    try {
      await updateRoomArtist(roomId, profile.id);
      setActiveRoomId(roomId);
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
      setActiveRoomId(null);
      await refetchRooms();
    } catch (err) {
      console.error('Erro ao sair do ar', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header do Dashboard */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display font-bold text-3xl text-palco-text">
            Meu Painel
          </h1>
          <p className="text-palco-text-muted mt-1">
            Bem-vindo, {profile?.name || 'Artista'}
          </p>
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
              Encerrar Show
            </Button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <div className="p-5">
            <p className="text-palco-text-subtle text-sm mb-1">Tier</p>
            <p className="font-display font-bold text-xl text-palco-gold">
              {tierLabel}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-palco-text-subtle text-sm mb-1">Avaliação</p>
            <p className="font-display font-bold text-xl text-palco-text">
              ⭐ {Number(artistDetails.rating || 0).toFixed(1)}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-palco-text-subtle text-sm mb-1">Horas ao vivo</p>
            <p className="font-display font-bold text-xl text-palco-text">
              {artistDetails.total_hours_streamed || 0}h
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-palco-text-subtle text-sm mb-1">Gênero</p>
            <p className="font-display font-bold text-xl text-palco-text truncate">
              {artistDetails.main_genre || '—'}
            </p>
          </div>
        </Card>
      </div>

      {/* Conteúdo Dinâmico (Ao Vivo vs Offline) */}
      {activeRoomId ? (
        <div className="mt-8">
          <div className="flex items-center gap-4 mb-6 p-4 bg-palco-live/10 border border-palco-live/30 rounded-xl">
            <span className="text-2xl animate-pulse">🔴</span>
            <div>
              <p className="font-bold text-palco-live">Você está NO AR!</p>
              <p className="text-sm text-palco-text-muted">Acompanhe os pedidos musicais abaixo em tempo real.</p>
            </div>
          </div>
          <ArtistRequestQueue activeRequests={activeRequests} />
        </div>
      ) : (
        <div>
          <h2 className="font-display font-bold text-xl text-palco-text mb-4">
            Escolha uma sala para tocar
          </h2>
          {roomsLoading ? (
            <p className="text-palco-text-muted">Carregando salas...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((room) => (
                <Card key={room.id} hover>
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-display font-bold text-palco-text">
                        {room.name}
                      </h3>
                      {room.current_artist_id && room.current_artist_id !== profile?.id && (
                         <Badge variant="default">Ocupada</Badge>
                      )}
                    </div>
                    <p className="text-sm text-palco-text-subtle mb-4">
                      {room.genre} • {room.listener_count || 0} ouvintes
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
