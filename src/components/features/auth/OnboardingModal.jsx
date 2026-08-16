import { useState, useContext } from 'react';
import { AuthContext } from '../../../contexts/AuthContextObject';
import { updateProfile, upsertArtistDetails } from '../../../services/profileService';
import { upsertVenueProfile } from '../../../services/venueService';
import { USER_ROLES, USER_ROLE_LABELS, MUSIC_GENRES } from '../../../lib/constants';
import Button from '../../ui/Button';

export default function OnboardingModal() {
  const { user, profile, requiresOnboarding, refreshProfile } = useContext(AuthContext);
  const [role, setRole] = useState(profile?.role || USER_ROLES.LISTENER);
  const [mainGenre, setMainGenre] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!requiresOnboarding) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (role === USER_ROLES.ARTIST && !mainGenre) {
      setError('Selecione seu gênero musical principal.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const profileResult = await updateProfile(user.id, {
        role,
        onboarding_completed: true,
      });
      if (profileResult.error) throw profileResult.error;

      if (role === USER_ROLES.ARTIST) {
        const artistResult = await upsertArtistDetails(user.id, {
          main_genre: mainGenre,
          quality_tier: 'bronze',
          available_for_booking: true,
        });
        if (artistResult.error) throw artistResult.error;
      } else if (role === USER_ROLES.VENUE) {
        const venueResult = await upsertVenueProfile(user.id, {});
        if (venueResult.error) throw venueResult.error;
      }

      await refreshProfile();
    } catch (err) {
      setError('Erro ao concluir cadastro. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-palco-dark-lighter border border-palco-border rounded-2xl p-6 shadow-2xl animate-fade-in-up">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">Complete seu Perfil</h2>
        <p className="text-palco-text-muted text-sm text-center mb-6">
          Vimos que você entrou com o Google. Conta pra gente: como você vai usar o PALCO?
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-palco-text-muted mb-3">
              Eu sou
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(USER_ROLE_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setRole(value);
                    setError(null);
                  }}
                  className={`py-3 px-1 rounded-xl border text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer ${
                    role === value
                      ? 'border-palco-gold bg-palco-gold/10 text-palco-gold shadow-[0_0_15px_rgba(255,215,0,0.2)]'
                      : 'border-palco-border bg-palco-dark hover:border-palco-text-subtle text-palco-text-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {role === USER_ROLES.ARTIST && (
            <div className="animate-fade-in">
              <label className="block text-sm font-medium text-palco-text-muted mb-2">
                Gênero Musical Principal
              </label>
              <select
                value={mainGenre}
                onChange={(e) => {
                  setMainGenre(e.target.value);
                  setError(null);
                }}
                className="w-full px-4 py-3 rounded-xl bg-palco-dark border border-palco-border text-palco-text text-sm transition-colors focus:outline-none focus:border-palco-gold focus:ring-1 focus:ring-palco-gold"
              >
                <option value="">Selecione um gênero</option>
                {MUSIC_GENRES.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-4"
            loading={loading}
          >
            Começar a usar o PALCO
          </Button>
        </form>
      </div>
    </div>
  );
}
