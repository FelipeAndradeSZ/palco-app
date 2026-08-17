import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  approveWithdrawal,
  getAdminStatus,
  getAdminWithdrawals,
  getArtistCandidates,
  rejectWithdrawal,
  updateArtistTier,
  MASTER_ADMIN_EMAIL,
} from '../services/curatorService';
import { QUALITY_TIER_LABELS, QUALITY_TIERS } from '../lib/constants';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';

const QUALITY_OPTIONS = [
  QUALITY_TIERS.BRONZE,
  QUALITY_TIERS.PRATA,
  QUALITY_TIERS.OURO,
  QUALITY_TIERS.PREMIUM,
  QUALITY_TIERS.VERIFIED,
];

export default function AdminCuratorPage() {
  const { user } = useAuth();
  const [artists, setArtists] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [activeTab, setActiveTab] = useState('artists');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [serverAdmin, setServerAdmin] = useState(false);
  const [withdrawalDialog, setWithdrawalDialog] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const canOpenAdmin = serverAdmin;

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setFeedback(null);

    try {
      const status = await getAdminStatus();
      if (status.error) throw status.error;

      const authorized = Boolean(status.data);
      setServerAdmin(authorized);
      if (!authorized) {
        setArtists([]);
        setWithdrawals([]);
        return;
      }

      const [artistsResult, withdrawalsResult] = await Promise.all([
        getArtistCandidates(),
        getAdminWithdrawals(),
      ]);

      if (artistsResult.error) throw artistsResult.error;
      if (withdrawalsResult.error) throw withdrawalsResult.error;

      setArtists(artistsResult.data || []);
      setWithdrawals(withdrawalsResult.data || []);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Nao foi possivel carregar o painel admin.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadAdminData();
    }
  }, [user?.id, loadAdminData]);

  const filteredArtists = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return artists;

    return artists.filter((artist) => {
      const details = artist.artist_details || {};
      return [
        artist.name,
        details.main_genre,
        details.quality_tier,
        details.city,
        details.state,
        details.region,
      ].some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [artists, search]);

  async function handleTierChange(profileId, qualityTier) {
    setProcessingId(profileId);
    setFeedback(null);

    try {
      const { error } = await updateArtistTier(profileId, qualityTier);
      if (error) throw error;
      setFeedback({ type: 'success', message: 'Categoria do artista atualizada.' });
      await loadAdminData();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Nao foi possivel atualizar o artista.' });
    } finally {
      setProcessingId(null);
    }
  }

  async function handleWithdrawal(request, action, reason = '') {
    setProcessingId(request.id);
    setFeedback(null);

    try {
      const result = action === 'approve'
        ? await approveWithdrawal(request.id)
        : await rejectWithdrawal(request.id, reason.trim());

      if (result.error) throw result.error;
      setFeedback({
        type: 'success',
        message: action === 'approve' ? 'PIX confirmado como pago.' : 'Saque recusado e saldo devolvido ao artista.',
      });
      setWithdrawalDialog(null);
      setRejectionReason('');
      await loadAdminData();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Nao foi possivel processar o saque.' });
    } finally {
      setProcessingId(null);
    }
  }

  function openWithdrawalDialog(request, action) {
    setWithdrawalDialog({ request, action });
    setRejectionReason('');
  }

  if (!canOpenAdmin && !loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <div className="p-6">
            <Badge variant="live">Acesso restrito</Badge>
            <h1 className="mt-4 font-display text-3xl font-black text-palco-text">Admin PALCO</h1>
            <p className="mt-3 text-sm leading-6 text-palco-text-muted">
              Este painel e fechado para curadoria, saques e operacao. O admin master configurado e {MASTER_ADMIN_EMAIL}.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Badge variant="gold">Admin master</Badge>
            <Badge variant={serverAdmin ? 'success' : 'default'}>
              {serverAdmin ? 'Autorizado no banco' : 'Aguardando migration'}
            </Badge>
          </div>
          <h1 className="font-display text-3xl font-black text-palco-text">Admin PALCO</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-palco-text-muted">
            Curadoria de artistas, aprovacao de categorias e operacao financeira controlada.
          </p>
        </div>
        <Button variant="secondary" onClick={loadAdminData} disabled={loading}>
          Atualizar
        </Button>
      </header>

      {feedback && (
        <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
          feedback.type === 'success'
            ? 'border-palco-success/30 bg-palco-success/10 text-palco-success'
            : 'border-palco-live/30 bg-palco-live/10 text-palco-live'
        }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2 border-b border-palco-border">
        {[
          ['artists', 'Curadoria'],
          ['withdrawals', 'Saques'],
          ['ops', 'Operacao'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`border-b-2 px-4 py-3 text-sm font-black transition ${
              activeTab === id
                ? 'border-palco-gold text-palco-gold'
                : 'border-transparent text-palco-text-muted hover:text-palco-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : activeTab === 'artists' ? (
        <section>
          <div className="mb-4">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, genero, cidade, estado ou categoria..."
              className="w-full rounded-xl border border-palco-border bg-palco-dark px-4 py-3 text-sm text-palco-text outline-none focus:border-palco-gold"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {filteredArtists.map((artist) => {
              const details = artist.artist_details || {};
              return (
                <Card key={artist.id}>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate font-display text-xl font-black text-palco-text">{artist.name}</p>
                        <p className="mt-1 text-sm text-palco-text-muted">
                          {details.main_genre || 'Sem genero'} - {details.city || 'Cidade nao informada'} {details.state ? `/${details.state}` : ''}
                        </p>
                      </div>
                      <Badge variant="tier">
                        {QUALITY_TIER_LABELS[details.quality_tier] || 'Bronze'}
                      </Badge>
                    </div>

                    {details.bio && (
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-palco-text-muted">{details.bio}</p>
                    )}

                    <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
                      <select
                        value={details.quality_tier || QUALITY_TIERS.BRONZE}
                        onChange={(event) => handleTierChange(artist.id, event.target.value)}
                        disabled={processingId === artist.id}
                        className="rounded-xl border border-palco-border bg-palco-dark px-3 py-2 text-sm text-palco-text outline-none focus:border-palco-gold"
                      >
                        {QUALITY_OPTIONS.map((tier) => (
                          <option key={tier} value={tier}>
                            {QUALITY_TIER_LABELS[tier]}
                          </option>
                        ))}
                      </select>
                      <span className="rounded-xl border border-palco-border px-3 py-2 text-xs text-palco-text-subtle">
                        {details.region || 'sem regiao'}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ) : activeTab === 'withdrawals' ? (
        <section className="space-y-3">
          {withdrawals.length === 0 ? (
            <Card>
              <div className="p-6 text-center text-sm text-palco-text-muted">Nenhum saque encontrado.</div>
            </Card>
          ) : (
            withdrawals.map((request) => (
              <Card key={request.id}>
                <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-xl font-black text-palco-text">
                        R$ {Number(request.amount).toFixed(2)}
                      </p>
                      <Badge variant={request.status === 'pending' ? 'gold' : request.status === 'completed' ? 'success' : 'live'}>
                        {request.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-palco-text-muted">
                      {request.profile?.name || 'Artista'} - PIX: {request.pix_key}
                    </p>
                    <p className="mt-1 text-xs text-palco-text-subtle">
                      {new Date(request.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  {request.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={processingId === request.id}
                        onClick={() => openWithdrawalDialog(request, 'reject')}
                      >
                        Recusar
                      </Button>
                      <Button
                        size="sm"
                        loading={processingId === request.id}
                        onClick={() => openWithdrawalDialog(request, 'approve')}
                      >
                        Confirmar PIX pago
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-3">
          <Card>
            <div className="p-5">
              <h3 className="font-display text-lg font-black text-palco-text">Admin master</h3>
              <p className="mt-2 text-sm leading-6 text-palco-text-muted">{MASTER_ADMIN_EMAIL}</p>
            </div>
          </Card>
          <Card>
            <div className="p-5">
              <h3 className="font-display text-lg font-black text-palco-text">Streaming</h3>
              <p className="mt-2 text-sm leading-6 text-palco-text-muted">
                Mesh WebRTC continua como MVP gratuito. A proxima etapa preparada e trocar o hook de midia por SFU.
              </p>
            </div>
          </Card>
          <Card>
            <div className="p-5">
              <h3 className="font-display text-lg font-black text-palco-text">Seguranca</h3>
              <p className="mt-2 text-sm leading-6 text-palco-text-muted">
                A permissao real de admin e validada no banco. A tela so e uma interface operacional.
              </p>
            </div>
          </Card>
        </section>
      )}

      {withdrawalDialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="withdrawal-dialog-title"
        >
          <Card className="w-full max-w-md">
            <div className="p-6">
              <Badge variant={withdrawalDialog.action === 'approve' ? 'success' : 'live'}>
                {withdrawalDialog.action === 'approve' ? 'Confirmar pagamento' : 'Recusar saque'}
              </Badge>
              <h2 id="withdrawal-dialog-title" className="mt-4 font-display text-2xl font-black text-palco-text">
                R$ {Number(withdrawalDialog.request.amount).toFixed(2)} via PIX
              </h2>
              <p className="mt-2 break-all text-sm leading-6 text-palco-text-muted">
                {withdrawalDialog.request.profile?.name || 'Artista'} - {withdrawalDialog.request.pix_key}
              </p>

              {withdrawalDialog.action === 'approve' ? (
                <p className="mt-5 rounded-lg border border-palco-gold/30 bg-palco-gold/10 p-3 text-sm leading-6 text-palco-text-muted">
                  Confirme somente depois de realizar o PIX fora do PALCO. Esta acao marca o saque como concluido e nao pode ser desfeita pela interface.
                </p>
              ) : (
                <label className="mt-5 block text-sm font-bold text-palco-text-muted">
                  Motivo da recusa
                  <textarea
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    maxLength={300}
                    autoFocus
                    placeholder="Explique por que o saque foi recusado"
                    className="mt-2 min-h-24 w-full rounded-xl border border-palco-border bg-palco-dark px-3 py-2 text-sm text-palco-text outline-none placeholder:text-palco-text-subtle focus:border-palco-gold"
                  />
                </label>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setWithdrawalDialog(null);
                    setRejectionReason('');
                  }}
                  disabled={processingId === withdrawalDialog.request.id}
                >
                  Cancelar
                </Button>
                <Button
                  variant={withdrawalDialog.action === 'approve' ? 'primary' : 'danger'}
                  loading={processingId === withdrawalDialog.request.id}
                  disabled={withdrawalDialog.action === 'reject' && !rejectionReason.trim()}
                  onClick={() => handleWithdrawal(
                    withdrawalDialog.request,
                    withdrawalDialog.action,
                    rejectionReason
                  )}
                >
                  {withdrawalDialog.action === 'approve' ? 'PIX realizado, concluir' : 'Recusar e devolver saldo'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
