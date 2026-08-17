import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getRoomById, subscribeToRoom, unsubscribeFromRoom } from '../services/roomService';
import { getActiveArtists, getArtistInteractionUrl } from '../lib/roomArtists';
import { getLoginUrl } from '../lib/navigation';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';

function ArtistAvatar({ artist, large = false }) {
  const dimensions = large ? 'h-28 w-28 text-4xl' : 'h-16 w-16 text-2xl';

  return (
    <div className={`${dimensions} flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-palco-gold/35 bg-palco-gold/15 font-display font-black text-palco-gold`}>
      {artist?.avatar_url ? (
        <img src={artist.avatar_url} alt={artist.name} className="h-full w-full object-cover" />
      ) : (
        artist?.name?.charAt(0)?.toUpperCase() || 'P'
      )}
    </div>
  );
}

export default function PublicInteractionPage() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const requestedArtistId = searchParams.get('artist');

  useEffect(() => {
    let cancelled = false;

    async function loadRoom() {
      const { data, error } = await getRoomById(roomId);
      if (cancelled) return;

      if (error || !data) {
        setLoadError(error?.message || 'Sala nao encontrada.');
        setRoom(null);
      } else {
        setLoadError(null);
        setRoom(data);
      }
      setLoading(false);
    }

    void loadRoom();
    const channel = subscribeToRoom(roomId, loadRoom);

    return () => {
      cancelled = true;
      unsubscribeFromRoom(channel);
    };
  }, [roomId]);

  const artists = useMemo(() => getActiveArtists(room), [room]);
  const selectedArtist = requestedArtistId
    ? artists.find((artist) => artist.id === requestedArtistId) || null
    : null;
  const roomPath = selectedArtist
    ? `/room/${encodeURIComponent(roomId)}?artist=${encodeURIComponent(selectedArtist.id)}`
    : `/room/${encodeURIComponent(roomId)}`;
  const loginUrl = getLoginUrl(roomPath);
  const registerUrl = `/register?returnTo=${encodeURIComponent(roomPath)}`;

  useEffect(() => {
    if (isAuthenticated && selectedArtist) {
      navigate(roomPath, { replace: true });
    }
  }, [isAuthenticated, navigate, roomPath, selectedArtist]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-palco-black">
        <Spinner size="lg" />
      </div>
    );
  }

  if (loadError || !room) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-palco-black px-4 text-white">
        <section className="w-full max-w-md border border-white/10 bg-palco-card p-7 text-center">
          <Badge variant="default">Sala indisponivel</Badge>
          <h1 className="mt-4 font-display text-2xl font-black">Esta live nao esta disponivel</h1>
          <p className="mt-2 text-sm text-palco-text-muted">{loadError || 'Confira o QR Code e tente novamente.'}</p>
          <Link to="/rooms" className="mt-6 inline-flex bg-palco-gold px-5 py-3 text-sm font-black text-palco-black">
            Ver salas ao vivo
          </Link>
        </section>
      </main>
    );
  }

  if (requestedArtistId && !selectedArtist) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-palco-black px-4 text-white">
        <section className="w-full max-w-lg border border-white/10 bg-palco-card p-7 text-center">
          <Badge variant="default">Transmissao encerrada</Badge>
          <h1 className="mt-4 font-display text-2xl font-black">Este artista nao esta mais ao vivo</h1>
          <p className="mt-2 text-sm text-palco-text-muted">Escolha outro artista disponivel em {room.name}.</p>
          <button
            type="button"
            onClick={() => navigate(getArtistInteractionUrl(roomId, null), { replace: true })}
            className="mt-6 bg-palco-gold px-5 py-3 text-sm font-black text-palco-black"
          >
            Ver artistas da sala
          </button>
        </section>
      </main>
    );
  }

  if (!selectedArtist) {
    return (
      <main className="min-h-screen bg-palco-black px-4 py-8 text-white sm:px-6">
        <div className="mx-auto max-w-5xl">
          <header className="border-b border-white/10 pb-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-palco-gold">PALCO</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-3xl font-black sm:text-4xl">{room.name}</h1>
                <p className="mt-2 text-sm text-palco-text-muted">Escolha quem voce quer ouvir agora.</p>
              </div>
              <Badge variant={artists.length ? 'live' : 'default'} pulse={artists.length > 0}>
                {artists.length} ao vivo
              </Badge>
            </div>
          </header>

          {artists.length === 0 ? (
            <section className="py-16 text-center">
              <h2 className="font-display text-2xl font-black">Aguardando o proximo show</h2>
              <p className="mt-2 text-sm text-palco-text-muted">Esta sala continua aberta e recebera novos artistas.</p>
              <Link to="/rooms" className="mt-6 inline-flex border border-palco-gold/50 px-5 py-3 text-sm font-black text-palco-gold">
                Explorar outras salas
              </Link>
            </section>
          ) : (
            <section className="grid gap-px bg-white/10 sm:grid-cols-2">
              {artists.map((artist) => (
                <button
                  key={artist.id}
                  type="button"
                  onClick={() => navigate(getArtistInteractionUrl(roomId, artist.id))}
                  className="group flex min-h-32 items-center gap-4 bg-palco-card p-5 text-left transition hover:bg-palco-gold/10"
                >
                  <ArtistAvatar artist={artist} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-xl font-black">{artist.name}</span>
                    <span className="mt-1 block truncate text-sm text-palco-text-muted">
                      {artist.current_song || artist.main_genre || 'Tocando agora'}
                    </span>
                    <span className="mt-3 block text-xs font-black uppercase tracking-[0.12em] text-palco-gold">
                      Entrar na live
                    </span>
                  </span>
                </button>
              ))}
            </section>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center bg-palco-black px-4 py-8 text-white sm:px-6">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden border border-white/10 bg-palco-card lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative flex min-h-96 items-end overflow-hidden bg-black p-7 sm:p-10">
          {selectedArtist.avatar_url ? (
            <img
              src={selectedArtist.avatar_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-35"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(212,168,67,0.2),transparent_38%),#050505]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
          <div className="relative">
            <Badge variant="live" pulse>Ao vivo</Badge>
            <h1 className="mt-4 font-display text-4xl font-black sm:text-5xl">{selectedArtist.name}</h1>
            <p className="mt-2 text-sm text-palco-text-muted">
              {room.name} - {selectedArtist.current_song || selectedArtist.main_genre || 'Musica ao vivo'}
            </p>
          </div>
        </section>

        <section className="flex flex-col justify-center p-7 sm:p-10">
          <ArtistAvatar artist={selectedArtist} large />
          <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-palco-gold">Live interativa</p>
          <h2 className="mt-3 font-display text-3xl font-black">Entre para ouvir e participar</h2>
          <p className="mt-3 text-sm leading-6 text-palco-text-muted">
            Continue pelo navegador para ouvir a transmissao, conversar, pedir musicas, votar e enviar gorjetas.
          </p>
          <Link to={loginUrl} className="mt-7 flex min-h-12 items-center justify-center bg-palco-gold px-5 py-3 text-sm font-black text-palco-black">
            Entrar na live
          </Link>
          <Link to={registerUrl} className="mt-3 flex min-h-12 items-center justify-center border border-white/15 px-5 py-3 text-sm font-black text-white">
            Criar conta gratis
          </Link>
          <button
            type="button"
            onClick={() => navigate(getArtistInteractionUrl(roomId, null), { replace: true })}
            className="mt-5 text-sm font-bold text-palco-text-muted hover:text-white"
          >
            Escolher outro artista
          </button>
        </section>
      </div>
    </main>
  );
}
