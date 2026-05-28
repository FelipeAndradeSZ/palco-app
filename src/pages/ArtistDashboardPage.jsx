import { useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useRooms } from '../hooks/useRooms';
import { useRoomRealtime } from '../hooks/useRoomRealtime';
import { updateRoomArtist } from '../services/roomService';
import { updateProfile, upsertArtistDetails } from '../services/profileService';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ArtistRequestQueue from '../components/features/bounty/ArtistRequestQueue';
import ChatBox from '../components/features/chat/ChatBox';
import LocalCamera from '../components/features/video/LocalCamera';
import { MUSIC_GENRES, QUALITY_TIER_LABELS } from '../lib/constants';
import { getActiveArtists, roomHasArtist } from '../lib/roomArtists';

function ArtistProfileEditor({ profile, artistDetails, onSaved }) {
  const [form, setForm] = useState({
    name: profile?.name || '',
    mainGenre: artistDetails.main_genre || '',
    bio: artistDetails.bio || '',
    repertoire: artistDetails.repertoire || '',
    pixKey: artistDetails.pix_key || '',
    instagramUrl: artistDetails.instagram_url || '',
    bookingWhatsapp: artistDetails.booking_whatsapp || '',
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFeedback(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!profile?.id) return;

    setSaving(true);
    setFeedback(null);

    try {
      const profileResult = await updateProfile(profile.id, {
        name: form.name.trim() || profile.name,
      });

      if (profileResult.error) throw profileResult.error;

      const detailsPayload = {
        main_genre: form.mainGenre || null,
        bio: form.bio.trim() || null,
        repertoire: form.repertoire.trim() || null,
        pix_key: form.pixKey.trim() || null,
        instagram_url: form.instagramUrl.trim() || null,
        booking_whatsapp: form.bookingWhatsapp.trim() || null,
      };

      const detailsResult = await upsertArtistDetails(profile.id, detailsPayload);

      if (detailsResult.error) {
        const fallbackResult = await upsertArtistDetails(profile.id, {
          main_genre: detailsPayload.main_genre,
        });
        if (fallbackResult.error) throw fallbackResult.error;
        setFeedback({
          type: 'warning',
          message: 'Gênero salvo. Aplique a migration para salvar bio, repertório e contatos.',
        });
      } else {
        setFeedback({ type: 'success', message: 'Perfil atualizado.' });
      }

      await onSaved();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Não foi possível salvar o perfil.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="p-5">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="font-display text-xl font-bold text-palco-text">Perfil do artista</h2>
            <p className="mt-1 text-sm text-palco-text-muted">
              Esses dados aparecem para ouvintes, estabelecimentos e contratação.
            </p>
          </div>
          <Button type="submit" size="sm" loading={saving}>
            Salvar perfil
          </Button>
        </div>

        {feedback && (
          <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-palco-success/30 bg-palco-success/10 text-palco-success'
              : feedback.type === 'warning'
                ? 'border-palco-warning/30 bg-palco-warning/10 text-palco-warning'
                : 'border-palco-live/30 bg-palco-live/10 text-palco-live'
          }`}
          >
            {feedback.message}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-palco-text-muted">Nome artístico</span>
            <input
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              className="w-full rounded-xl border border-palco-border bg-palco-dark px-4 py-3 text-sm text-palco-text outline-none focus:border-palco-gold"
              maxLength={150}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-palco-text-muted">Gênero principal</span>
            <select
              value={form.mainGenre}
              onChange={(event) => updateField('mainGenre', event.target.value)}
              className="w-full rounded-xl border border-palco-border bg-palco-dark px-4 py-3 text-sm text-palco-text outline-none focus:border-palco-gold"
            >
              <option value="">Selecione</option>
              {MUSIC_GENRES.map((genre) => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>
          </label>

          <label className="block lg:col-span-2">
            <span className="mb-2 block text-sm font-medium text-palco-text-muted">Bio curta</span>
            <textarea
              value={form.bio}
              onChange={(event) => updateField('bio', event.target.value)}
              className="min-h-24 w-full rounded-xl border border-palco-border bg-palco-dark px-4 py-3 text-sm text-palco-text outline-none focus:border-palco-gold"
              maxLength={500}
              placeholder="Conte em poucas linhas o estilo do seu show."
            />
          </label>

          <label className="block lg:col-span-2">
            <span className="mb-2 block text-sm font-medium text-palco-text-muted">Repertório base</span>
            <textarea
              value={form.repertoire}
              onChange={(event) => updateField('repertoire', event.target.value)}
              className="min-h-24 w-full rounded-xl border border-palco-border bg-palco-dark px-4 py-3 text-sm text-palco-text outline-none focus:border-palco-gold"
              maxLength={1000}
              placeholder="Ex: sertanejo universitário, moda de viola, clássicos anos 90..."
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-palco-text-muted">Chave PIX</span>
            <input
              value={form.pixKey}
              onChange={(event) => updateField('pixKey', event.target.value)}
              className="w-full rounded-xl border border-palco-border bg-palco-dark px-4 py-3 text-sm text-palco-text outline-none focus:border-palco-gold"
              maxLength={180}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-palco-text-muted">WhatsApp para contratação</span>
            <input
              value={form.bookingWhatsapp}
              onChange={(event) => updateField('bookingWhatsapp', event.target.value)}
              className="w-full rounded-xl border border-palco-border bg-palco-dark px-4 py-3 text-sm text-palco-text outline-none focus:border-palco-gold"
              maxLength={40}
            />
          </label>

          <label className="block lg:col-span-2">
            <span className="mb-2 block text-sm font-medium text-palco-text-muted">Instagram ou link profissional</span>
            <input
              value={form.instagramUrl}
              onChange={(event) => updateField('instagramUrl', event.target.value)}
              className="w-full rounded-xl border border-palco-border bg-palco-dark px-4 py-3 text-sm text-palco-text outline-none focus:border-palco-gold"
              maxLength={220}
              placeholder="https://instagram.com/seuperfil"
            />
          </label>
        </div>
      </form>
    </Card>
  );
}

export default function ArtistDashboardPage() {
  const { profile, refreshProfile } = useAuth();
  const { rooms, loading: roomsLoading, refetch: refetchRooms } = useRooms();
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const assignedRoomId = useMemo(() => {
    if (!profile?.id) return null;
    return rooms.find((room) => roomHasArtist(room, profile.id))?.id || null;
  }, [profile, rooms]);

  const activeRoomId = selectedRoomId || assignedRoomId;
  const { activeRequests, messages, isConnected, sendChatMessage } = useRoomRealtime(activeRoomId, {
    targetArtistId: profile?.id || null,
  });
  const artistDetails = profile?.artist_details?.[0] || profile?.artist_details || {};
  const tierLabel = QUALITY_TIER_LABELS[artistDetails.quality_tier] || 'Bronze';

  const handleGoLive = async (roomId) => {
    setIsProcessing(true);
    try {
      await updateRoomArtist(roomId, profile.id);
      setSelectedRoomId(roomId);
      await refetchRooms();
    } catch (err) {
      console.error('Erro ao entrar ao vivo', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStopLive = async () => {
    if (!activeRoomId) return;
    setIsProcessing(true);
    try {
      await updateRoomArtist(activeRoomId, null);
      setSelectedRoomId(null);
      await refetchRooms();
    } catch (err) {
      console.error('Erro ao sair do ar', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-3xl font-bold text-palco-text">Meu Painel</h1>
          <p className="mt-1 text-palco-text-muted">Bem-vindo, {profile?.name || 'Artista'}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={activeRoomId ? 'live' : 'default'} pulse={!!activeRoomId}>
            {activeRoomId ? 'AO VIVO' : 'OFFLINE'}
          </Badge>
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

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <div className="p-5">
            <p className="mb-1 text-sm text-palco-text-subtle">Tier</p>
            <p className="font-display text-xl font-bold text-palco-gold">{tierLabel}</p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="mb-1 text-sm text-palco-text-subtle">Avaliação</p>
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
            <p className="mb-1 text-sm text-palco-text-subtle">Gênero</p>
            <p className="truncate font-display text-xl font-bold text-palco-text">
              {artistDetails.main_genre || '-'}
            </p>
          </div>
        </Card>
      </div>

      <div className="mb-8">
        <ArtistProfileEditor
          key={profile?.id}
          profile={profile}
          artistDetails={artistDetails}
          onSaved={refreshProfile}
        />
      </div>

      {activeRoomId ? (
        <div className="mt-8 flex flex-col gap-6 lg:flex-row">
          <div className="flex flex-1 flex-col gap-6">
            <div className="flex items-center gap-4 rounded-xl border border-palco-live/30 bg-palco-live/10 p-4 shadow-[0_0_20px_rgba(220,38,38,0.15)]">
              <span className="h-3 w-3 rounded-full bg-palco-live" />
              <div>
                <p className="font-bold text-palco-live">Você está no ar</p>
                <p className="text-sm text-palco-text-muted">Seu público está acompanhando sua apresentação.</p>
              </div>
            </div>

            <LocalCamera isActive />
            <ArtistRequestQueue activeRequests={activeRequests} />
          </div>

          <div className="flex w-full flex-col gap-4 lg:w-96">
            <h3 className="flex items-center gap-2 font-display font-bold text-palco-text">
              <svg className="h-5 w-5 text-palco-gold" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
              </svg>
              Chat ao vivo
            </h3>
            <div className="min-h-[400px] flex-1 lg:max-h-[600px]">
              <ChatBox
                messages={messages}
                isConnected={isConnected}
                onSendMessage={sendChatMessage}
              />
            </div>
          </div>
        </div>
      ) : (
        <div>
          <h2 className="mb-4 font-display text-xl font-bold text-palco-text">
            Escolha uma sala para tocar
          </h2>
          {roomsLoading ? (
            <p className="text-palco-text-muted">Carregando salas...</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => (
                <Card key={room.id} hover>
                  <div className="p-5">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="font-display font-bold text-palco-text">{room.name}</h3>
                      {getActiveArtists(room).length > 0 && (
                        <Badge variant="live" pulse>
                          {getActiveArtists(room).length} ao vivo
                        </Badge>
                      )}
                    </div>
                    <p className="mb-4 text-sm text-palco-text-subtle">
                      {room.genre} - {room.listener_count || 0} ouvintes
                    </p>
                    {getActiveArtists(room).length > 0 && (
                      <p className="mb-4 text-xs text-palco-text-subtle">
                        Tocando agora: {getActiveArtists(room).map((artist) => artist.name).join(', ')}
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
                      {roomHasArtist(room, profile?.id) ? 'Você já está nesta sala' : 'Entrar nesta sala também'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
