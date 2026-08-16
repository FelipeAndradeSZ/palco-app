import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getRoomById, subscribeToRoom, unsubscribeFromRoom } from '../services/roomService';
import { createSongRequest } from '../services/bountyService';
import { useAuth } from '../hooks/useAuth';
import { useRoomMediaStream } from '../hooks/useRoomMediaStream';
import { BOUNTY_PRESETS } from '../lib/constants';
import { validateBountyValue, validateDedication, validateSongTitle, sanitizeText } from '../lib/validators';
import { getActiveArtists } from '../lib/roomArtists';
import { getLoginUrl } from '../lib/navigation';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import LiveStreamPlayer from '../components/features/video/LiveStreamPlayer';

const ACTIONS = [
  { id: 'request', label: 'Pedir' },
  { id: 'tip', label: 'Gorjeta' },
  { id: 'vote', label: 'Votar' },
];

const SAMPLE_MESSAGES = [
  { id: 'm1', author: 'PALCO', content: 'Entre na sua conta para conversar e apoiar o artista em tempo real.' },
];

const VOTE_OPTIONS = [
  ['voice', 'Melhor voz'],
  ['repertoire', 'Melhor repertório'],
  ['presence', 'Presença de palco'],
];

function ArtistAvatar({ artist, size = 'md' }) {
  const sizeClass = size === 'lg' ? 'h-20 w-20 text-3xl' : 'h-12 w-12 text-lg';

  return (
    <div className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-palco-gold/20 font-black text-palco-gold`}>
      {artist?.avatar_url ? (
        <img src={artist.avatar_url} alt={artist.name} className="h-full w-full object-cover" />
      ) : (
        artist?.name?.charAt(0)?.toUpperCase() || 'P'
      )}
    </div>
  );
}

function ArtistSelectionScreen({ room, artists, onSelect }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,rgba(212,168,67,0.18),transparent_32%),#070707] px-4 py-6 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-palco-gold">PALCO</p>
            <h1 className="mt-2 font-display text-3xl font-black">{room?.name || 'Sala PALCO'}</h1>
          </div>
          <Badge variant="live" pulse>{artists.length} ao vivo</Badge>
        </div>
        <p className="mb-6 max-w-2xl text-palco-text-muted">
          Escolha o cantor. Depois a live abre com áudio, vídeo, chat, pedido de música, gorjeta e votação.
        </p>

        {artists.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-palco-card p-8 text-center text-palco-text-muted">
            Nenhum artista esta ao vivo nesta sala agora.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {artists.map((artist) => (
            <button
              key={artist.id}
              type="button"
              onClick={() => onSelect(artist.id)}
              className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-palco-card p-4 text-left transition hover:border-palco-gold/60 hover:bg-palco-gold/10"
            >
              <ArtistAvatar artist={artist} size="lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-xl font-bold">{artist.name}</span>
                <span className="mt-1 block truncate text-sm text-palco-text-muted">
                  {artist.current_song || artist.main_genre || 'Tocando agora'}
                </span>
                <span className="mt-3 inline-flex rounded-full bg-palco-gold px-4 py-2 text-xs font-black text-palco-black group-hover:bg-palco-gold-light">
                  Entrar na live
                </span>
              </span>
            </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function AmountSelector({ value, onChange, disabled }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-palco-text-muted">Valor</label>
      <div className="grid grid-cols-4 gap-2">
        {BOUNTY_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(preset.value)}
            className={`rounded-xl border px-2 py-3 text-sm font-black transition ${
              Number(value) === preset.value
                ? 'border-palco-gold bg-palco-gold text-palco-black'
                : 'border-white/10 bg-white/[0.04] text-palco-text-muted hover:border-palco-gold/50 hover:text-white'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-palco-text-muted">
        R$
        <input
          type="number"
          min="5"
          step="0.01"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-white outline-none focus:border-palco-gold"
        />
      </label>
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder, disabled, maxLength = 160 }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-palco-text-muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none transition placeholder:text-palco-text-subtle focus:border-palco-gold"
      />
    </label>
  );
}

function LiveChat({ messages, guestName, chatMessage, setChatMessage, onSubmit }) {
  return (
    <div className="pointer-events-auto flex min-h-0 flex-col gap-3">
      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {messages.slice(-7).map((message) => (
          <div key={message.id} className="w-fit max-w-[min(440px,100%)] rounded-2xl bg-black/45 px-4 py-2 text-sm text-white shadow-lg backdrop-blur">
            <span className="mr-2 font-black text-palco-gold">{message.author}</span>
            <span className="break-words">{message.content}</span>
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={chatMessage}
          onChange={(event) => setChatMessage(event.target.value)}
          placeholder={`${guestName || 'Você'} comenta...`}
          maxLength={220}
          className="min-w-0 flex-1 rounded-full border border-white/15 bg-black/55 px-4 py-3 text-sm text-white outline-none backdrop-blur placeholder:text-palco-text-subtle focus:border-palco-gold"
        />
        <button
          type="submit"
          className="rounded-full bg-palco-gold px-5 py-3 text-sm font-black text-palco-black transition hover:bg-palco-gold-light"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}

function InteractionPanel({
  activeAction,
  setActiveAction,
  guestName,
  setGuestName,
  songTitle,
  setSongTitle,
  dedication,
  setDedication,
  amount,
  setAmount,
  tipMessage,
  setTipMessage,
  votes,
  feedback,
  submitting,
  onSongSubmit,
  onTipSubmit,
  onVote,
  targetLabel,
  isAuthenticated,
  loginUrl,
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/60 p-4 shadow-2xl backdrop-blur">
      <div className="mb-4 grid grid-cols-3 gap-2">
        {ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => setActiveAction(action.id)}
            className={`rounded-xl px-2 py-3 text-xs font-black transition ${
              activeAction === action.id
                ? 'bg-palco-gold text-palco-black'
                : 'bg-white/[0.06] text-palco-text-muted hover:text-white'
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>

      <TextInput
        label="Seu nome"
        value={guestName}
        onChange={setGuestName}
        placeholder="Mesa 4, João, Ana..."
        disabled={submitting}
        maxLength={80}
      />

      {!isAuthenticated && (
        <div className="mt-4 rounded-xl border border-palco-gold/25 bg-palco-gold/10 px-4 py-3 text-sm text-palco-text-muted">
          A live e publica. Para pedir, votar, conversar ou enviar gorjeta, entre na sua conta PALCO.
        </div>
      )}

      {feedback && (
        <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
          feedback.type === 'success'
            ? 'border-palco-success/30 bg-palco-success/10 text-palco-success'
            : 'border-palco-live/30 bg-palco-live/10 text-palco-live'
        }`}
        >
          {feedback.message}
        </div>
      )}

      {activeAction === 'request' && (
        <form onSubmit={onSongSubmit} className="mt-5 space-y-4">
          <TextInput
            label="Música"
            value={songTitle}
            onChange={setSongTitle}
            placeholder="Ex: Evidências"
            disabled={submitting}
            maxLength={200}
          />
          <AmountSelector value={amount} onChange={setAmount} disabled={submitting} />
          <TextInput
            label="Dedicatória"
            value={dedication}
            onChange={setDedication}
            placeholder="Para quem vai essa?"
            disabled={submitting}
            maxLength={200}
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-palco-gold px-5 py-3 text-sm font-black text-palco-black transition hover:bg-palco-gold-light disabled:opacity-60"
          >
            {submitting ? 'Enviando...' : isAuthenticated ? `Pedir para ${targetLabel}` : 'Entrar para pedir musica'}
          </button>
          {!isAuthenticated && (
            <Link to={loginUrl} className="block text-center text-xs font-bold text-palco-gold">
              Entrar para enviar direto ao artista
            </Link>
          )}
        </form>
      )}

      {activeAction === 'tip' && (
        <form onSubmit={onTipSubmit} className="mt-5 space-y-4">
          <AmountSelector value={amount} onChange={setAmount} />
          <TextInput
            label="Mensagem"
            value={tipMessage}
            onChange={setTipMessage}
            placeholder="Boa demais, manda mais uma!"
            maxLength={160}
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-palco-gold px-5 py-3 text-sm font-black text-palco-black transition hover:bg-palco-gold-light"
          >
            {isAuthenticated ? 'Enviar gorjeta' : 'Entrar para enviar gorjeta'}
          </button>
        </form>
      )}

      {activeAction === 'vote' && (
        <div className="mt-5 space-y-3">
          {VOTE_OPTIONS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => onVote(key, label)}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:border-palco-gold/50"
            >
              <span className="font-bold text-white">{label}</span>
              <span className="rounded-full bg-palco-gold/15 px-3 py-1 text-xs font-black text-palco-gold">
                {votes[key]} votos
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default function PublicInteractionPage() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, profile } = useAuth();
  const [room, setRoom] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState('request');
  const [guestName, setGuestName] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [dedication, setDedication] = useState('');
  const [amount, setAmount] = useState(10);
  const [tipMessage, setTipMessage] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [messages] = useState(SAMPLE_MESSAGES);
  const [votes] = useState({ voice: 0, repertoire: 0, presence: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [selectedArtistId, setSelectedArtistId] = useState(searchParams.get('artist') || null);
  const [listenEnabled, setListenEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRoom() {
      try {
        const { data, error } = await getRoomById(roomId);
        if (error || !data) throw error || new Error('Sala nao encontrada');
        if (!cancelled) setRoom(data);
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Sala indisponivel');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRoom();
    const channel = subscribeToRoom(roomId, loadRoom);

    return () => {
      cancelled = true;
      unsubscribeFromRoom(channel);
    };
  }, [roomId]);

  const availableArtists = useMemo(() => {
    return getActiveArtists(room);
  }, [room]);

  const selectedArtist = selectedArtistId
    ? availableArtists.find((artist) => artist.id === selectedArtistId) || null
    : null;
  const artistId = selectedArtist?.id || null;
  const displayName = sanitizeText(guestName) || profile?.name || 'Você';
  const roomLabel = room?.name || 'Sala PALCO';
  const targetLabel = selectedArtist?.name || 'Artista PALCO';
  const realRoomPath = selectedArtist?.id
    ? `/room/${roomId}?artist=${encodeURIComponent(selectedArtist.id)}`
    : `/room/${roomId}`;
  const loginUrl = getLoginUrl(realRoomPath);

  useEffect(() => {
    if (loading || !selectedArtistId || selectedArtist) return;
    setSelectedArtistId(null);
    setListenEnabled(false);
    setFeedback({ type: 'error', message: 'O artista encerrou esta transmissao. Escolha outra live.' });
  }, [loading, selectedArtist, selectedArtistId]);

  useEffect(() => {
    if (isAuthenticated && selectedArtist?.id) {
      navigate(realRoomPath, { replace: true });
    }
  }, [isAuthenticated, navigate, realRoomPath, selectedArtist?.id]);

  const listenerMedia = useRoomMediaStream({
    roomId: room?.id || roomId,
    artistId: selectedArtist?.id,
    role: 'listener',
    enabled: listenEnabled && Boolean(selectedArtist?.id),
  });

  function selectArtist(artistIdToSelect) {
    setSelectedArtistId(artistIdToSelect);
    setListenEnabled(true);
    setFeedback(null);
  }

  function backToArtists() {
    setSelectedArtistId(null);
    setListenEnabled(false);
    setFeedback(null);
  }

  async function handleSongSubmit(event) {
    event.preventDefault();
    setFeedback(null);

    if (!isAuthenticated) {
      navigate(loginUrl);
      return;
    }

    const titleValidation = validateSongTitle(songTitle);
    if (!titleValidation.valid) {
      setFeedback({ type: 'error', message: titleValidation.error });
      return;
    }

    const amountValidation = validateBountyValue(amount);
    if (!amountValidation.valid) {
      setFeedback({ type: 'error', message: amountValidation.error });
      return;
    }

    const dedicationValidation = validateDedication(dedication);
    if (!dedicationValidation.valid) {
      setFeedback({ type: 'error', message: dedicationValidation.error });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await createSongRequest({
        roomId: room.id,
        targetArtistId: artistId,
        songTitle: titleValidation.sanitized,
        bountyValue: Number(amount),
        dedication: dedicationValidation.sanitized,
      });

      if (error) throw new Error(error.message);

      setFeedback({ type: 'success', message: 'Pedido enviado para a fila do artista.' });
      setSongTitle('');
      setDedication('');
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Não foi possível enviar o pedido.' });
    } finally {
      setSubmitting(false);
    }
  }

  function handleTipSubmit(event) {
    event.preventDefault();
    navigate(isAuthenticated ? realRoomPath : loginUrl);
  }

  function handleVote(option, label) {
    void option;
    void label;
    navigate(isAuthenticated ? realRoomPath : loginUrl);
  }

  function handleChatSubmit(event) {
    event.preventDefault();
    navigate(isAuthenticated ? realRoomPath : loginUrl);
  }

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
        <section className="w-full max-w-md rounded-2xl border border-white/10 bg-palco-card p-6 text-center">
          <Badge variant="default">Sala indisponivel</Badge>
          <h1 className="mt-4 font-display text-2xl font-black">Esta live nao esta disponivel</h1>
          <p className="mt-2 text-sm text-palco-text-muted">{loadError || 'Confira o QR Code e tente novamente.'}</p>
          <Link to="/rooms" className="mt-5 inline-flex rounded-xl bg-palco-gold px-5 py-3 text-sm font-black text-palco-black">
            Ver salas ao vivo
          </Link>
        </section>
      </main>
    );
  }

  if (!selectedArtist) {
    return (
      <ArtistSelectionScreen
        room={room}
        artists={availableArtists}
        onSelect={selectArtist}
      />
    );
  }

  return (
    <main className="min-h-screen bg-palco-black p-3 text-white sm:p-5">
      <section className="relative mx-auto min-h-[calc(100vh-1.5rem)] max-w-7xl overflow-hidden rounded-3xl border border-white/10 bg-black sm:min-h-[calc(100vh-2.5rem)]">
        <LiveStreamPlayer
          stream={listenerMedia.remoteStream}
          status={listenEnabled ? listenerMedia.status : 'idle'}
          error={listenerMedia.error}
          title={selectedArtist.name}
          subtitle={selectedArtist.current_song || selectedArtist.main_genre || 'Tocando ao vivo'}
          initial={selectedArtist.name.charAt(0).toUpperCase()}
          canStart
          isStarted={listenEnabled}
          onStart={() => {
            if (listenerMedia.error) {
              setListenEnabled(false);
              setTimeout(() => setListenEnabled(true), 50);
            } else {
              setListenEnabled(true);
            }
          }}
          actionLabel="Ouvir ao vivo"
          className="absolute inset-0 h-full rounded-none border-0"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/10 to-black/75" />

        <div className="pointer-events-auto absolute left-4 right-4 top-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={backToArtists}
            className="rounded-full border border-white/15 bg-black/45 px-4 py-2 text-sm font-bold text-white backdrop-blur transition hover:border-palco-gold/60"
          >
            Trocar cantor
          </button>
          <Badge variant="live" pulse>Ao vivo</Badge>
        </div>

        <div className="pointer-events-none absolute bottom-4 left-4 right-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div className="min-w-0">
            <div className="pointer-events-auto mb-4 flex items-center gap-3">
              <ArtistAvatar artist={selectedArtist} />
              <div className="min-w-0">
                <p className="truncate font-display text-2xl font-black">{selectedArtist.name}</p>
                <p className="truncate text-sm text-palco-text-muted">
                  {roomLabel} • {selectedArtist.current_song || selectedArtist.main_genre || 'Ao vivo'}
                </p>
              </div>
            </div>
            <LiveChat
              messages={messages}
              guestName={displayName}
              chatMessage={chatMessage}
              setChatMessage={setChatMessage}
              onSubmit={handleChatSubmit}
            />
          </div>

          <div className="pointer-events-auto hidden lg:block">
            <InteractionPanel
              activeAction={activeAction}
              setActiveAction={setActiveAction}
              guestName={guestName}
              setGuestName={setGuestName}
              songTitle={songTitle}
              setSongTitle={setSongTitle}
              dedication={dedication}
              setDedication={setDedication}
              amount={amount}
              setAmount={setAmount}
              tipMessage={tipMessage}
              setTipMessage={setTipMessage}
              votes={votes}
              feedback={feedback}
              submitting={submitting}
              onSongSubmit={handleSongSubmit}
              onTipSubmit={handleTipSubmit}
              onVote={handleVote}
              targetLabel={targetLabel}
              isAuthenticated={isAuthenticated}
              loginUrl={loginUrl}
            />
          </div>
        </div>

        <div className="pointer-events-auto absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-3 lg:hidden">
          {ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => setActiveAction(action.id)}
              className={`flex h-12 w-12 items-center justify-center rounded-full text-xs font-black shadow-lg backdrop-blur ${
                activeAction === action.id
                  ? 'bg-palco-gold text-palco-black'
                  : 'bg-black/50 text-white'
              }`}
            >
              {action.id === 'request' ? '♪' : action.id === 'tip' ? 'R$' : '★'}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-3 lg:hidden">
        <InteractionPanel
          activeAction={activeAction}
          setActiveAction={setActiveAction}
          guestName={guestName}
          setGuestName={setGuestName}
          songTitle={songTitle}
          setSongTitle={setSongTitle}
          dedication={dedication}
          setDedication={setDedication}
          amount={amount}
          setAmount={setAmount}
          tipMessage={tipMessage}
          setTipMessage={setTipMessage}
          votes={votes}
          feedback={feedback}
          submitting={submitting}
          onSongSubmit={handleSongSubmit}
          onTipSubmit={handleTipSubmit}
          onVote={handleVote}
          targetLabel={targetLabel}
          isAuthenticated={isAuthenticated}
          loginUrl={loginUrl}
        />
      </div>
    </main>
  );
}
