/**
 * HomePage — Explorar Salas ao Vivo
 * 
 * Página principal do PALCO.
 * Mostra hero banner + grid de salas filtráveis.
 */

import { useNavigate } from 'react-router-dom';
import { useRooms } from '../hooks/useRooms';
import { useAuth } from '../hooks/useAuth';
import RoomGrid from '../components/features/rooms/RoomGrid';

export default function HomePage() {
  const { rooms, loading, error } = useRooms();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  function handleRoomClick(room) {
    if (isAuthenticated) {
      navigate(`/room/${room.id}`);
    } else {
      navigate('/login');
    }
  }

  return (
    <div>
      {/* Hero Banner */}
      <section className="relative py-16 sm:py-24 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-palco-gold/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-palco-text mb-4 leading-tight">
            O palco do{' '}
            <span className="text-palco-gold">Brasil</span>
          </h1>
          <p className="text-palco-text-muted text-lg sm:text-xl max-w-2xl mx-auto mb-8 leading-relaxed">
            Música ao vivo de verdade. Peça sua música, interaja com artistas reais
            e transforme qualquer momento em experiência.
          </p>

          {!isAuthenticated && (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => navigate('/register')}
                className="px-8 py-3.5 bg-palco-gold text-palco-black font-display font-bold rounded-xl hover:bg-palco-gold-light transition-all duration-200 shadow-lg shadow-palco-gold/20 hover:shadow-palco-gold/30 cursor-pointer"
              >
                Começar agora
              </button>
              <button
                onClick={() => navigate('/login')}
                className="px-8 py-3.5 border border-palco-border text-palco-text-muted font-medium rounded-xl hover:border-palco-gold/50 hover:text-palco-text transition-all duration-200 cursor-pointer"
              >
                Já tenho conta
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Salas ao Vivo */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-bold text-2xl text-palco-text">
            🎵 Salas ao Vivo
          </h2>
          <span className="text-sm text-palco-text-subtle">
            {rooms.length} {rooms.length === 1 ? 'sala ativa' : 'salas ativas'}
          </span>
        </div>

        <RoomGrid
          rooms={rooms}
          loading={loading}
          error={error}
          onRoomClick={handleRoomClick}
        />
      </section>
    </div>
  );
}
