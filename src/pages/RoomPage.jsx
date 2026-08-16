import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useRoomRealtime } from '../hooks/useRoomRealtime';
import { useRoomMediaStream } from '../hooks/useRoomMediaStream';
import { getRoomById, joinRoom, leaveRoom } from '../services/roomService';
import { getWallet, addFundsCheckout } from '../services/walletService';
import { createSongRequest, sendTip } from '../services/bountyService';
import { createBattle, voteBattle } from '../services/battleService';
import { useAuth } from '../hooks/useAuth';
import Spinner from '../components/ui/Spinner';
import Badge from '../components/ui/Badge';
import Alert from '../components/ui/Alert';
import RequestSongModal from '../components/features/bounty/RequestSongModal';
import LiveStreamPlayer from '../components/features/video/LiveStreamPlayer';
import TikTokInteractions from '../components/features/video/TikTokInteractions';
import { getActiveArtists } from '../lib/roomArtists';
import { BATTLE_CATEGORIES, BOUNTY_PRESETS } from '../lib/constants';
import { sanitizeText, validateBountyValue, validateChatMessage } from '../lib/validators';

const VOTE_OPTIONS = [
  ['voice', 'Melhor voz'],
  ['repertoire', 'Melhor repertorio'],
  ['presence', 'Presenca de palco'],
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
    <div className="mx-auto min-h-[calc(100vh-4rem)] max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Badge variant="gold">{room.genre}</Badge>
          <Badge variant={artists.length > 0 ? 'live' : 'default'} pulse={artists.length > 0}>
            {artists.length} ao vivo
          </Badge>
        </div>
        <h1 className="font-display text-3xl font-black text-palco-text sm:text-4xl">{room.name}</h1>
        <p className="mt-2 max-w-2xl text-palco-text-muted">
          Escolha um cantor para abrir a live com audio, video, chat, pedido de musica, gorjeta e votacao.
        </p>
      </header>

      {artists.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {artists.map((artist) => (
            <button
              key={artist.id}
              type="button"
              onClick={() => onSelect(artist.id)}
              className="group flex min-w-0 items-center gap-4 rounded-2xl border border-palco-border bg-palco-card p-4 text-left transition hover:-translate-y-0.5 hover:border-palco-gold/60 hover:bg-palco-gold/10"
            >
              <ArtistAvatar artist={artist} size="lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-xl font-bold text-palco-text">{artist.name}</span>
                <span className="mt-1 block truncate text-sm text-palco-text-subtle">
                  {artist.current_song || artist.main_genre || 'Tocando agora'}
                </span>
                <span className="mt-3 inline-flex rounded-full bg-palco-gold px-4 py-2 text-xs font-black text-palco-black transition group-hover:bg-palco-gold-light">
                  Entrar na live
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-palco-border bg-palco-card p-8 text-center text-palco-text-muted">
          Nenhum artista esta ao vivo nessa sala agora.
        </div>
      )}
    </div>
  );
}

function LiveChat({ messages, connectionError, onSendMessage, className = '' }) {
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const visibleMessages = messages.slice(-15);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    const validation = validateChatMessage(inputText);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setSending(true);
    try {
      const result = await onSendMessage(validation.sanitized);
      if (result?.error) throw new Error(result.error.message);
      setInputText('');
    } catch (err) {
      setError(err.message || 'Nao foi possivel enviar.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={`flex h-full min-h-0 flex-col gap-3 ${className}`}>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {visibleMessages.length === 0 ? (
          <div className="rounded-2xl bg-black/35 px-4 py-3 text-sm text-palco-text-muted">
            Seja o primeiro a comentar.
          </div>
        ) : (
          visibleMessages.map((message) => {
            const isTip = message.message_type === 'tip_alert';
            const isRequest = message.message_type === 'request_alert';
            const senderName = message.sender?.name || 'Ouvinte';

            let wrapperClass = "w-fit max-w-full rounded-2xl px-4 py-2 text-sm shadow-lg backdrop-blur-sm mb-1 ";
            
            if (isTip) {
              wrapperClass += "bg-gradient-to-r from-palco-gold/25 via-palco-gold/15 to-black/35 border border-palco-gold/50 text-white animate-pulse";
            } else if (isRequest) {
              wrapperClass += "bg-gradient-to-r from-palco-live/25 via-palco-live/15 to-black/35 border border-palco-live/50 text-white";
            } else {
              wrapperClass += "bg-black/55 text-white border border-white/5";
            }

            return (
              <div key={message.id} className={wrapperClass}>
                <span className={`mr-2 font-black ${isTip ? 'text-palco-gold-light' : isRequest ? 'text-red-400' : 'text-palco-gold'}`}>
                  {isTip ? '👑 ' : isRequest ? '🎵 ' : ''}
                  {senderName}
                  {isTip && ' (Gorjeta)'}
                  {isRequest && ' (Pedido)'}
                  :
                </span>
                <span className="break-words font-semibold">{message.content}</span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          placeholder="Comente na live..."
          disabled={sending}
          className="min-w-0 flex-1 rounded-full border border-white/15 bg-black/55 px-4 py-3 text-sm text-white outline-none placeholder:text-palco-text-subtle focus:border-palco-gold disabled:opacity-60"
          maxLength={500}
        />
        <button
          type="submit"
          disabled={sending || !inputText.trim()}
          className="rounded-full bg-palco-gold px-5 py-3 text-sm font-black text-palco-black transition hover:bg-palco-gold-light disabled:opacity-60"
        >
          Enviar
        </button>
      </form>
      {(error || connectionError) && (
        <p className="px-2 text-xs text-palco-live">{error || connectionError}</p>
      )}
    </div>
  );
}

function WalletTopUp({ wallet, creditAmount, setCreditAmount, creditError, setCreditError, addingFunds, onAddFunds }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-palco-card p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-palco-gold">Carteira</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="font-display text-xl font-bold text-white">
          R$ {wallet?.balance?.toFixed(2) || '0.00'}
        </span>
        <label className="flex items-center gap-2 text-sm text-palco-text-muted">
          R$
          <input
            type="number"
            min="5"
            step="1"
            value={creditAmount}
            onChange={(event) => {
              setCreditAmount(event.target.value);
              setCreditError(null);
            }}
            className="w-24 rounded-xl border border-white/15 bg-black/45 px-3 py-2 text-sm font-bold text-white outline-none focus:border-palco-gold"
          />
        </label>
      </div>
      <button
        onClick={onAddFunds}
        disabled={addingFunds}
        className="mt-3 w-full rounded-xl bg-palco-gold px-4 py-2 text-sm font-black text-palco-black transition hover:bg-palco-gold-light disabled:opacity-50"
      >
        {addingFunds ? 'Processando...' : 'Adicionar creditos'}
      </button>
      {creditError && <p className="mt-2 text-xs text-palco-live">{creditError}</p>}
    </div>
  );
}

function LiveActions({
  activeAction,
  setActiveAction,
  selectedArtist,
  wallet,
  tipAmount,
  setTipAmount,
  tipMessage,
  setTipMessage,
  tipLoading,
  onRequest,
  onTip,
  onVote,
  votes,
  userVotes = [],
  feedback,
}) {
  const actions = [
    ['request', 'Pedir'],
    ['tip', 'Gorjeta'],
    ['vote', 'Votar'],
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-palco-card p-4">
      <div className="mb-4 grid grid-cols-3 gap-2">
        {actions.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveAction(id)}
            className={`rounded-xl px-3 py-2 text-xs font-black transition ${
              activeAction === id
                ? 'bg-palco-gold text-palco-black'
                : 'bg-white/[0.06] text-palco-text-muted hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {feedback && <div className="mb-4"><Alert type={feedback.type} message={feedback.message} /></div>}

      {activeAction === 'request' && (
        <div>
          <p className="text-sm text-palco-text-muted">
            Seu pedido entra direto na fila de {selectedArtist.name}.
          </p>
          <button
            type="button"
            onClick={onRequest}
            className="mt-4 w-full rounded-xl bg-palco-gold px-4 py-3 text-sm font-black text-palco-black transition hover:bg-palco-gold-light"
          >
            Pedir musica
          </button>
        </div>
      )}

      {activeAction === 'tip' && (
        <form onSubmit={onTip} className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {BOUNTY_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setTipAmount(preset.value)}
                className={`rounded-xl border px-2 py-2 text-xs font-black transition ${
                  Number(tipAmount) === preset.value
                    ? 'border-palco-gold bg-palco-gold text-palco-black'
                    : 'border-white/10 bg-white/[0.05] text-palco-text-muted'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-palco-text-muted">
            R$
            <input
              type="number"
              min="5"
              step="0.01"
              value={tipAmount}
              onChange={(event) => setTipAmount(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-white outline-none focus:border-palco-gold"
            />
          </label>
          <input
            value={tipMessage}
            onChange={(event) => setTipMessage(event.target.value)}
            placeholder="Mensagem da gorjeta"
            maxLength={160}
            className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-white outline-none placeholder:text-palco-text-subtle focus:border-palco-gold"
          />
          <p className="text-xs text-palco-text-subtle">
            Saldo: R$ {wallet?.balance?.toFixed(2) || '0.00'}
          </p>
          <button
            type="submit"
            disabled={tipLoading}
            className="w-full rounded-xl bg-palco-gold px-4 py-3 text-sm font-black text-palco-black transition hover:bg-palco-gold-light disabled:opacity-60"
          >
            {tipLoading ? 'Enviando...' : 'Enviar gorjeta'}
          </button>
        </form>
      )}

      {activeAction === 'vote' && (
        <div className="space-y-2">
          {VOTE_OPTIONS.map(([key, label]) => {
            const hasVoted = userVotes?.includes(key);
            return (
              <button
                key={key}
                type="button"
                disabled={hasVoted}
                onClick={() => onVote(key, label)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                  hasVoted
                    ? 'border-palco-success/20 bg-palco-success/5 text-palco-success/70 cursor-not-allowed'
                    : 'border-white/10 bg-white/[0.05] text-white hover:border-palco-gold/50'
                }`}
              >
                <span className="font-bold">{label} {hasVoted && '✓'}</span>
                <span className="rounded-full bg-palco-gold/15 px-3 py-1 text-xs font-black text-palco-gold">
                  {votes[key] || 0} Votos
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BattlePanel({
  selectedArtist,
  activeArtists,
  activeBattles,
  battleResults,
  battleSong,
  setBattleSong,
  battleAmount,
  setBattleAmount,
  battleOpponentId,
  setBattleOpponentId,
  battleLoading,
  onCreateBattle,
  onVoteBattle,
}) {
  const currentBattle = activeBattles.find((battle) =>
    [battle.challenger_artist_id, battle.opponent_artist_id].includes(selectedArtist.id)
  );
  const opponents = activeArtists.filter((artist) => artist.id !== selectedArtist.id);

  function countVotes(battleId, artistId) {
    return (battleResults[battleId] || [])
      .filter((item) => item.artist_id === artistId)
      .reduce((sum, item) => sum + Number(item.vote_count || 0), 0);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-palco-card p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-palco-gold">Batalha musical</p>

      {currentBattle ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-palco-gold/30 bg-palco-gold/10 p-3">
            <p className="font-display text-lg font-black text-white">{currentBattle.song_title}</p>
            <p className="mt-1 text-xs text-palco-text-muted">
              {currentBattle.status === 'pending' ? 'Aguardando aceite dos artistas' : 'Votacao aberta para o publico'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            {[
              [currentBattle.challenger_artist_id, currentBattle.challenger?.name || 'Artista 1'],
              [currentBattle.opponent_artist_id, currentBattle.opponent?.name || 'Artista 2'],
            ].map(([artistId, name]) => (
              <div key={artistId} className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="truncate text-sm font-bold text-white">{name}</p>
                <p className="mt-1 font-display text-2xl font-black text-palco-gold">
                  {countVotes(currentBattle.id, artistId)}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {BATTLE_CATEGORIES.map((category) => (
              <div key={category.key} className="rounded-xl border border-white/10 bg-black/25 p-2">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-palco-text-subtle">
                  {category.label}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    [currentBattle.challenger_artist_id, currentBattle.challenger?.name || 'Artista 1'],
                    [currentBattle.opponent_artist_id, currentBattle.opponent?.name || 'Artista 2'],
                  ].map(([artistId, name]) => (
                    <button
                      key={`${category.key}-${artistId}`}
                      type="button"
                      onClick={() => onVoteBattle(currentBattle, artistId, category.key)}
                      className="rounded-lg bg-white/[0.05] px-2 py-2 text-xs font-bold text-palco-text-muted transition hover:bg-palco-gold hover:text-palco-black"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : opponents.length > 0 ? (
        <form onSubmit={onCreateBattle} className="mt-4 space-y-3">
          <select
            value={battleOpponentId}
            onChange={(event) => setBattleOpponentId(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-white outline-none focus:border-palco-gold"
          >
            <option value="">Escolha o desafiante</option>
            {opponents.map((artist) => (
              <option key={artist.id} value={artist.id}>{artist.name}</option>
            ))}
          </select>
          <input
            value={battleSong}
            onChange={(event) => setBattleSong(event.target.value)}
            placeholder="Musica da batalha"
            maxLength={200}
            className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-white outline-none placeholder:text-palco-text-subtle focus:border-palco-gold"
          />
          <label className="flex items-center gap-2 text-sm text-palco-text-muted">
            R$
            <input
              type="number"
              min="5"
              step="0.01"
              value={battleAmount}
              onChange={(event) => setBattleAmount(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-white outline-none focus:border-palco-gold"
            />
          </label>
          <button
            type="submit"
            disabled={battleLoading || !battleOpponentId || !battleSong.trim()}
            className="w-full rounded-xl bg-palco-gold px-4 py-3 text-sm font-black text-palco-black transition hover:bg-palco-gold-light disabled:opacity-60"
          >
            {battleLoading ? 'Criando...' : 'Criar batalha paga'}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-palco-text-muted">
          Precisa ter pelo menos dois artistas ao vivo nesta sala.
        </p>
      )}
    </div>
  );
}


function DesktopLiveRoom({
  room,
  selectedArtist,
  listenerMedia,
  listenEnabled,
  setListenEnabled,
  messages,
  realtimeError,
  sendChatMessage,
  profile,
  wallet,
  creditAmount,
  setCreditAmount,
  creditError,
  setCreditError,
  addingFunds,
  handleAddFunds,
  activeAction,
  setActiveAction,
  tipAmount,
  setTipAmount,
  tipMessage,
  setTipMessage,
  tipLoading,
  handleBackToArtists,
  handleTipSubmit,
  handleVote,
  votes,
  userVotes,
  feedback,
  openRequestModal,
  incomingLike,
  sendLike,
  tvAlerts,
  activeArtists,
  activeBattles,
  battleResults,
  battleSong,
  setBattleSong,
  battleAmount,
  setBattleAmount,
  battleOpponentId,
  setBattleOpponentId,
  battleLoading,
  handleCreateBattle,
  handleBattleVote,
}) {
  return (
    <div className="mx-auto min-h-[calc(100vh-4rem)] max-w-7xl px-5 py-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <Badge variant="gold">{room.genre}</Badge>
            <Badge variant="live" pulse>Ao vivo</Badge>
          </div>
          <h1 className="font-display text-3xl font-black text-palco-text">{selectedArtist.name}</h1>
          <p className="mt-1 text-sm text-palco-text-muted">
            {room.name} - {selectedArtist.current_song || selectedArtist.main_genre || 'Tocando agora'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-palco-border bg-palco-card px-4 py-2 text-sm text-palco-text-muted">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-palco-success" />
            {room.listener_count || 0} ouvintes
          </div>
          <button
            type="button"
            onClick={handleBackToArtists}
            className="rounded-xl border border-palco-border px-4 py-2 text-sm font-bold text-palco-text-muted transition hover:border-palco-gold/50 hover:text-palco-gold"
          >
            Trocar cantor
          </button>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl">
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
              className="h-full w-full border-0"
              showInfo={false}
            />
            {listenEnabled && listenerMedia.status === 'live' && (
              <TikTokInteractions
                incomingLike={incomingLike}
                onSendLike={(x, y) => sendLike(x, y)}
                activeAlerts={tvAlerts}
              />
            )}
          </div>

          <section className="rounded-2xl border border-palco-border bg-palco-card p-4">
            <div className="mb-4 flex items-center gap-3">
              <ArtistAvatar artist={selectedArtist} />
              <div className="min-w-0">
                <p className="truncate font-display text-xl font-black text-palco-text">{selectedArtist.name}</p>
                <p className="truncate text-sm text-palco-text-muted">
                  Pedidos, votos e gorjetas direcionados para este artista.
                </p>
              </div>
            </div>
            <div className="h-[320px]">
              <LiveChat
              messages={messages}
              connectionError={realtimeError}
              onSendMessage={sendChatMessage}
              />
            </div>
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          {profile?.role === 'listener' && (
            <WalletTopUp
              wallet={wallet}
              creditAmount={creditAmount}
              setCreditAmount={setCreditAmount}
              creditError={creditError}
              setCreditError={setCreditError}
              addingFunds={addingFunds}
              onAddFunds={handleAddFunds}
            />
          )}
          {profile?.role === 'listener' && (
            <LiveActions
              activeAction={activeAction}
              setActiveAction={setActiveAction}
              selectedArtist={selectedArtist}
              wallet={wallet}
              tipAmount={tipAmount}
              setTipAmount={setTipAmount}
              tipMessage={tipMessage}
              setTipMessage={setTipMessage}
              tipLoading={tipLoading}
              onRequest={openRequestModal}
              onTip={handleTipSubmit}
              onVote={handleVote}
              votes={votes}
              userVotes={userVotes}
              feedback={feedback}
            />
          )}
          {profile?.role === 'listener' && (
            <BattlePanel
              selectedArtist={selectedArtist}
              activeArtists={activeArtists}
              activeBattles={activeBattles}
              battleResults={battleResults}
              battleSong={battleSong}
              setBattleSong={setBattleSong}
              battleAmount={battleAmount}
              setBattleAmount={setBattleAmount}
              battleOpponentId={battleOpponentId}
              setBattleOpponentId={setBattleOpponentId}
              battleLoading={battleLoading}
              onCreateBattle={handleCreateBattle}
              onVoteBattle={handleBattleVote}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

export default function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const [room, setRoom] = useState(null);
  const [wallet, setWallet] = useState({ balance: 0 });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [addingFunds, setAddingFunds] = useState(false);
  const [creditAmount, setCreditAmount] = useState(50);
  const [creditError, setCreditError] = useState(null);
  const [selectedArtistId, setSelectedArtistId] = useState(() => searchParams.get('artist'));
  const [listenEnabled, setListenEnabled] = useState(() => Boolean(searchParams.get('artist')));
  const [activeAction, setActiveAction] = useState('request');
  const [tipAmount, setTipAmount] = useState(10);
  const [tipMessage, setTipMessage] = useState('');
  const [tipLoading, setTipLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [presenceReady, setPresenceReady] = useState(false);
  const [battleSong, setBattleSong] = useState('');
  const [battleAmount, setBattleAmount] = useState(20);
  const [battleOpponentId, setBattleOpponentId] = useState('');
  const [battleLoading, setBattleLoading] = useState(false);


  const handleRoomUpdate = useCallback(async () => {
    const { data: fullRoom } = await getRoomById(roomId);
    if (fullRoom) setRoom(fullRoom);
  }, [roomId]);

  const activeArtists = getActiveArtists(room);
  const selectedArtist = selectedArtistId
    ? activeArtists.find((artist) => artist.id === selectedArtistId) || null
    : null;

  const [incomingLike, setIncomingLike] = useState(null);
  const handleIncomingLike = useCallback((payload) => {
    setIncomingLike({ x: payload.x, y: payload.y, timestamp: Date.now() });
  }, []);

  const {
    messages,
    realtimeError,
    sendChatMessage,
    votes,
    userVotes,
    castVote,
    sendLike,
    tvAlerts,
    activeBattles,
    battleResults,
  } = useRoomRealtime(presenceReady ? roomId : null, {
    onRoomUpdate: handleRoomUpdate,
    targetArtistId: selectedArtist?.id || null,
    onLikeReceived: handleIncomingLike,
  });

  const listenerMedia = useRoomMediaStream({
    roomId,
    artistId: selectedArtist?.id,
    role: 'listener',
    enabled: presenceReady && listenEnabled && Boolean(selectedArtist?.id),
  });

  useEffect(() => {
    let isMounted = true;
    let presenceTimer = null;

    async function setupRoom() {
      if (isMounted) {
        setRoom(null);
        setLoading(true);
        setPresenceReady(false);
      }
      const { data: roomData, error: roomError } = await getRoomById(roomId);
      if (!isMounted) return;
      if (roomError || !roomData) {
        navigate('/rooms');
        return;
      }

      if (isMounted) setRoom(roomData);

      if (profile?.id) {
        async function refreshPresence() {
          const joinResult = await joinRoom(roomId);
          if (!isMounted) {
            if (!joinResult.error) await leaveRoom(roomId, profile.id);
            return false;
          }
          if (joinResult.error) {
            setPresenceReady(false);
            setFeedback({ type: 'error', message: 'Nao foi possivel registrar sua presenca na sala.' });
          } else {
            setPresenceReady(true);
          }
          return !joinResult.error;
        }

        await refreshPresence();
        if (!isMounted) return;
        presenceTimer = setInterval(refreshPresence, 25_000);

        const { data: walletData } = await getWallet(profile.id);
        if (isMounted && walletData) setWallet(walletData);
      }

      if (isMounted) setLoading(false);
    }

    setupRoom();

    return () => {
      isMounted = false;
      clearInterval(presenceTimer);
      if (profile?.id) {
        void leaveRoom(roomId, profile.id);
      }
    };
  }, [roomId, profile, navigate]);

  const handleSelectArtist = (artistId) => {
    setSelectedArtistId(artistId);
    setListenEnabled(true);
    setFeedback(null);
    navigate(`/room/${roomId}?artist=${encodeURIComponent(artistId)}`, { replace: true });
  };

  const handleBackToArtists = () => {
    setSelectedArtistId(null);
    setListenEnabled(false);
    setFeedback(null);
    navigate(`/room/${roomId}`, { replace: true });
  };

  const handleAddFunds = async () => {
    const amount = Number(creditAmount);
    if (!Number.isFinite(amount) || amount < 5) {
      setCreditError('Valor minimo: R$ 5,00');
      return;
    }

    setCreditError(null);
    setAddingFunds(true);
    try {
      const returnTo = selectedArtist?.id
        ? `/room/${roomId}?artist=${encodeURIComponent(selectedArtist.id)}`
        : `/room/${roomId}`;
      await addFundsCheckout(amount, profile.id, returnTo);
    } catch (err) {
      console.error('Erro ao redirecionar para pagamento', err);
      setCreditError(err.message || 'Nao foi possivel iniciar o pagamento.');
      setAddingFunds(false);
    }
  };

  const handleSongRequest = async (requestData) => {
    const { error, warning } = await createSongRequest({
      roomId,
      targetArtistId: selectedArtist?.id || null,
      ...requestData,
    });

    if (error) throw new Error(error.message);

    const { data } = await getWallet(profile.id);
    if (data) setWallet(data);
    setFeedback({
      type: warning ? 'warning' : 'success',
      message: warning || 'Pedido enviado para a fila do artista.',
    });
  };

  async function handleTipSubmit(event) {
    event.preventDefault();
    setFeedback(null);

    const amountValidation = validateBountyValue(tipAmount);
    if (!amountValidation.valid) {
      setFeedback({ type: 'error', message: amountValidation.error });
      return;
    }

    const amount = Number(tipAmount);
    if ((wallet?.balance || 0) < amount) {
      setFeedback({ type: 'error', message: 'Saldo insuficiente para essa gorjeta.' });
      return;
    }

    setTipLoading(true);
    try {
      const result = await sendTip(roomId, amount, sanitizeText(tipMessage), selectedArtist.id);
      if (result?.error) throw new Error(result.error.message);

      const { data } = await getWallet(profile.id);
      if (data) setWallet(data);

      setTipMessage('');
      setFeedback({
        type: result?.data?.chat_warning ? 'warning' : 'success',
        message: result?.data?.chat_warning || 'Gorjeta enviada para o artista.',
      });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Nao foi possivel enviar a gorjeta.' });
    } finally {
      setTipLoading(false);
    }
  }

  async function handleVote(key, label) {
    try {
      const { error } = await castVote(key);
      if (error) throw error;
      const chatResult = await sendChatMessage(`Votou em "${label}" para ${selectedArtist.name}.`);
      setFeedback({
        type: chatResult?.error ? 'warning' : 'success',
        message: chatResult?.error
          ? `Voto registrado para ${label}, mas o aviso no chat nao foi publicado.`
          : `Voto registrado para a ${label} do artista!`,
      });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Não foi possível registrar seu voto.' });
    }
  }

  async function handleCreateBattle(event) {
    event.preventDefault();
    setFeedback(null);

    const amountValidation = validateBountyValue(battleAmount);
    if (!amountValidation.valid) {
      setFeedback({ type: 'error', message: amountValidation.error });
      return;
    }

    if ((wallet?.balance || 0) < Number(battleAmount)) {
      setFeedback({ type: 'error', message: 'Saldo insuficiente para criar essa batalha.' });
      return;
    }

    setBattleLoading(true);
    try {
      const { error } = await createBattle({
        roomId,
        challengerArtistId: selectedArtist.id,
        opponentArtistId: battleOpponentId,
        songTitle: sanitizeText(battleSong),
        bountyValue: Number(battleAmount),
      });

      if (error) throw error;

      const { data } = await getWallet(profile.id);
      if (data) setWallet(data);

      setBattleSong('');
      setBattleOpponentId('');
      setFeedback({ type: 'success', message: 'Batalha criada. Os artistas podem aceitar e abrir a disputa.' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Nao foi possivel criar a batalha.' });
    } finally {
      setBattleLoading(false);
    }
  }

  async function handleBattleVote(battle, artistId, category) {
    try {
      const { error } = await voteBattle({ battleId: battle.id, artistId, category });
      if (error) throw error;
      setFeedback({ type: 'success', message: 'Voto de batalha registrado.' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Nao foi possivel votar na batalha.' });
    }
  }

  if (loading || !room) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!selectedArtist) {
    return (
      <ArtistSelectionScreen
        room={room}
        artists={activeArtists}
        onSelect={handleSelectArtist}
      />
    );
  }

  return (
    <>
      <div className="hidden lg:block">
        <DesktopLiveRoom
          room={room}
          selectedArtist={selectedArtist}
          listenerMedia={listenerMedia}
          listenEnabled={listenEnabled}
          setListenEnabled={setListenEnabled}
          messages={messages}
          realtimeError={realtimeError}
          sendChatMessage={sendChatMessage}
          profile={profile}
          wallet={wallet}
          creditAmount={creditAmount}
          setCreditAmount={setCreditAmount}
          creditError={creditError}
          setCreditError={setCreditError}
          addingFunds={addingFunds}
          handleAddFunds={handleAddFunds}
          activeAction={activeAction}
          setActiveAction={setActiveAction}
          tipAmount={tipAmount}
          setTipAmount={setTipAmount}
          tipMessage={tipMessage}
          setTipMessage={setTipMessage}
          tipLoading={tipLoading}
          handleBackToArtists={handleBackToArtists}
          handleTipSubmit={handleTipSubmit}
          handleVote={handleVote}
          votes={votes}
          userVotes={userVotes}
          feedback={feedback}
          openRequestModal={() => setIsModalOpen(true)}
          incomingLike={incomingLike}
          sendLike={sendLike}
          tvAlerts={tvAlerts}
          activeArtists={activeArtists}
          activeBattles={activeBattles}
          battleResults={battleResults}
          battleSong={battleSong}
          setBattleSong={setBattleSong}
          battleAmount={battleAmount}
          setBattleAmount={setBattleAmount}
          battleOpponentId={battleOpponentId}
          setBattleOpponentId={setBattleOpponentId}
          battleLoading={battleLoading}
          handleCreateBattle={handleCreateBattle}
          handleBattleVote={handleBattleVote}
        />
      </div>

      <div className="mx-auto min-h-[calc(100vh-4rem)] max-w-7xl px-3 py-4 sm:px-5 lg:hidden">
        <section className="relative h-[calc(100svh-5.5rem)] min-h-[600px] max-h-[880px] overflow-hidden rounded-3xl border border-palco-border bg-palco-black">
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
            showInfo={false}
          />

          {listenEnabled && listenerMedia.status === 'live' && (
            <TikTokInteractions
              incomingLike={incomingLike}
              onSendLike={(x, y) => sendLike(x, y)}
              activeAlerts={tvAlerts}
              className="absolute inset-0 w-full h-full"
            />
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/10 to-black/75" />

          <div className="pointer-events-auto absolute left-4 right-4 top-4 z-40 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBackToArtists}
              className="rounded-full border border-white/15 bg-black/45 px-4 py-2 text-sm font-bold text-white backdrop-blur transition hover:border-palco-gold/60"
            >
              Trocar cantor
            </button>
            <div className="flex items-center gap-2 rounded-full bg-black/45 px-3 py-2 text-sm text-white backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-palco-success" />
              {room.listener_count || 0}
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-40 grid gap-4">
            <div className="min-w-0 pr-14">
              <div className="pointer-events-auto mb-4 flex items-center gap-3">
                <ArtistAvatar artist={selectedArtist} />
                <div className="min-w-0">
                  <p className="truncate font-display text-2xl font-black text-white">{selectedArtist.name}</p>
                  <p className="truncate text-sm text-palco-text-muted">
                    {room.name} - {selectedArtist.current_song || selectedArtist.main_genre || 'Ao vivo'}
                  </p>
                </div>
              </div>
              <LiveChat
                messages={messages}
                connectionError={realtimeError}
                onSendMessage={sendChatMessage}
                className="pointer-events-auto h-[min(32svh,240px)]"
              />
            </div>
          </div>

          {profile?.role === 'listener' && (
            <div className="pointer-events-auto absolute right-3 top-1/2 z-40 flex -translate-y-1/2 flex-col gap-3">
              {[
                ['request', '♪'],
                ['tip', 'R$'],
                ['vote', '★'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setActiveAction(id);
                    if (id === 'request') setIsModalOpen(true);
                  }}
                  className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-black shadow-lg backdrop-blur ${
                    activeAction === id
                      ? 'bg-palco-gold text-palco-black'
                      : 'bg-black/50 text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const x = 50 + Math.random() * 20 - 10;
                  const y = 70 + Math.random() * 10;
                  sendLike(x, y);
                  setIncomingLike({ x, y, timestamp: Date.now() });
                }}
                className="flex h-12 w-12 items-center justify-center rounded-full text-lg shadow-lg backdrop-blur bg-red-500/25 border border-red-500/30 text-red-400 active:scale-95 transition"
                title="Curtir"
              >
                ❤️
              </button>
            </div>
          )}
        </section>

        {profile?.role === 'listener' && (
          <div className="mt-3">
            <WalletTopUp
              wallet={wallet}
              creditAmount={creditAmount}
              setCreditAmount={setCreditAmount}
              creditError={creditError}
              setCreditError={setCreditError}
              addingFunds={addingFunds}
              onAddFunds={handleAddFunds}
            />
          </div>
        )}

        {profile?.role === 'listener' && activeAction === 'request' && feedback && (
          <div className="mt-3">
            <Alert type={feedback.type} message={feedback.message} />
          </div>
        )}

        {profile?.role === 'listener' && activeAction !== 'request' && (
          <div className="mt-3">
            <LiveActions
              activeAction={activeAction}
              setActiveAction={setActiveAction}
              selectedArtist={selectedArtist}
              wallet={wallet}
              tipAmount={tipAmount}
              setTipAmount={setTipAmount}
              tipMessage={tipMessage}
              setTipMessage={setTipMessage}
              tipLoading={tipLoading}
              onRequest={() => setIsModalOpen(true)}
              onTip={handleTipSubmit}
              onVote={handleVote}
              votes={votes}
              userVotes={userVotes}
              feedback={feedback}
            />
          </div>
        )}

        {profile?.role === 'listener' && (
          <div className="mt-3">
            <BattlePanel
              selectedArtist={selectedArtist}
              activeArtists={activeArtists}
              activeBattles={activeBattles}
              battleResults={battleResults}
              battleSong={battleSong}
              setBattleSong={setBattleSong}
              battleAmount={battleAmount}
              setBattleAmount={setBattleAmount}
              battleOpponentId={battleOpponentId}
              setBattleOpponentId={setBattleOpponentId}
              battleLoading={battleLoading}
              onCreateBattle={handleCreateBattle}
              onVoteBattle={handleBattleVote}
            />
          </div>
        )}
      </div>

      <RequestSongModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSongRequest}
        currentBalance={wallet?.balance || 0}
        targetArtistName={selectedArtist?.name}
      />
    </>
  );
}
