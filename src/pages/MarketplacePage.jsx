import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { searchArtists } from '../services/marketplaceService';
import { createBookingRequest, getBookingRequests, updateBookingStatus } from '../services/venueService';
import { BRAZIL_REGIONS, MUSIC_GENRES, QUALITY_TIER_LABELS } from '../lib/constants';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import { validateBrazilState } from '../lib/validators';

const EMPTY_BOOKING_FORM = Object.freeze({
  eventDate: '',
  city: '',
  state: '',
  budget: '',
  message: '',
});

function formatBookingDate(value) {
  if (!value) return 'Data nao informada';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatMoney(value) {
  if (!value) return 'Orcamento nao informado';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function MarketplacePage() {
  const { profile } = useAuth();
  const profileId = profile?.id;
  const profileRole = profile?.role;
  const [artists, setArtists] = useState([]);
  const [filters, setFilters] = useState({ genre: '', region: '', state: '', city: '' });
  const [loading, setLoading] = useState(true);
  const [bookingLoadingId, setBookingLoadingId] = useState(null);
  const [bookingArtist, setBookingArtist] = useState(null);
  const [bookingForm, setBookingForm] = useState(EMPTY_BOOKING_FORM);
  const [feedback, setFeedback] = useState(null);
  const [bookingRequests, setBookingRequests] = useState([]);

  const loadArtists = useCallback(async (nextFilters = {}) => {
    setLoading(true);
    try {
      const { data, error } = await searchArtists(nextFilters);
      if (error) throw error;
      setArtists(data || []);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Nao foi possivel buscar artistas.' });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadVenueBookings = useCallback(async () => {
    if (profileRole !== 'venue' || !profileId) return;
    const { data, error } = await getBookingRequests(profileId, 'venue');
    if (error) {
      setFeedback({ type: 'error', message: error.message || 'Nao foi possivel carregar suas solicitacoes.' });
      return;
    }
    setBookingRequests(data || []);
  }, [profileId, profileRole]);

  useEffect(() => {
    loadArtists(filters);
  }, [filters, loadArtists]);

  useEffect(() => {
    loadVenueBookings();
  }, [loadVenueBookings]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function openBooking(artist) {
    setBookingArtist(artist);
    setBookingForm(EMPTY_BOOKING_FORM);
    setFeedback(null);
  }

  function updateBookingField(field, value) {
    setBookingForm((current) => ({ ...current, [field]: value }));
  }

  async function requestBooking(event) {
    event.preventDefault();
    const artist = bookingArtist;
    if (!artist) return;

    if (profile?.role !== 'venue') {
      setFeedback({ type: 'error', message: 'Apenas estabelecimentos podem solicitar contratacao pelo marketplace.' });
      return;
    }

    setBookingLoadingId(artist.id);
    setFeedback(null);

    try {
      const eventDate = new Date(bookingForm.eventDate);
      if (!bookingForm.eventDate || Number.isNaN(eventDate.getTime()) || eventDate.getTime() <= Date.now() + 60 * 60 * 1000) {
        throw new Error('Escolha uma data com pelo menos uma hora de antecedencia.');
      }

      if (!bookingForm.city.trim()) throw new Error('Informe a cidade do evento.');
      const stateResult = validateBrazilState(bookingForm.state);
      if (!stateResult.valid || !stateResult.sanitized) throw new Error('Informe a UF do evento com duas letras.');

      const budget = Number(bookingForm.budget);
      if (!Number.isFinite(budget) || budget <= 0 || budget > 1000000) {
        throw new Error('Informe um orcamento valido.');
      }

      const { error } = await createBookingRequest({
        venueId: profile.id,
        artistId: artist.id,
        eventDate: eventDate.toISOString(),
        city: bookingForm.city,
        state: stateResult.sanitized,
        budget,
        message: bookingForm.message.trim() || `Tenho interesse em contratar ${artist.name} para uma apresentacao presencial.`,
      });

      if (error) throw error;
      setBookingArtist(null);
      setBookingForm(EMPTY_BOOKING_FORM);
      setFeedback({ type: 'success', message: 'Solicitacao enviada ao artista.' });
      await loadVenueBookings();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Nao foi possivel solicitar a contratacao.' });
    } finally {
      setBookingLoadingId(null);
    }
  }

  async function cancelBooking(requestId) {
    setBookingLoadingId(requestId);
    setFeedback(null);
    try {
      const { error } = await updateBookingStatus(requestId, 'cancelled');
      if (error) throw error;
      setFeedback({ type: 'success', message: 'Solicitacao cancelada.' });
      await loadVenueBookings();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Nao foi possivel cancelar a solicitacao.' });
    } finally {
      setBookingLoadingId(null);
    }
  }

  return (
    <div className="mx-auto min-h-[calc(100vh-4rem)] max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Badge variant="gold">Marketplace</Badge>
          <Badge variant="default">{artists.length} artistas</Badge>
        </div>
        <h1 className="font-display text-3xl font-black text-palco-text">Contratar artistas presenciais</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-palco-text-muted">
          Encontre artistas por genero e localidade para eventos, bares, restaurantes e festas.
        </p>
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

      <div className="mb-6 grid gap-3 lg:grid-cols-4">
        <select
          value={filters.genre}
          onChange={(event) => updateFilter('genre', event.target.value)}
          className="rounded-xl border border-palco-border bg-palco-dark px-4 py-3 text-sm text-palco-text outline-none focus:border-palco-gold"
        >
          <option value="">Todos os generos</option>
          {MUSIC_GENRES.map((genre) => (
            <option key={genre} value={genre}>{genre}</option>
          ))}
        </select>
        <select
          value={filters.region}
          onChange={(event) => updateFilter('region', event.target.value)}
          className="rounded-xl border border-palco-border bg-palco-dark px-4 py-3 text-sm text-palco-text outline-none focus:border-palco-gold"
        >
          <option value="">Todas as regioes</option>
          {BRAZIL_REGIONS.map((region) => (
            <option key={region.value} value={region.value}>{region.label}</option>
          ))}
        </select>
        <input
          value={filters.state}
          onChange={(event) => updateFilter('state', event.target.value)}
          placeholder="Estado, ex: PR"
          maxLength={2}
          className="rounded-xl border border-palco-border bg-palco-dark px-4 py-3 text-sm text-palco-text outline-none placeholder:text-palco-text-subtle focus:border-palco-gold"
        />
        <input
          value={filters.city}
          onChange={(event) => updateFilter('city', event.target.value)}
          placeholder="Cidade"
          className="rounded-xl border border-palco-border bg-palco-dark px-4 py-3 text-sm text-palco-text outline-none placeholder:text-palco-text-subtle focus:border-palco-gold"
        />
      </div>

      {profile?.role === 'venue' && bookingRequests.length > 0 && (
        <section className="mb-8 border-y border-palco-border py-5">
          <h2 className="font-display text-lg font-black text-palco-text">Minhas solicitacoes</h2>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {bookingRequests.slice(0, 6).map((request) => (
              <div key={request.id} className="flex items-center justify-between gap-4 rounded-lg border border-palco-border bg-palco-card p-4">
                <div className="min-w-0">
                  <p className="truncate font-bold text-palco-text">{request.artist?.name || 'Artista PALCO'}</p>
                  <p className="mt-1 text-xs text-palco-text-muted">
                    {request.status === 'pending' ? 'Aguardando resposta' : request.status === 'accepted' ? 'Aceita pelo artista' : request.status === 'declined' ? 'Recusada pelo artista' : 'Cancelada'}
                  </p>
                  <p className="mt-2 text-xs text-palco-text-muted">
                    {formatBookingDate(request.event_date)}
                    {request.city ? ` - ${request.city}${request.state ? `/${request.state}` : ''}` : ''}
                  </p>
                  <p className="mt-1 text-xs font-bold text-palco-gold">{formatMoney(request.budget)}</p>
                </div>
                {['pending', 'accepted'].includes(request.status) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={bookingLoadingId === request.id}
                    onClick={() => cancelBooking(request.id)}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        artists.length === 0 ? (
          <div className="border-y border-palco-border py-10 text-center text-sm text-palco-text-muted">
            Nenhum artista disponivel corresponde aos filtros.
          </div>
        ) : <div className="grid gap-4 lg:grid-cols-3">
          {artists.map((artist) => {
            const details = artist.artist_details || {};
            const hasPendingRequest = bookingRequests.some((request) => (
              request.artist_id === artist.id && request.status === 'pending'
            ));
            return (
              <Card key={artist.id}>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-xl font-black text-palco-text">{artist.name}</h2>
                      <p className="mt-1 text-sm text-palco-text-muted">
                        {details.city || 'Cidade nao informada'} {details.state ? `/${details.state}` : ''}
                      </p>
                    </div>
                    <Badge variant="tier">{QUALITY_TIER_LABELS[details.quality_tier] || 'Bronze'}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-palco-gold">{details.main_genre || 'Genero nao informado'}</p>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-palco-text-muted">
                    {details.bio || details.repertoire || 'Perfil ainda sem descricao.'}
                  </p>
                  {profile?.role === 'venue' && (
                    <div className="mt-4">
                      <Button
                        className="w-full"
                        disabled={hasPendingRequest}
                        loading={bookingLoadingId === artist.id}
                        onClick={() => openBooking(artist)}
                      >
                        {hasPendingRequest ? 'Solicitacao pendente' : 'Solicitar contratacao'}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {bookingArtist && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !bookingLoadingId) setBookingArtist(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-title"
            className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-lg border border-palco-border bg-palco-card p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase text-palco-gold">Solicitacao presencial</p>
                <h2 id="booking-title" className="mt-1 font-display text-xl font-black text-palco-text">
                  Contratar {bookingArtist.name}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                disabled={Boolean(bookingLoadingId)}
                onClick={() => setBookingArtist(null)}
                className="text-2xl leading-none text-palco-text-muted transition hover:text-white disabled:opacity-50"
              >
                &times;
              </button>
            </div>

            <form onSubmit={requestBooking} className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-bold text-palco-text-muted">Data e horario</span>
                <input
                  type="datetime-local"
                  required
                  value={bookingForm.eventDate}
                  onChange={(event) => updateBookingField('eventDate', event.target.value)}
                  className="w-full rounded-lg border border-palco-border bg-palco-dark px-4 py-3 text-sm text-palco-text outline-none focus:border-palco-gold"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-palco-text-muted">Cidade</span>
                <input
                  required
                  maxLength={120}
                  value={bookingForm.city}
                  onChange={(event) => updateBookingField('city', event.target.value)}
                  className="w-full rounded-lg border border-palco-border bg-palco-dark px-4 py-3 text-sm text-palco-text outline-none focus:border-palco-gold"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-palco-text-muted">UF</span>
                <input
                  required
                  maxLength={2}
                  value={bookingForm.state}
                  onChange={(event) => updateBookingField('state', event.target.value.toUpperCase())}
                  placeholder="PR"
                  className="w-full rounded-lg border border-palco-border bg-palco-dark px-4 py-3 text-sm text-palco-text outline-none focus:border-palco-gold"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-bold text-palco-text-muted">Orcamento (R$)</span>
                <input
                  type="number"
                  required
                  min="1"
                  max="1000000"
                  step="0.01"
                  value={bookingForm.budget}
                  onChange={(event) => updateBookingField('budget', event.target.value)}
                  className="w-full rounded-lg border border-palco-border bg-palco-dark px-4 py-3 text-sm text-palco-text outline-none focus:border-palco-gold"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-bold text-palco-text-muted">Mensagem</span>
                <textarea
                  value={bookingForm.message}
                  onChange={(event) => updateBookingField('message', event.target.value)}
                  maxLength={1000}
                  placeholder="Conte sobre o local, duracao e formato do evento."
                  className="min-h-28 w-full rounded-lg border border-palco-border bg-palco-dark px-4 py-3 text-sm text-palco-text outline-none focus:border-palco-gold"
                />
              </label>
              <div className="flex justify-end gap-3 sm:col-span-2">
                <Button type="button" variant="secondary" disabled={Boolean(bookingLoadingId)} onClick={() => setBookingArtist(null)}>
                  Cancelar
                </Button>
                <Button type="submit" loading={bookingLoadingId === bookingArtist.id}>
                  Enviar solicitacao
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
