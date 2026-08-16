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
  const { isAuthenticated, loading, profile } = useAuth();
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

  // Role não autorizado → home
  if (roles && roles.length > 0 && (!profile?.role || !roles.includes(profile.role))) {
    return <Navigate to="/" replace />;
  }

  return children;
}
