/**
 * Header — Navegação principal PALCO
 *
 * - Fixed no topo com backdrop blur
 * - Logo com ícone de equalizer animado
 * - Links de navegação responsivos
 * - Estado de auth: exibe botões de login/cadastro ou avatar + logout
 * - Menu mobile com slide-out
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { isAdminUser } from '../../services/curatorService';
import Button from '../ui/Button';

export default function Header() {
  const { isAuthenticated, isArtist, isVenue, profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState(null);

  const handleSignOut = async () => {
    setSigningOut(true);
    setLogoutError(null);
    const result = await signOut();
    setSigningOut(false);
    if (result?.error) {
      setLogoutError(result.error.message || 'Nao foi possivel sair da conta.');
      return;
    }
    setMobileOpen(false);
    navigate('/', { replace: true });
  };

  const closeMobile = () => setMobileOpen(false);

  // Iniciais do usuário para o avatar
  const initials = profile?.name
    ? profile.name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-palco-border bg-palco-dark/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* ---- Logo ---- */}
        <Link to="/" className="flex items-center gap-2 no-underline" onClick={closeMobile}>
          {/* Equalizer icon — 3 animated bars */}
          <span className="flex items-end gap-[3px] h-5" aria-hidden="true">
            <span className="w-[3px] rounded-full bg-palco-gold animate-[eqBar1_1.2s_ease-in-out_infinite]" />
            <span className="w-[3px] rounded-full bg-palco-gold animate-[eqBar2_1.2s_ease-in-out_infinite_0.2s]" />
            <span className="w-[3px] rounded-full bg-palco-gold animate-[eqBar3_1.2s_ease-in-out_infinite_0.4s]" />
          </span>
          <span className="font-display text-xl font-bold tracking-wide text-palco-gold">
            PALCO
          </span>
        </Link>

        {/* ---- Desktop nav ---- */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            to="/rooms"
            className="text-sm font-medium text-palco-text-muted hover:text-palco-text transition-colors no-underline"
          >
            Salas ao Vivo
          </Link>

          {isAuthenticated && isArtist && (
            <Link
              to="/artist"
              className="text-sm font-medium text-palco-text-muted hover:text-palco-gold transition-colors no-underline"
            >
              Meu Painel
            </Link>
          )}

          {isAuthenticated && isVenue && (
            <Link
              to="/tv"
              className="text-sm font-medium text-palco-text-muted hover:text-palco-gold transition-colors no-underline"
            >
              Modo TV
            </Link>
          )}

          {isAuthenticated && (
            <Link
              to="/marketplace"
              className="text-sm font-medium text-palco-text-muted hover:text-palco-gold transition-colors no-underline"
            >
              Contratar
            </Link>
          )}

          {isAuthenticated && isAdminUser(user) && (
            <Link
              to="/admin"
              className="text-sm font-medium text-palco-text-muted hover:text-palco-gold transition-colors no-underline"
            >
              Admin
            </Link>
          )}
        </nav>

        {/* ---- Desktop auth area ---- */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <>
              {/* Avatar */}
              <Link to="/profile" className="flex items-center gap-2 no-underline">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.name}
                    className="h-8 w-8 rounded-full object-cover border border-palco-border"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-palco-gold/15 text-xs font-semibold text-palco-gold border border-palco-gold/30">
                    {initials}
                  </span>
                )}
                <span className="text-sm text-palco-text-muted max-w-[120px] truncate">
                  {profile?.name || 'Usuário'}
                </span>
              </Link>

              <Button variant="ghost" size="sm" onClick={handleSignOut} loading={signingOut}>
                Sair
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                Entrar
              </Button>
              <Button variant="primary" size="sm" onClick={() => navigate('/register')}>
                Cadastrar
              </Button>
            </>
          )}
        </div>

        {/* ---- Mobile hamburger ---- */}
        <button
          type="button"
          className="md:hidden flex flex-col items-center justify-center gap-1.5 p-2 text-palco-text-muted hover:text-palco-text transition-colors cursor-pointer"
          aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <span
            className={`block h-0.5 w-5 rounded bg-current transition-transform duration-200 ${
              mobileOpen ? 'translate-y-2 rotate-45' : ''
            }`}
          />
          <span
            className={`block h-0.5 w-5 rounded bg-current transition-opacity duration-200 ${
              mobileOpen ? 'opacity-0' : ''
            }`}
          />
          <span
            className={`block h-0.5 w-5 rounded bg-current transition-transform duration-200 ${
              mobileOpen ? '-translate-y-2 -rotate-45' : ''
            }`}
          />
        </button>
      </div>

      {/* ---- Mobile slide-out nav ---- */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-palco-border bg-palco-dark/95 backdrop-blur-xl animate-[slideDown_0.2s_ease-out]">
          <div className="flex flex-col gap-1 px-4 py-4">
            <Link
              to="/rooms"
              onClick={closeMobile}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-palco-text-muted hover:text-palco-text hover:bg-white/5 transition-colors no-underline"
            >
              Salas ao Vivo
            </Link>

            {isAuthenticated && isArtist && (
              <Link
                to="/artist"
                onClick={closeMobile}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-palco-text-muted hover:text-palco-gold hover:bg-white/5 transition-colors no-underline"
              >
                Meu Painel
              </Link>
            )}

            {isAuthenticated && isVenue && (
              <Link
                to="/tv"
                onClick={closeMobile}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-palco-text-muted hover:text-palco-gold hover:bg-white/5 transition-colors no-underline"
              >
                Modo TV
              </Link>
            )}

            {isAuthenticated && (
              <Link
                to="/marketplace"
                onClick={closeMobile}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-palco-text-muted hover:text-palco-gold hover:bg-white/5 transition-colors no-underline"
              >
                Contratar
              </Link>
            )}

            {isAuthenticated && isAdminUser(user) && (
              <Link
                to="/admin"
                onClick={closeMobile}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-palco-text-muted hover:text-palco-gold hover:bg-white/5 transition-colors no-underline"
              >
                Admin
              </Link>
            )}

            <div className="my-2 border-t border-palco-border" />

            {isAuthenticated ? (
              <>
                <Link to="/profile" onClick={closeMobile} className="flex items-center gap-2 rounded-lg px-3 py-2 no-underline hover:bg-white/5">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.name}
                      className="h-8 w-8 rounded-full object-cover border border-palco-border"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-palco-gold/15 text-xs font-semibold text-palco-gold border border-palco-gold/30">
                      {initials}
                    </span>
                  )}
                  <span className="text-sm text-palco-text truncate">
                    {profile?.name || 'Usuário'}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-palco-live hover:bg-palco-live/10 transition-colors cursor-pointer"
                >
                  {signingOut ? 'Saindo...' : 'Sair'}
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 px-3">
                <Button variant="ghost" size="md" onClick={() => { navigate('/login'); closeMobile(); }}>
                  Entrar
                </Button>
                <Button variant="primary" size="md" onClick={() => { navigate('/register'); closeMobile(); }}>
                  Cadastrar
                </Button>
              </div>
            )}
          </div>
        </nav>
      )}

      {logoutError && (
        <div
          role="alert"
          className="absolute left-1/2 top-[calc(100%+0.5rem)] w-[min(92vw,28rem)] -translate-x-1/2 rounded-lg border border-palco-live/40 bg-palco-dark px-4 py-3 text-sm text-palco-live shadow-xl"
        >
          {logoutError}
        </div>
      )}

      {/* ---- Keyframe animations (injected once) ---- */}
      <style>{`
        @keyframes eqBar1 {
          0%, 100% { height: 8px; }
          50% { height: 18px; }
        }
        @keyframes eqBar2 {
          0%, 100% { height: 14px; }
          50% { height: 6px; }
        }
        @keyframes eqBar3 {
          0%, 100% { height: 10px; }
          50% { height: 20px; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </header>
  );
}
