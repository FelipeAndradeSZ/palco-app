import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getRoomById } from '../services/roomService';
import { createSongRequest } from '../services/bountyService';
import { useAuth } from '../hooks/useAuth';
import { BOUNTY_PRESETS } from '../lib/constants';
import { validateBountyValue, validateDedication, validateSongTitle, sanitizeText } from '../lib/validators';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';

const ACTIONS = [
  { id: 'request', label: 'Pedir música' },
  { id: 'tip', label: 'Gorjeta' },
  { id: 'vote', label: 'Votar' },
  { id: 'chat', label: 'Chat' },
];

const FALLBACK_ROOM = {
  id: 'demo-palco',
  name: 'Sertanejo Churrasco',
  genre: 'Sertanejo',
  listener_count: 1245,
  current_artist: {
    name: 'Gustavo Martins',
    avatar_url: null,
  },
};

const FALLBACK_ARTISTS = [
  { id: 'gustavo-martins', name: 'Gustavo Martins', tag: 'Sertanejo' },
  { id: 'ana-ribeiro', name: 'Ana Ribeiro', tag: 'Rock acústico' },
  { id: 'roda-das-7', name: 'Roda das 7', tag: 'Pagode' },
];

function saveGuestInteraction(payload) {
  const key = '@palco/public_interactions';
  const current = JSON.parse(localStorage.getItem(key) || '[]');
  const next = [
    {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...payload,
    },
    ...current,
  ].slice(0, 30);

  localStorage.setItem(key, JSON.stringify(next));
  return next[0];
}

function AmountSelector({ value, onChange, disabled }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-palco-text-muted">
        Valor
      </label>
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

export default function PublicInteractionPage() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, profile } = useAuth();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState('request');
  const [guestName, setGuestName] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [dedication, setDedication] = useState('');
  const [amount, setAmount] = useState(10);
  const [tipMessage, setTipMessage] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState([
    { id: 'm1', author: 'PALCO', content: 'Bem-vindo à sala. A interação acontece por aqui.' },
    { id: 'm2', author: 'Mesa 4', content: 'Toca Evidências!' },
  ]);
  const [votes, setVotes] = useState({ voice: 42, repertoire: 31, presence: 27 });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [selectedArtistId, setSelectedArtistId] = useState(searchParams.get('artist') || null);

  useEffect(() => {
    let cancelled = false;

    async function loadRoom() {
      try {
        const { data, error } = await getRoomById(roomId);
        if (!cancelled) {
          setRoom(error || !data ? { ...FALLBACK_ROOM, id: roomId || FALLBACK_ROOM.id } : data);
        }
      } catch {
        if (!cancelled) setRoom({ ...FALLBACK_ROOM, id: roomId || FALLBACK_ROOM.id });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRoom();

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const availableArtists = useMemo(() => {
    const artists = [];

    if (room?.current_artist) {
      artists.push({
        id: room.current_artist.id || room.current_artist_id || 'artista-atual',
        name: room.current_artist.name,
        tag: room.genre || 'Ao vivo',
      });
    }

    const roomArtists = Array.isArray(room?.active_artists)
      ? room.active_artists
      : Array.isArray(room?.live_artists)
        ? room.live_artists
        : [];

    roomArtists.forEach((entry) => {
      const artist = entry.artist || entry;
      if (artist?.id && !artists.some((item) => item.id === artist.id)) {
          artists.push({
            id: artist.id,
            name: artist.name,
            tag: artist.main_genre || artist.artist_details?.[0]?.main_genre || room.genre || 'Ao vivo',
          });
        }
    });

    return artists.length > 0 ? artists : FALLBACK_ARTISTS;
  }, [room]);

  const selectedArtist = availableArtists.find((artist) => artist.id === selectedArtistId) || availableArtists[0];
  const artistId = selectedArtist?.id || 'ambiente';
  const artistName = selectedArtist?.name || 'Artista da sala';
  const displayName = sanitizeText(guestName) || profile?.name || 'Você';
  const roomLabel = useMemo(() => room?.name || FALLBACK_ROOM.name, [room]);
  const targetLabel = artistId === 'ambiente' ? roomLabel : artistName;

  async function handleSongSubmit(event) {
    event.preventDefault();
    setFeedback(null);

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
      if (isAuthenticated && profile?.role === 'listener' && room?.id !== 'demo-palco') {
        const { error } = await createSongRequest({
          roomId: room.id,
          targetArtistId: artistId,
          songTitle: titleValidation.sanitized,
          bountyValue: Number(amount),
          dedication: dedicationValidation.sanitized,
        });

        if (error) throw new Error(error.message);

        setFeedback({ type: 'success', message: 'Pedido enviado para a fila do artista.' });
      } else {
        saveGuestInteraction({
          type: 'song_request',
          room_id: room?.id || roomId,
          target_artist_id: artistId,
          target_artist_name: targetLabel,
          guest_name: displayName,
          song_title: titleValidation.sanitized,
          bounty_value: Number(amount),
          dedication: dedicationValidation.sanitized,
        });
        setFeedback({ type: 'success', message: 'Pedido preparado. Faça login para enviar ao artista quando quiser.' });
      }

      setMessages((prev) => [
        {
          id: crypto.randomUUID(),
          author: displayName,
          content: `Pediu "${titleValidation.sanitized}" por R$ ${Number(amount).toFixed(2)}.`,
        },
        ...prev,
      ]);
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
    setFeedback(null);

    const amountValidation = validateBountyValue(amount);
    if (!amountValidation.valid) {
      setFeedback({ type: 'error', message: amountValidation.error });
      return;
    }

    const cleanMessage = sanitizeText(tipMessage);
    saveGuestInteraction({
      type: 'tip',
      room_id: room?.id || roomId,
      target_artist_id: artistId,
      target_artist_name: targetLabel,
      guest_name: displayName,
      amount: Number(amount),
      message: cleanMessage,
    });

    setMessages((prev) => [
      {
        id: crypto.randomUUID(),
        author: displayName,
        content: `Enviou intenção de gorjeta de R$ ${Number(amount).toFixed(2)}.`,
      },
      ...prev,
    ]);
    setTipMessage('');
    setFeedback({ type: 'success', message: 'Gorjeta preparada. A próxima etapa é ligar o PIX público.' });
  }

  function handleVote(option) {
    setVotes((prev) => ({ ...prev, [option]: prev[option] + 1 }));
    saveGuestInteraction({
      type: 'vote',
      room_id: room?.id || roomId,
      target_artist_id: artistId,
      target_artist_name: targetLabel,
      guest_name: displayName,
      vote: option,
    });
    setFeedback({ type: 'success', message: 'Voto registrado neste aparelho.' });
  }

  function handleChatSubmit(event) {
    event.preventDefault();
    const cleanMessage = sanitizeText(chatMessage);
    if (!cleanMessage) return;

    setMessages((prev) => [
      { id: crypto.randomUUID(), author: displayName, content: cleanMessage },
      ...prev,
    ]);
    saveGuestInteraction({
      type: 'chat',
      room_id: room?.id || roomId,
      target_artist_id: artistId,
      target_artist_name: targetLabel,
      guest_name: displayName,
      message: cleanMessage,
    });
    setChatMessage('');
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-palco-black">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,rgba(212,168,67,0.18),transparent_32%),#070707] px-4 py-5 text-white">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <header className="rounded-2xl border border-palco-gold/30 bg-black/55 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-palco-gold">PALCO</p>
              <h1 className="mt-2 font-display text-2xl font-black">{roomLabel}</h1>
              <p className="mt-1 text-sm text-palco-text-muted">
                Interação direcionada para {targetLabel}
              </p>
            </div>
            <Badge variant="live" pulse>Ao vivo</Badge>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="font-bold text-white">{room?.genre || 'Ao vivo'}</p>
              <p className="mt-1 text-palco-text-subtle">Estilo</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="font-bold text-white">{room?.listener_count || 0}</p>
              <p className="mt-1 text-palco-text-subtle">Ouvintes</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="font-bold text-palco-gold">90%</p>
              <p className="mt-1 text-palco-text-subtle">Artista</p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-white/10 bg-black/45 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-palco-gold">
                Escolha o cantor
              </p>
              <p className="mt-1 text-sm text-palco-text-muted">
                Nesta sala podem existir vários artistas tocando ao mesmo tempo.
              </p>
            </div>
            <span className="rounded-full bg-palco-gold/15 px-3 py-1 text-xs font-black text-palco-gold">
              {room?.genre || 'Ao vivo'}
            </span>
          </div>
          <div className="mt-4 grid gap-2">
            {availableArtists.map((artist) => (
              <button
                key={artist.id}
                type="button"
                onClick={() => {
                  setSelectedArtistId(artist.id);
                  setFeedback(null);
                }}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                  artist.id === artistId
                    ? 'border-palco-gold bg-palco-gold/10 text-white'
                    : 'border-white/10 bg-white/[0.04] text-palco-text-muted hover:border-palco-gold/50 hover:text-white'
                }`}
              >
                <span>
                  <span className="block text-sm font-bold">{artist.name}</span>
                  <span className="mt-1 block text-xs text-palco-text-subtle">{artist.tag}</span>
                </span>
                <span className="text-xs font-black text-palco-gold">
                  {artist.id === artistId ? 'Selecionado' : 'Escolher'}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-palco-card/85 p-2">
          <div className="grid grid-cols-4 gap-1">
            {ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  setActiveAction(action.id);
                  setFeedback(null);
                }}
                className={`rounded-xl px-2 py-3 text-xs font-bold transition ${
                  activeAction === action.id
                    ? 'bg-palco-gold text-palco-black'
                    : 'text-palco-text-muted hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-black/55 p-4">
          <TextInput
            label="Seu nome"
            value={guestName}
            onChange={setGuestName}
            placeholder="Mesa 4, João, Ana..."
            disabled={submitting}
            maxLength={80}
          />

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
            <form onSubmit={handleSongSubmit} className="mt-5 space-y-4">
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
                {submitting ? 'Enviando...' : `Pedir para ${targetLabel} por R$ ${Number(amount).toFixed(2)}`}
              </button>
            </form>
          )}

          {activeAction === 'tip' && (
            <form onSubmit={handleTipSubmit} className="mt-5 space-y-4">
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
                Preparar gorjeta
              </button>
            </form>
          )}

          {activeAction === 'vote' && (
            <div className="mt-5 space-y-3">
              {[
                ['voice', 'Melhor voz'],
                ['repertoire', 'Melhor repertório'],
                ['presence', 'Presença de palco'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleVote(key)}
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

          {activeAction === 'chat' && (
            <form onSubmit={handleChatSubmit} className="mt-5 space-y-4">
              <TextInput
                label="Mensagem"
                value={chatMessage}
                onChange={setChatMessage}
                placeholder="Manda essa para a mesa do fundo..."
                maxLength={220}
              />
              <button
                type="submit"
                className="w-full rounded-xl border border-palco-gold/45 px-5 py-3 text-sm font-black text-palco-gold transition hover:bg-palco-gold/10"
              >
                Enviar no chat
              </button>
            </form>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-black/45 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Movimento da sala</h2>
            {!isAuthenticated && (
              <Link to="/login" className="text-xs font-bold text-palco-gold">
                Entrar
              </Link>
            )}
          </div>
          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
            {messages.map((message) => (
              <div key={message.id} className="rounded-xl bg-white/[0.04] px-3 py-2">
                <p className="text-xs font-bold text-palco-gold">{message.author}</p>
                <p className="mt-1 text-sm text-palco-text-muted">{message.content}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
