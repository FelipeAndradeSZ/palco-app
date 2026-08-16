/**
 * ProtectedRoute — Guarda de rota
 *
 * Protege rotas que exigem autenticação e/ou roles específicos.
 *
 * @param {React.ReactNode} children - Conteúdo protegido
 * @param {string[]}        roles    - Roles permitidos (ex: ['artist', 'venue'])
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getLoginUrl } from '../../lib/navigation';
import Spinner from '../ui/Spinner';

export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, loading, profile, profileError, refreshProfile, signOut } = useAuth();
  const location = useLocation();

  // Verificação de sessão em andamento
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-palco-black">
        <Spinner size="lg" />
      </div>
    );
  }

  // Não autenticado → login
  if (!isAuthenticated) {
    return <Navigate to={getLoginUrl(`${location.pathname}${location.search}`)} replace />;
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-palco-black px-4">
        <div className="w-full max-w-md rounded-2xl border border-palco-border bg-palco-card p-6 text-center">
          <h1 className="font-display text-2xl font-black text-palco-text">Perfil indisponivel</h1>
          <p className="mt-3 text-sm leading-6 text-palco-text-muted">
            {profileError || 'Nao foi possivel carregar os dados da sua conta.'}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => void refreshProfile()}
              className="rounded-xl bg-palco-gold px-5 py-3 text-sm font-black text-palco-black"
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-xl border border-palco-border px-5 py-3 text-sm font-bold text-palco-text-muted"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Role não autorizado → home
  if (roles && roles.length > 0 && (!profile?.role || !roles.includes(profile.role))) {
    return <Navigate to="/" replace />;
  }

  return children;
}
