import { useNavigate } from 'react-router-dom';
import { useRooms } from '../hooks/useRooms';
import { useAuth } from '../hooks/useAuth';
import RoomGrid from '../components/features/rooms/RoomGrid';
import Badge from '../components/ui/Badge';
import { getLoginUrl } from '../lib/navigation';

export default function RoomsPage() {
  const { rooms, loading, error } = useRooms();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  function handleRoomClick(room) {
    const roomPath = `/room/${room.id}`;
    navigate(isAuthenticated ? roomPath : getLoginUrl(roomPath));
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-palco-black px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <Badge variant="gold">Ambientes ao vivo</Badge>
              <Badge variant={rooms.length > 0 ? 'live' : 'default'} pulse={rooms.length > 0}>
                {rooms.length} salas
              </Badge>
            </div>
            <h1 className="font-display text-3xl font-black text-palco-text sm:text-4xl">
              Escolha uma sala musical
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-palco-text-muted">
              Primeiro escolha o ambiente. Depois escolha o cantor entre os artistas ao vivo naquela sala.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-fit rounded-xl border border-palco-border px-4 py-2 text-sm font-bold text-palco-text-muted transition hover:border-palco-gold/50 hover:text-palco-gold"
          >
            Ver apresentacao
          </button>
        </header>

        <RoomGrid
          rooms={rooms}
          loading={loading}
          error={error}
          onRoomClick={handleRoomClick}
        />
      </div>
    </div>
  );
}
