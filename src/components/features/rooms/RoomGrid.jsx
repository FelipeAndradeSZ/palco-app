/**
 * RoomGrid — Grid responsivo de salas com filtros
 */

import { useState, useMemo } from 'react';
import RoomCard from './RoomCard';
import Spinner from '../../ui/Spinner';
import Alert from '../../ui/Alert';

const GENRE_FILTERS = ['Todos', 'Sertanejo', 'Pagode', 'Samba', 'Rock', 'Pop Rock', 'MPB', 'Acústico', 'Gospel', 'Blues'];

export default function RoomGrid({ rooms, loading, error, onRoomClick }) {
  const [activeFilter, setActiveFilter] = useState('Todos');

  const filteredRooms = useMemo(() => {
    if (activeFilter === 'Todos') return rooms;
    return rooms.filter((room) => room.genre === activeFilter);
  }, [rooms, activeFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-10">
        <Alert type="error" message={error} />
      </div>
    );
  }

  return (
    <div>
      {/* Filtros de gênero */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
        {GENRE_FILTERS.map((genre) => (
          <button
            key={genre}
            onClick={() => setActiveFilter(genre)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 cursor-pointer ${
              activeFilter === genre
                ? 'bg-palco-gold text-palco-black'
                : 'bg-palco-card border border-palco-border text-palco-text-muted hover:border-palco-gold/50 hover:text-palco-text'
            }`}
          >
            {genre}
          </button>
        ))}
      </div>

      {/* Grid de salas */}
      {filteredRooms.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🎵</p>
          <p className="text-palco-text-muted text-lg">
            Nenhuma sala ao vivo nesse gênero.
          </p>
          <p className="text-palco-text-subtle text-sm mt-1">
            Tente outro filtro ou volte mais tarde.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onClick={() => onRoomClick?.(room)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
