/**
 * TVModePage — Modo TV para Estabelecimentos
 * 
 * Rota protegida: role = venue
 * Interface fullscreen, otimizada para TVs/telões.
 * Visual limpo com artista atual, fila de pedidos e chat.
 */

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useRooms } from '../hooks/useRooms';
import { useAuth } from '../hooks/useAuth';
import { useRoomRealtime } from '../hooks/useRoomRealtime';
import Badge from '../components/ui/Badge';
import LiveAlertOverlay from '../components/features/tv/LiveAlertOverlay';
import { VIBE_LEVEL_LABELS } from '../lib/constants';

export default function TVModePage() {
  const { profile } = useAuth();
  const { rooms, loading } = useRooms();
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Conecta ao WebSocket da sala quando uma for selecionada
  const { tvAlerts } = useRoomRealtime(selectedRoom?.id);

  // Relógio atualizado a cada minuto
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Se nenhuma sala selecionada, mostra seletor
  if (!selectedRoom) {
    return (
      <div className="min-h-screen bg-palco-black flex flex-col items-center justify-center px-8">
        <h1 className="font-display font-extrabold text-5xl text-palco-gold mb-3">
          PALCO
        </h1>
        <p className="text-palco-text-muted text-xl mb-12">
          Selecione um ambiente musical para o seu estabelecimento
        </p>

        {loading ? (
          <p className="text-palco-text-muted text-lg">Carregando salas...</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full max-w-5xl">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(room)}
                className="bg-palco-card border border-palco-border rounded-2xl p-8 text-left hover:border-palco-gold/60 hover:bg-palco-card/80 transition-all duration-300 group cursor-pointer"
              >
                <h3 className="font-display font-bold text-xl text-palco-text group-hover:text-palco-gold transition-colors mb-2">
                  {room.name}
                </h3>
                <p className="text-palco-text-subtle text-sm mb-3">
                  {room.genre} • {VIBE_LEVEL_LABELS[room.vibe_level]}
                </p>
                <div className="flex items-center gap-2">
                  {room.current_artist_id ? (
                    <Badge variant="live" pulse>AO VIVO</Badge>
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

  // Tela do Modo TV com sala selecionada
  const artistName = selectedRoom.current_artist?.name;

  return (
    <div className="min-h-screen bg-palco-black flex flex-col relative overflow-hidden">
      {/* Background gradient animado */}
      <div className="absolute inset-0 bg-gradient-to-br from-palco-gold/3 via-transparent to-palco-gold/2 pointer-events-none" />

      {/* Overlay de Alertas em Tempo Real */}
      <LiveAlertOverlay alerts={tvAlerts} />

      {/* Header da TV */}
      <header className="relative flex items-center justify-between px-10 py-6">
        <div className="flex items-center gap-4">
          <h1 className="font-display font-extrabold text-2xl text-palco-gold">
            PALCO
          </h1>
          <span className="text-palco-border">|</span>
          <span className="text-palco-text-muted text-lg">
            {selectedRoom.name}
          </span>
        </div>
        <div className="flex items-center gap-6">
          <Badge variant="live" pulse>AO VIVO</Badge>
          <span className="font-display text-2xl text-palco-text-muted tabular-nums">
            {timeString}
          </span>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="relative flex-1 flex flex-col items-center justify-center px-10">
        {/* Avatar do artista */}
        <div className="w-40 h-40 rounded-full bg-gradient-to-br from-palco-gold/30 to-palco-gold/10 border-2 border-palco-gold/40 flex items-center justify-center mb-8 shadow-2xl shadow-palco-gold/10">
          {artistName ? (
            <span className="font-display font-bold text-6xl text-palco-gold">
              {artistName.charAt(0).toUpperCase()}
            </span>
          ) : (
            <span className="text-6xl">🎵</span>
          )}
        </div>

        {/* Nome do artista */}
        <h2 className="font-display font-bold text-4xl text-palco-text mb-2">
          {artistName || 'Aguardando artista...'}
        </h2>
        <p className="text-palco-text-muted text-lg mb-8">
          {artistName ? 'Tocando agora' : 'A música começa em breve'}
        </p>

        {/* Barra de áudio decorativa */}
        <div className="flex items-end gap-1.5 h-12">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="w-1.5 bg-palco-gold/60 rounded-full animate-pulse"
              style={{
                height: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: `${0.8 + Math.random() * 0.5}s`,
              }}
            />
          ))}
        </div>
      </main>

      {/* Footer: QR Code placeholder + info */}
      <footer className="relative flex items-center justify-between px-10 py-8 border-t border-palco-border/30">
        <div>
          <p className="text-palco-text-subtle text-sm mb-1">
            Peça sua música!
          </p>
          <p className="text-palco-text-muted text-xs">
            Escaneie o QR Code ou acesse o app
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-palco-text-muted text-sm">
              {profile?.name || 'Estabelecimento'}
            </p>
            <p className="text-palco-text-subtle text-xs">
              Powered by PALCO
            </p>
          </div>
          <div className="bg-white p-2 rounded-xl shadow-lg">
            <QRCodeSVG 
              value={`${window.location.origin}/room/${selectedRoom.id}`}
              size={80}
              bgColor="#ffffff"
              fgColor="#000000"
              level="H"
              includeMargin={false}
            />
          </div>
        </div>
      </footer>

      {/* Botão para voltar ao seletor */}
      <button
        onClick={() => setSelectedRoom(null)}
        className="absolute top-6 right-10 bg-palco-card/80 border border-palco-border rounded-full p-2 text-palco-text-subtle hover:text-palco-text hover:border-palco-gold/50 transition-all opacity-30 hover:opacity-100 cursor-pointer"
        title="Trocar sala"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
