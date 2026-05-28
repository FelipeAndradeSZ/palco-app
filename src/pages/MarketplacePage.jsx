import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { searchArtists } from '../services/marketplaceService';
import { createBookingRequest } from '../services/venueService';
import { BRAZIL_REGIONS, MUSIC_GENRES, QUALITY_TIER_LABELS } from '../lib/constants';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';

export default function MarketplacePage() {
  const { profile } = useAuth();
  const [artists, setArtists] = useState([]);
  const [filters, setFilters] = useState({ genre: '', region: '', state: '', city: '' });
  const [loading, setLoading] = useState(true);
  const [bookingArtistId, setBookingArtistId] = useState(null);
  const [bookingLoadingId, setBookingLoadingId] = useState(null);
  const [bookingMessage, setBookingMessage] = useState('');
  const [feedback, setFeedback] = useState(null);

  async function loadArtists(nextFilters = filters) {
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
  }

  useEffect(() => {
    loadArtists();
  }, []);

  function updateFilter(key, value) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    loadArtists(next);
  }

  async function requestBooking(artist) {
    if (profile?.role !== 'venue') {
      setFeedback({ type: 'error', message: 'Apenas estabelecimentos podem solicitar contratacao pelo marketplace.' });
      return;
    }

    setBookingLoadingId(artist.id);
    setFeedback(null);

    try {
      const details = artist.artist_details || {};
      const { error } = await createBookingRequest({
        venueId: profile.id,
        artistId: artist.id,
        city: details.city,
        state: details.state,
        message: bookingMessage || `Tenho interesse em contratar ${artist.name} para uma apresentacao presencial.`,
      });

      if (error) throw error;
      setBookingMessage('');
      setFeedback({ type: 'success', message: 'Solicitacao enviada ao artista.' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Nao foi possivel solicitar a contratacao.' });
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

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {artists.map((artist) => {
            const details = artist.artist_details || {};
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
                    <div className="mt-4 space-y-3">
                      <textarea
                        value={bookingArtistId === artist.id ? bookingMessage : ''}
                        onChange={(event) => setBookingMessage(event.target.value)}
                        onFocus={() => setBookingArtistId(artist.id)}
                        placeholder="Mensagem opcional para o artista"
                        className="min-h-20 w-full rounded-xl border border-palco-border bg-palco-dark px-3 py-2 text-sm text-palco-text outline-none placeholder:text-palco-text-subtle focus:border-palco-gold"
                        maxLength={500}
                      />
                      <Button
                        className="w-full"
                        loading={bookingLoadingId === artist.id}
                        onClick={() => requestBooking(artist)}
                      >
                        Solicitar contratacao
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
