import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useRoomRealtime } from '../hooks/useRoomRealtime';
import { getRoomById, joinRoom, leaveRoom } from '../services/roomService';
import { getWallet, addFundsCheckout } from '../services/walletService';
import { createSongRequest } from '../services/bountyService';
import { useAuth } from '../hooks/useAuth';
import ChatBox from '../components/features/chat/ChatBox';
import Spinner from '../components/ui/Spinner';
import Badge from '../components/ui/Badge';
import RequestSongModal from '../components/features/bounty/RequestSongModal';
import { getActiveArtists, getArtistInteractionUrl, getPrimaryArtist } from '../lib/roomArtists';

export default function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [room, setRoom] = useState(null);
  const [wallet, setWallet] = useState({ balance: 0 });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [addingFunds, setAddingFunds] = useState(false);
  const [creditAmount, setCreditAmount] = useState(50);
  const [creditError, setCreditError] = useState(null);
  const [selectedArtistId, setSelectedArtistId] = useState(null);

  const handleRoomUpdate = useCallback(async () => {
    const { data: fullRoom } = await getRoomById(roomId);
    if (fullRoom) setRoom(fullRoom);
  }, [roomId]);

  const activeArtists = getActiveArtists(room);
  const selectedArtist = getPrimaryArtist(room, selectedArtistId);
  const interactionUrl = selectedArtist
    ? getArtistInteractionUrl(roomId, selectedArtist.id)
    : getArtistInteractionUrl(roomId);

  const { messages, isConnected, sendChatMessage } = useRoomRealtime(roomId, {
    onRoomUpdate: handleRoomUpdate,
    targetArtistId: selectedArtist?.id || null,
  });

  useEffect(() => {
    let isMounted = true;

    async function setupRoom() {
      const { data: roomData, error: roomError } = await getRoomById(roomId);
      if (roomError || !roomData) {
        navigate('/');
        return;
      }

      if (isMounted) setRoom(roomData);

      if (profile?.id) {
        await joinRoom(roomId, profile.id, profile.role);

        const { data: walletData } = await getWallet(profile.id);
        if (isMounted && walletData) setWallet(walletData);
      }

      if (isMounted) setLoading(false);
    }

    setupRoom();

    return () => {
      isMounted = false;
      if (profile?.id) {
        leaveRoom(roomId, profile.id);
      }
    };
  }, [roomId, profile, navigate]);

  const handleAddFunds = async () => {
    const amount = Number(creditAmount);
    if (!Number.isFinite(amount) || amount < 5) {
      setCreditError('Valor mínimo: R$ 5,00');
      return;
    }

    setCreditError(null);
    setAddingFunds(true);
    try {
      await addFundsCheckout(amount, profile.id);
    } catch (err) {
      console.error('Erro ao redirecionar para pagamento', err);
      setCreditError(err.message || 'Não foi possível iniciar o pagamento.');
      setAddingFunds(false);
    }
  };

  const handleSongRequest = async (requestData) => {
    const { error } = await createSongRequest({
      roomId,
      targetArtistId: selectedArtist?.id || null,
      ...requestData,
    });

    if (error) throw new Error(error.message);

    const { data } = await getWallet(profile.id);
    if (data) setWallet(data);
  };

  if (loading || !room) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-6xl flex-col px-4 py-6 sm:px-6">
      <div className="mb-6 flex shrink-0 flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-palco-text">{room.name}</h1>
            {activeArtists.length > 0 && (
              <Badge variant="live" pulse>
                {activeArtists.length} ao vivo
              </Badge>
            )}
          </div>
          <p className="text-palco-text-muted">
            {selectedArtist ? `Interagindo com ${selectedArtist.name}` : 'Escolha um artista quando a sala estiver ao vivo'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="gold">{room.genre}</Badge>
          <div className="hidden items-center gap-1.5 text-sm text-palco-text-subtle sm:flex">
            <span className="h-2 w-2 rounded-full bg-palco-success" />
            {room.listener_count || 0} ouvintes
          </div>

          {profile?.role === 'listener' && (
            <div className="rounded-lg border border-palco-border bg-palco-dark/50 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-palco-gold">
                  Saldo R$ {wallet?.balance?.toFixed(2) || '0.00'}
                </span>
                <label className="flex items-center gap-1 text-xs text-palco-text-muted">
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
                    className="w-20 rounded border border-palco-border bg-palco-black px-2 py-1 text-xs font-bold text-palco-text outline-none focus:border-palco-gold"
                  />
                </label>
                <button
                  onClick={handleAddFunds}
                  disabled={addingFunds}
                  className="rounded border border-palco-border px-2 py-1 text-xs font-bold text-palco-text transition hover:text-palco-gold disabled:opacity-50"
                  title="Comprar saldo via Stripe"
                >
                  {addingFunds ? 'Processando...' : 'Adicionar'}
                </button>
              </div>
              {creditError && (
                <p className="mt-1 text-xs text-palco-live">{creditError}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="relative flex flex-col gap-6 overflow-y-auto lg:col-span-2">
          {profile?.role === 'listener' && selectedArtist && (
            <div className="absolute left-4 top-4 z-10">
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 rounded-full bg-palco-gold px-6 py-3 font-display text-lg font-bold text-palco-black shadow-[0_0_20px_rgba(212,168,67,0.4)] transition hover:scale-105 hover:shadow-[0_0_30px_rgba(212,168,67,0.6)]"
              >
                Pedir música
              </button>
            </div>
          )}

          <section className="rounded-2xl border border-palco-border bg-palco-card p-4">
            <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-display font-bold text-palco-text">Artistas nesta sala</h2>
                <p className="text-sm text-palco-text-subtle">
                  O ouvinte escolhe o artista antes de pedir música, votar ou mandar gorjeta.
                </p>
              </div>
              <Link
                to={interactionUrl}
                className="rounded-xl border border-palco-gold/40 px-3 py-2 text-center text-xs font-bold text-palco-gold transition hover:bg-palco-gold/10"
              >
                Abrir interação pública
              </Link>
            </div>

            {activeArtists.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {activeArtists.map((artist) => (
                  <button
                    key={artist.id}
                    type="button"
                    onClick={() => setSelectedArtistId(artist.id)}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                      selectedArtist?.id === artist.id
                        ? 'border-palco-gold bg-palco-gold/10'
                        : 'border-palco-border bg-palco-dark/50 hover:border-palco-gold/40'
                    }`}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-palco-gold/20 text-sm font-bold text-palco-gold">
                      {artist.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-palco-text">{artist.name}</p>
                      <p className="text-xs text-palco-text-subtle">{artist.main_genre || 'Tocando agora'}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-palco-border p-6 text-center text-palco-text-subtle">
                Nenhum artista ao vivo nesta sala agora.
              </div>
            )}
          </section>

          <div className="relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-2xl border border-palco-border bg-palco-card shadow-inner">
            <div className="absolute inset-0 bg-gradient-to-t from-palco-black/80 via-transparent to-transparent" />
            <div className="z-10 mb-4 flex h-24 w-24 items-center justify-center rounded-full border-4 border-palco-border bg-palco-dark">
              <span className="text-4xl">{selectedArtist ? selectedArtist.name.charAt(0) : 'P'}</span>
            </div>
            <p className="z-10 font-display text-xl font-bold text-palco-text">
              {selectedArtist?.name || 'O palco está vazio'}
            </p>
            <p className="z-10 mt-2 text-sm text-palco-text-muted">
              {selectedArtist ? 'Pedidos e votos estão direcionados para este artista.' : 'A música acontece aqui.'}
            </p>
          </div>
        </div>

        <div className="h-[400px] min-h-0 lg:h-auto">
          <ChatBox
            messages={messages}
            isConnected={isConnected}
            onSendMessage={sendChatMessage}
          />
        </div>
      </div>

      <RequestSongModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSongRequest}
        currentBalance={wallet?.balance || 0}
        targetArtistName={selectedArtist?.name}
      />
    </div>
  );
}
