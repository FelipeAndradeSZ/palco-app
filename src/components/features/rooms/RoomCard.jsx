import Card from '../../ui/Card';
import Badge from '../../ui/Badge';
import { VIBE_LEVEL_LABELS } from '../../../lib/constants';
import { getActiveArtists } from '../../../lib/roomArtists';

export default function RoomCard({ room, onClick }) {
  const activeArtists = getActiveArtists(room);
  const hasArtists = activeArtists.length > 0;

  return (
    <Card hover onClick={onClick} className="group cursor-pointer">
      <div className="p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-bold text-palco-text transition-colors duration-200 group-hover:text-palco-gold">
            {room.name}
          </h3>
          {hasArtists && (
            <Badge variant="live" pulse>
              {activeArtists.length} ao vivo
            </Badge>
          )}
        </div>

        <div className="mb-4 flex items-center gap-2">
          <Badge variant="gold">{room.genre}</Badge>
          <span className="text-sm text-palco-text-subtle">
            {VIBE_LEVEL_LABELS[room.vibe_level] || room.vibe_level}
          </span>
        </div>

        {hasArtists ? (
          <div className="mb-4 space-y-2">
            {activeArtists.slice(0, 3).map((artist) => (
              <div key={artist.id} className="flex items-center gap-3 rounded-lg bg-palco-dark/50 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-palco-gold/20 text-sm font-bold text-palco-gold">
                  {artist.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-palco-text">{artist.name}</p>
                  <p className="text-xs text-palco-text-subtle">
                    {artist.main_genre || 'Tocando agora'}
                  </p>
                </div>
              </div>
            ))}
            {activeArtists.length > 3 && (
              <p className="px-1 text-xs font-semibold text-palco-gold">
                +{activeArtists.length - 3} artistas nesta sala
              </p>
            )}
          </div>
        ) : (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-palco-dark/50 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-palco-border text-lg text-palco-text-subtle">
              P
            </div>
            <p className="text-sm text-palco-text-subtle">Aguardando artistas...</p>
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-palco-text-subtle">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-palco-success" />
            <span>
              {room.listener_count || 0} {room.listener_count === 1 ? 'ouvinte' : 'ouvintes'}
            </span>
          </div>
          <span className="text-xs font-medium text-palco-gold opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            Escolher artista
          </span>
        </div>
      </div>
    </Card>
  );
}
