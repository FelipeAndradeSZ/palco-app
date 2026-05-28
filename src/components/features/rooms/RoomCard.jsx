/**
 * RoomCard — Card individual de uma sala de música
 */

import Card from '../../ui/Card';
import Badge from '../../ui/Badge';
import { VIBE_LEVEL_LABELS } from '../../../lib/constants';

export default function RoomCard({ room, onClick }) {
  const hasArtist = !!room.current_artist_id;
  const artistName = room.current_artist?.name;

  return (
    <Card
      hover
      onClick={onClick}
      className="cursor-pointer group"
    >
      <div className="p-5">
        {/* Header: nome + badge */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-display font-bold text-lg text-palco-text group-hover:text-palco-gold transition-colors duration-200">
            {room.name}
          </h3>
          {hasArtist && (
            <Badge variant="live" pulse>
              AO VIVO
            </Badge>
          )}
        </div>

        {/* Gênero e vibe */}
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="gold">{room.genre}</Badge>
          <span className="text-sm text-palco-text-subtle">
            {VIBE_LEVEL_LABELS[room.vibe_level] || room.vibe_level}
          </span>
        </div>

        {/* Artista atual */}
        {hasArtist && artistName ? (
          <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-palco-dark/50">
            <div className="w-10 h-10 rounded-full bg-palco-gold/20 flex items-center justify-center text-palco-gold font-bold text-sm shrink-0">
              {artistName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-palco-text truncate">
                {artistName}
              </p>
              <p className="text-xs text-palco-text-subtle">
                Tocando agora
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-palco-dark/50">
            <div className="w-10 h-10 rounded-full bg-palco-border flex items-center justify-center text-palco-text-subtle text-lg">
              🎵
            </div>
            <p className="text-sm text-palco-text-subtle">
              Aguardando artista...
            </p>
          </div>
        )}

        {/* Footer: ouvintes */}
        <div className="flex items-center justify-between text-sm text-palco-text-subtle">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-palco-success" />
            <span>
              {room.listener_count || 0} {room.listener_count === 1 ? 'ouvinte' : 'ouvintes'}
            </span>
          </div>
          <span className="text-palco-gold opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs font-medium">
            Entrar →
          </span>
        </div>
      </div>
    </Card>
  );
}
