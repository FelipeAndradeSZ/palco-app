import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useRooms } from '../hooks/useRooms';
import { useRoomRealtime } from '../hooks/useRoomRealtime';
import { useRoomMediaStream } from '../hooks/useRoomMediaStream';
import { heartbeatArtistLive, updateRoomArtist } from '../services/roomService';
import { acceptBattle, cancelBattle, finishBattle, startBattleVoting } from '../services/battleService';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import Input from '../components/ui/Input';
import Alert from '../components/ui/Alert';
import ArtistRequestQueue from '../components/features/bounty/ArtistRequestQueue';
import ChatBox from '../components/features/chat/ChatBox';
import LocalCamera from '../components/features/video/LocalCamera';
import LiveAlertOverlay from '../components/features/tv/LiveAlertOverlay';
import { QUALITY_TIER_LABELS } from '../lib/constants';
import { getActiveArtists, roomHasArtist } from '../lib/roomArtists';
import { getWallet, requestWithdrawal, getWithdrawalRequests, getTransactions } from '../services/walletService';
import { getBookingRequests, updateBookingStatus } from '../services/venueService';

function ArtistBattleControls({ battles, profileId, onChanged }) {
  const [processingId, setProcessingId] = useState(null);
  const artistBattles = battles.filter((battle) =>
    [battle.challenger_artist_id, battle.opponent_artist_id].includes(profileId)
  );

  async function runAction(battleId, action) {
    setProcessingId(battleId);
    try {
      const { error } = await action(battleId);
      if (error) throw error;
      if (onChanged) await onChanged();
    } catch (err) {
      console.error('Erro ao atualizar batalha:', err);
    } finally {
      setProcessingId(null);
    }
  }

  if (artistBattles.length === 0) return null;

  return (
    <section className="rounded-2xl border border-palco-gold/25 bg-palco-gold/10 p-4">
      <h3 className="font-display text-lg font-black text-palco-gold">Batalhas musicais</h3>
      <div className="mt-3 space-y-3">
        {artistBattles.map((battle) => {
          const rival = battle.challenger_artist_id === profileId
            ? battle.opponent?.name || 'Artista desafiante'
            : battle.challenger?.name || 'Artista desafiante';

          return (
            <div key={battle.id} className="rounded-xl border border-white/10 bg-black/35 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-display font-bold text-white">{battle.song_title}</p>
                  <p className="mt-1 text-xs text-palco-text-muted">
                    Contra {rival} - R$ {Number(battle.bounty_value || 0).toFixed(2)} - {battle.status}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {battle.status === 'pending' && battle.opponent_artist_id === profileId && (
                    <Button
                      size="sm"
                      onClick={() => runAction(battle.id, acceptBattle)}
                      loading={processingId === battle.id}
                    >
                      Aceitar
                    </Button>
                  )}
                  {battle.status === 'active' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => runAction(battle.id, startBattleVoting)}
                      loading={processingId === battle.id}
                    >
                      Abrir votacao
                    </Button>
                  )}
                  {(battle.status === 'active' || battle.status === 'voting') && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => runAction(battle.id, finishBattle)}
                      loading={processingId === battle.id}
                    >
                      Encerrar
                    </Button>
                  )}
                  {battle.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => runAction(battle.id, cancelBattle)}
                      loading={processingId === battle.id}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}


export default function ArtistDashboardPage() {
  const { profile } = useAuth();
  const { rooms, loading: roomsLoading, refetch: refetchRooms } = useRooms();
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [liveFeedback, setLiveFeedback] = useState(null);

  // Abas do Painel
  const [activeTab, setActiveTab] = useState('live');

  // Estados Financeiros
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [fetchingWallet, setFetchingWallet] = useState(false);
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalPixKey, setWithdrawalPixKey] = useState('');
  const [walletFeedback, setWalletFeedback] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingProcessingId, setBookingProcessingId] = useState(null);
  const [bookingFeedback, setBookingFeedback] = useState(null);
  const mediaFailureRoomRef = useRef(null);

  const artistDetails = profile?.artist_details?.[0] || profile?.artist_details || {};
  const profileId = profile?.id;
  const artistPixKey = artistDetails.pix_key || '';
  const tierLabel = QUALITY_TIER_LABELS[artistDetails.quality_tier] || 'Bronze';

  const loadWalletData = useCallback(async () => {
    if (!profileId) return;
    setFetchingWallet(true);
    try {
      const [walletRes, transRes, drawRes] = await Promise.all([
        getWallet(profileId),
        getTransactions(profileId),
        getWithdrawalRequests(profileId),
      ]);

      if (walletRes.data) {
        setWallet(walletRes.data);
        const savedPix = walletRes.data.pix_key || artistPixKey;
        setWithdrawalPixKey((prev) => prev || savedPix);
      }
      if (transRes.data) setTransactions(transRes.data);
      if (drawRes.data) setWithdrawalRequests(drawRes.data);
    } catch (err) {
      console.error('Erro ao carregar dados financeiros:', err);
    } finally {
      setFetchingWallet(false);
    }
  }, [artistPixKey, profileId]);

  const loadBookings = useCallback(async () => {
    if (!profileId) return;
    setBookingsLoading(true);
    try {
      const { data, error } = await getBookingRequests(profileId, 'artist');
      if (error) throw error;
      setBookings(data || []);
    } catch (err) {
      setBookingFeedback({ type: 'error', message: err.message || 'Nao foi possivel carregar as contratacoes.' });
    } finally {
      setBookingsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (profile?.id) {
      loadWalletData();
    }
  }, [profile?.id, activeTab, loadWalletData]);

  useEffect(() => {
    if (activeTab === 'bookings') loadBookings();
  }, [activeTab, loadBookings]);

  const handleBookingStatus = async (requestId, status) => {
    setBookingProcessingId(requestId);
    setBookingFeedback(null);
    try {
      const { error } = await updateBookingStatus(requestId, status);
      if (error) throw error;
      setBookingFeedback({
        type: 'success',
        message: status === 'accepted' ? 'Contratacao aceita.' : 'Contratacao recusada.',
      });
      await loadBookings();
    } catch (err) {
      setBookingFeedback({ type: 'error', message: err.message || 'Nao foi possivel responder a contratacao.' });
    } finally {
      setBookingProcessingId(null);
    }
  };

  const handleWithdrawalSubmit = async (e) => {
    e.preventDefault();
    setWalletFeedback(null);

    const amount = Number(withdrawalAmount);
    if (!amount || amount < 10) {
      setWalletFeedback({ type: 'error', message: 'O valor mínimo para saque é R$ 10,00.' });
      return;
    }

    if (amount > (wallet?.balance || 0)) {
      setWalletFeedback({ type: 'error', message: 'Saldo insuficiente.' });
      return;
    }

    if (!withdrawalPixKey.trim()) {
      setWalletFeedback({ type: 'error', message: 'Chave PIX é obrigatória.' });
      return;
    }

    setSubmittingWithdrawal(true);
    try {
      const { error } = await requestWithdrawal(amount, withdrawalPixKey.trim());
      if (error) throw error;

      setWalletFeedback({ type: 'success', message: `Saque de R$ ${amount.toFixed(2)} solicitado com sucesso!` });
      setWithdrawalAmount('');
      await loadWalletData();
    } catch (err) {
      console.error(err);
      setWalletFeedback({ type: 'error', message: err.message || 'Erro ao processar saque.' });
    } finally {
      setSubmittingWithdrawal(false);
    }
  };

  const assignedRoomId = useMemo(() => {
    if (!profile?.id) return null;
    return rooms.find((room) => roomHasArtist(room, profile.id))?.id || null;
  }, [profile, rooms]);

  const activeRoomId = selectedRoomId || assignedRoomId;
  const activeRoom = rooms.find((room) => room.id === activeRoomId);

  useEffect(() => {
    if (!selectedRoomId || roomsLoading || isProcessing) return;
    if (!rooms.some((room) => roomHasArtist(room, profile?.id))) {
      setSelectedRoomId(null);
    }
  }, [isProcessing, profile?.id, rooms, roomsLoading, selectedRoomId]);

  useEffect(() => {
    if (!activeRoomId || !profile?.id) return undefined;

    let cancelled = false;
    let reportedFailure = false;

    async function heartbeat() {
      const { error } = await heartbeatArtistLive(activeRoomId);
      if (!cancelled && error && !reportedFailure) {
        reportedFailure = true;
        setLiveFeedback({
          type: 'error',
          message: 'A transmissao perdeu contato com a sala. Encerre o show e entre novamente.',
        });
      }
    }

    heartbeat();
    const timer = setInterval(heartbeat, 25_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeRoomId, profile?.id]);

  const { activeRequests, activeBattles, messages, isConnected, sendChatMessage, tvAlerts } = useRoomRealtime(activeRoomId, {
    targetArtistId: profile?.id || null,
  });
  const mediaStream = useRoomMediaStream({
    roomId: activeRoomId,
    artistId: profile?.id,
    role: 'artist',
    enabled: Boolean(activeRoomId && profile?.id),
  });

  useEffect(() => {
    if (!activeRoomId || mediaStream.status !== 'error') return;
    if (mediaFailureRoomRef.current === activeRoomId) return;

    mediaFailureRoomRef.current = activeRoomId;
    let cancelled = false;

    async function removeUnavailableStream() {
      setIsProcessing(true);
      try {
        await updateRoomArtist(activeRoomId, null);
        if (!cancelled) {
          setSelectedRoomId(null);
          setLiveFeedback({
            type: 'error',
            message: mediaStream.error || 'A transmissao foi encerrada porque camera ou microfone ficaram indisponiveis.',
          });
        }
        await refetchRooms();
      } catch (err) {
        if (!cancelled) {
          setLiveFeedback({
            type: 'error',
            message: err.message || 'A midia falhou e nao foi possivel atualizar a sala.',
          });
        }
      } finally {
        if (!cancelled) setIsProcessing(false);
      }
    }

    void removeUnavailableStream();
    return () => {
      cancelled = true;
    };
  }, [activeRoomId, mediaStream.error, mediaStream.status, refetchRooms]);


  const handleGoLive = async (roomId) => {
    setIsProcessing(true);
    setLiveFeedback(null);
    mediaFailureRoomRef.current = null;
    try {
      await updateRoomArtist(roomId, profile.id);
      setSelectedRoomId(roomId);
      await refetchRooms();
    } catch (err) {
      console.error('Erro ao entrar ao vivo', err);
      setLiveFeedback({ type: 'error', message: err.message || 'Nao foi possivel entrar nesta sala.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStopLive = async () => {
    if (!activeRoomId) return;
    setIsProcessing(true);
    setLiveFeedback(null);
    try {
      await updateRoomArtist(activeRoomId, null);
      setSelectedRoomId(null);
      await refetchRooms();
    } catch (err) {
      console.error('Erro ao sair do ar', err);
      setLiveFeedback({ type: 'error', message: err.message || 'Nao foi possivel encerrar a transmissao.' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Badge variant={activeRoomId ? 'live' : 'default'} pulse={!!activeRoomId}>
              {activeRoomId ? 'AO VIVO' : 'OFFLINE'}
            </Badge>
            <Badge variant="tier">{tierLabel}</Badge>
          </div>
          <h1 className="font-display text-3xl font-black text-palco-text">
            Painel do artista
          </h1>
          <p className="mt-1 text-palco-text-muted">
            Entre em uma sala, transmita e controle pedidos sem editar perfil toda hora.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/profile"
            className="rounded-xl border border-palco-border px-4 py-2 text-sm font-bold text-palco-text-muted no-underline transition hover:border-palco-gold/50 hover:text-palco-gold"
          >
            Editar perfil
          </Link>
          {activeRoomId && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleStopLive}
              loading={isProcessing}
            >
              Encerrar show
            </Button>
          )}
        </div>
      </div>

      {liveFeedback && (
        <div className="mb-5">
          <Alert type={liveFeedback.type} message={liveFeedback.message} />
        </div>
      )}

      {/* Navegação por Abas (Tabs) */}
      <div className="mb-6 flex border-b border-palco-border">
        <button
          type="button"
          onClick={() => setActiveTab('live')}
          className={`pb-3 px-4 font-display font-bold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === 'live'
              ? 'border-palco-gold text-palco-gold'
              : 'border-transparent text-palco-text-muted hover:text-palco-text'
          }`}
        >
          🎸 Show ao Vivo
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('wallet')}
          className={`pb-3 px-4 font-display font-bold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === 'wallet'
              ? 'border-palco-gold text-palco-gold'
              : 'border-transparent text-palco-text-muted hover:text-palco-text'
          }`}
        >
          💼 Minha Carteira {wallet?.balance > 0 && `(R$ ${wallet.balance.toFixed(2)})`}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bookings')}
          className={`border-b-2 px-4 pb-3 font-display text-sm font-bold transition-all ${
            activeTab === 'bookings'
              ? 'border-palco-gold text-palco-gold'
              : 'border-transparent text-palco-text-muted hover:text-palco-text'
          }`}
        >
          Contratacoes
        </button>
      </div>

      {activeTab === 'live' && (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <div className="p-5">
                <p className="mb-1 text-sm text-palco-text-subtle">Genero</p>
                <p className="truncate font-display text-xl font-bold text-palco-text">
                  {artistDetails.main_genre || '-'}
                </p>
              </div>
            </Card>
            <Card>
              <div className="p-5">
                <p className="mb-1 text-sm text-palco-text-subtle">Avaliacao</p>
                <p className="font-display text-xl font-bold text-palco-text">
                  {Number(artistDetails.rating || 0).toFixed(1)}
                </p>
              </div>
            </Card>
            <Card>
              <div className="p-5">
                <p className="mb-1 text-sm text-palco-text-subtle">Horas ao vivo</p>
                <p className="font-display text-xl font-bold text-palco-text">
                  {artistDetails.total_hours_streamed || 0}h
                </p>
              </div>
            </Card>
            <Card>
              <div className="p-5">
                <p className="mb-1 text-sm text-palco-text-subtle">Sala atual</p>
                <p className="truncate font-display text-xl font-bold text-palco-gold">
                  {activeRoom?.name || 'Nenhuma'}
                </p>
              </div>
            </Card>
          </div>

          {activeRoomId ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="min-w-0 space-y-6">
                <div className="flex flex-col gap-4 rounded-2xl border border-palco-live/30 bg-palco-live/10 p-4 shadow-[0_0_20px_rgba(220,38,38,0.15)] sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <span className="h-3 w-3 shrink-0 rounded-full bg-palco-live" />
                    <div>
                      <p className="font-bold text-palco-live">Voce esta no ar</p>
                      <p className="text-sm text-palco-text-muted">
                        Camera e microfone estao sendo enviados para ouvintes desta sala.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleStopLive}
                    loading={isProcessing}
                    className="w-full sm:w-auto"
                  >
                    Sair da sala
                  </Button>
                </div>

                <div className="relative">
                  <LocalCamera
                    isActive
                    stream={mediaStream.localStream}
                    status={mediaStream.status}
                    error={mediaStream.error}
                    artistName={profile?.name}
                  />
                  <LiveAlertOverlay alerts={tvAlerts} />
                </div>
                <ArtistBattleControls
                  battles={activeBattles}
                  profileId={profile?.id}
                  onChanged={refetchRooms}
                />
                <ArtistRequestQueue
                  activeRequests={activeRequests}
                  artistId={profile?.id}
                  onStatusChanged={loadWalletData}
                />
              </div>

              <div className="min-w-0 space-y-4">
                <h3 className="font-display font-bold text-palco-text">Chat ao vivo</h3>
                <div className="h-[560px]">
                  <ChatBox
                    messages={messages}
                    isConnected={isConnected}
                    onSendMessage={sendChatMessage}
                  />
                </div>
              </div>
            </div>
          ) : (
            <section>
              <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <h2 className="font-display text-2xl font-bold text-palco-text">
                    Escolha uma sala para tocar
                  </h2>
                  <p className="mt-1 text-sm text-palco-text-muted">
                    Uma sala pode ter varios artistas ao mesmo tempo. O publico escolhe voce dentro dela.
                  </p>
                </div>
              </div>

              {roomsLoading ? (
                <p className="text-palco-text-muted">Carregando salas...</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {rooms.map((room) => {
                    const artists = getActiveArtists(room);
                    return (
                      <Card key={room.id} hover>
                        <div className="p-5">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <h3 className="font-display font-bold text-palco-text">{room.name}</h3>
                            {artists.length > 0 && (
                              <Badge variant="live" pulse>
                                {artists.length} ao vivo
                              </Badge>
                            )}
                          </div>
                          <p className="mb-4 text-sm text-palco-text-subtle">
                            {room.genre} - {room.listener_count || 0} ouvintes
                          </p>
                          {artists.length > 0 && (
                            <p className="mb-4 text-xs text-palco-text-subtle">
                              Tocando agora: {artists.map((artist) => artist.name).join(', ')}
                            </p>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full"
                            disabled={isProcessing || roomHasArtist(room, profile?.id)}
                            loading={isProcessing && !activeRoomId}
                            onClick={() => handleGoLive(room.id)}
                          >
                            {roomHasArtist(room, profile?.id) ? 'Voce ja esta nesta sala' : 'Entrar ao vivo'}
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {activeTab === 'wallet' && (
        <div className="space-y-8 animate-[fadeIn_0.2s_ease-out]">
          {/* Feedback/Alerts */}
          {walletFeedback && (
            <div className="mb-4">
              <Alert
                type={walletFeedback.type}
                message={walletFeedback.message}
                onClose={() => setWalletFeedback(null)}
              />
            </div>
          )}

          {/* Wallet Metrics Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <div className="p-5">
                <p className="mb-1 text-sm text-palco-text-subtle">Saldo Disponível</p>
                {fetchingWallet && !wallet ? (
                  <div className="py-2"><Spinner size="sm" /></div>
                ) : (
                  <p className="font-display text-3xl font-black text-palco-gold">
                    R$ {Number(wallet?.balance || 0).toFixed(2)}
                  </p>
                )}
              </div>
            </Card>

            <Card>
              <div className="p-5">
                <p className="mb-1 text-sm text-palco-text-subtle">Saques Pendentes</p>
                {fetchingWallet && withdrawalRequests.length === 0 ? (
                  <div className="py-2"><Spinner size="sm" /></div>
                ) : (
                  <p className="font-display text-3xl font-black text-palco-text">
                    R$ {Number(
                      withdrawalRequests
                        .filter(r => r.status === 'pending')
                        .reduce((acc, curr) => acc + Number(curr.amount), 0)
                    ).toFixed(2)}
                  </p>
                )}
              </div>
            </Card>

            <Card>
              <div className="p-5">
                <p className="mb-1 text-sm text-palco-text-subtle">Total de Ganhos</p>
                {fetchingWallet && transactions.length === 0 ? (
                  <div className="py-2"><Spinner size="sm" /></div>
                ) : (
                  <p className="font-display text-3xl font-black text-palco-success">
                    R$ {Number(
                      transactions
                        .filter(t => t.receiver_id === profile.id && t.status === 'completed')
                        .reduce((acc, curr) => acc + (Number(curr.amount) - Number(curr.platform_fee || 0)), 0)
                    ).toFixed(2)}
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Main Action area: Withdrawal Form and History */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            {/* Left side: Transactions ledger & Simulation */}
            <div className="min-w-0 space-y-6">

              {/* Transactions Ledger */}
              <Card>
                <div className="p-5">
                  <h3 className="font-display font-bold text-xl text-palco-text mb-4">
                    Extrato de Movimentações
                  </h3>

                  {fetchingWallet && transactions.length === 0 ? (
                    <div className="flex justify-center py-8"><Spinner size="md" /></div>
                  ) : transactions.length === 0 ? (
                    <p className="text-center py-8 text-sm text-palco-text-subtle">
                      Nenhuma movimentação financeira encontrada.
                    </p>
                  ) : (
                    <div className="divide-y divide-palco-border/60 max-h-[500px] overflow-y-auto pr-1">
                      {transactions.map((trans) => {
                        const isEarnings = trans.receiver_id === profile.id;
                        const finalAmount = isEarnings 
                          ? Number(trans.amount) - Number(trans.platform_fee || 0)
                          : Number(trans.amount);
                        
                        let typeLabel;
                        let description;
                        let typeBadgeVariant = 'default';

                        if (trans.type === 'tip') {
                          typeLabel = 'Gorjeta';
                          typeBadgeVariant = 'gold';
                          description = isEarnings 
                            ? `Recebida de ${trans.sender?.name || 'Ouvinte'}`
                            : `Enviada para ${trans.receiver?.name || 'Artista'}`;
                        } else if (trans.type === 'song_request') {
                          typeLabel = 'Pedido Musical';
                          typeBadgeVariant = 'success';
                          description = `Música aceita: "${trans.metadata?.song_title || 'Pedido'}"`;
                        } else if (trans.type === 'withdrawal') {
                          typeLabel = 'Saque PIX';
                          typeBadgeVariant = 'default';
                          description = `Transferência PIX para chave: ${trans.metadata?.pix_key || 'Chave'}`;
                        } else {
                          typeLabel = 'Transação';
                          description = 'Movimentação interna';
                        }

                        return (
                          <div key={trans.id} className="py-3 flex items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={typeBadgeVariant} className="text-[10px] py-0.5 px-1.5">
                                  {typeLabel}
                                </Badge>
                                <span className="text-[10px] text-palco-text-subtle">
                                  {new Date(trans.created_at).toLocaleDateString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-palco-text">{description}</p>
                              {trans.metadata?.message && (
                                <p className="text-xs italic text-palco-text-muted mt-1">
                                  "{trans.metadata.message}"
                                </p>
                              )}
                              {isEarnings && Number(trans.platform_fee) > 0 && (
                                <p className="text-[10px] text-palco-text-subtle">
                                  Taxa PALCO (10%): - R$ {Number(trans.platform_fee).toFixed(2)}
                                </p>
                              )}
                            </div>
                            <span className={`font-display font-bold text-sm shrink-0 ${isEarnings ? 'text-palco-success' : 'text-palco-live'}`}>
                              {isEarnings ? '+' : '-'} R$ {finalAmount.toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Right side: Withdrawal Form and Payout status */}
            <div className="min-w-0 space-y-6">
              {/* Withdrawal Request Form */}
              <Card>
                <div className="p-5">
                  <h3 className="font-display font-bold text-lg text-palco-text mb-4">
                    Solicitar Saque (PIX)
                  </h3>

                  <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
                    <Input
                      id="withdraw-amount"
                      label="Valor do saque (R$)"
                      type="number"
                      placeholder="Min: R$ 10,00"
                      min="10"
                      step="0.01"
                      value={withdrawalAmount}
                      onChange={(e) => setWithdrawalAmount(e.target.value)}
                      disabled={submittingWithdrawal}
                    />

                    <Input
                      id="withdraw-pix-key"
                      label="Chave PIX destinatária"
                      placeholder="Seu CPF, e-mail, celular ou chave aleatória"
                      value={withdrawalPixKey}
                      onChange={(e) => setWithdrawalPixKey(e.target.value)}
                      disabled={submittingWithdrawal}
                    />

                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full"
                      loading={submittingWithdrawal}
                      disabled={Number(withdrawalAmount) > (wallet?.balance || 0) || Number(withdrawalAmount) < 10}
                    >
                      Solicitar Transferência
                    </Button>
                  </form>
                </div>
              </Card>

              {/* Saques Recentes */}
              <Card>
                <div className="p-5">
                  <h3 className="font-display font-bold text-base text-palco-text mb-3">
                    Saques Recentes
                  </h3>

                  {fetchingWallet && withdrawalRequests.length === 0 ? (
                    <div className="flex justify-center py-4"><Spinner size="sm" /></div>
                  ) : withdrawalRequests.length === 0 ? (
                    <p className="text-xs text-palco-text-subtle py-4 text-center">
                      Nenhuma solicitação de saque realizada.
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      {withdrawalRequests.map((req) => {
                        let statusText = 'Pendente';
                        let statusVariant = 'default';

                        if (req.status === 'completed') {
                          statusText = 'Pago';
                          statusVariant = 'success';
                        } else if (req.status === 'rejected') {
                          statusText = 'Recusado';
                          statusVariant = 'live';
                        }

                        return (
                          <div key={req.id} className="p-3 bg-palco-black/35 rounded-xl border border-palco-border/60">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="font-display font-black text-sm text-palco-text">
                                R$ {Number(req.amount).toFixed(2)}
                              </span>
                              <Badge variant={statusVariant} className="text-[9px] py-0.5 px-1.5">
                                {statusText}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-palco-text-muted truncate">
                              Chave PIX: {req.pix_key}
                            </p>
                            <p className="text-[9px] text-palco-text-subtle">
                              Data: {new Date(req.created_at).toLocaleDateString('pt-BR')}
                            </p>
                            {req.status === 'rejected' && req.rejection_reason && (
                              <p className="mt-1.5 p-1.5 bg-palco-live/10 border border-palco-live/20 rounded text-[10px] text-palco-live italic">
                                Motivo: {req.rejection_reason}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'bookings' && (
        <section className="space-y-4">
          {bookingFeedback && (
            <Alert
              type={bookingFeedback.type}
              message={bookingFeedback.message}
              onClose={() => setBookingFeedback(null)}
            />
          )}

          {bookingsLoading ? (
            <div className="flex min-h-48 items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : bookings.length === 0 ? (
            <Card>
              <div className="p-8 text-center text-sm text-palco-text-muted">
                Nenhuma solicitacao de contratacao recebida.
              </div>
            </Card>
          ) : (
            bookings.map((request) => (
              <Card key={request.id}>
                <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-black text-palco-text">
                        {request.venue?.name || 'Estabelecimento PALCO'}
                      </h3>
                      <Badge variant={request.status === 'accepted' ? 'success' : request.status === 'declined' ? 'live' : 'gold'}>
                        {request.status === 'pending' ? 'Pendente' : request.status === 'accepted' ? 'Aceita' : request.status === 'declined' ? 'Recusada' : 'Cancelada'}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-palco-text-muted">
                      {[request.city, request.state].filter(Boolean).join(' / ') || 'Local a combinar'}
                      {request.event_date ? ` - ${new Date(request.event_date).toLocaleString('pt-BR')}` : ''}
                    </p>
                    {request.budget && (
                      <p className="mt-1 text-sm font-bold text-palco-gold">
                        Orcamento: R$ {Number(request.budget).toFixed(2)}
                      </p>
                    )}
                    {request.message && (
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-palco-text">{request.message}</p>
                    )}
                  </div>
                  {request.status === 'pending' && (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={bookingProcessingId === request.id}
                        onClick={() => handleBookingStatus(request.id, 'declined')}
                      >
                        Recusar
                      </Button>
                      <Button
                        size="sm"
                        loading={bookingProcessingId === request.id}
                        onClick={() => handleBookingStatus(request.id, 'accepted')}
                      >
                        Aceitar
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </section>
      )}
    </div>
  );
}
