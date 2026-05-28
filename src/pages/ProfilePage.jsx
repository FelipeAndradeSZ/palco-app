import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { updateProfile, upsertArtistDetails } from '../services/profileService';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { MUSIC_GENRES, USER_ROLE_LABELS } from '../lib/constants';

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const artistDetails = profile?.artist_details?.[0] || profile?.artist_details || {};
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

  const isArtist = profile?.role === 'artist';

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

      if (isArtist) {
        const detailsPayload = {
          main_genre: form.mainGenre || null,
          bio: form.bio.trim() || null,
          repertoire: form.repertoire.trim() || null,
          pix_key: form.pixKey.trim() || null,
          instagram_url: form.instagramUrl.trim() || null,
          booking_whatsapp: form.bookingWhatsapp.trim() || null,
        };

        const detailsResult = await upsertArtistDetails(profile.id, detailsPayload);
        if (detailsResult.error) throw detailsResult.error;
      }

      await refreshProfile();
      setFeedback({ type: 'success', message: 'Perfil atualizado.' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Nao foi possivel salvar o perfil.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-palco-black px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Badge variant="gold">{USER_ROLE_LABELS[profile?.role] || 'Perfil'}</Badge>
            {isArtist && <Badge variant="tier">Artista PALCO</Badge>}
          </div>
          <h1 className="font-display text-3xl font-black text-palco-text">Meu perfil</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-palco-text-muted">
            Ajuste estes dados uma vez. Depois eles aparecem no painel, nas salas, no QR e nas interacoes.
          </p>
        </header>

        <Card>
          <form onSubmit={handleSubmit} className="p-5">
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

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-palco-text-muted">
                  Nome publico
                </span>
                <input
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  className="w-full rounded-xl border border-palco-border bg-palco-dark px-4 py-3 text-sm text-palco-text outline-none focus:border-palco-gold"
                  maxLength={150}
                />
              </label>

              {isArtist && (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-palco-text-muted">
                    Genero principal
                  </span>
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
              )}

              {isArtist && (
                <>
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
                    <span className="mb-2 block text-sm font-medium text-palco-text-muted">Repertorio base</span>
                    <textarea
                      value={form.repertoire}
                      onChange={(event) => updateField('repertoire', event.target.value)}
                      className="min-h-24 w-full rounded-xl border border-palco-border bg-palco-dark px-4 py-3 text-sm text-palco-text outline-none focus:border-palco-gold"
                      maxLength={1000}
                      placeholder="Ex: sertanejo universitario, moda de viola, classicos anos 90..."
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
                    <span className="mb-2 block text-sm font-medium text-palco-text-muted">WhatsApp para contratacao</span>
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
                </>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <Button type="submit" loading={saving}>
                Salvar perfil
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
