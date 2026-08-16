/**
 * RegisterPage — Tela de cadastro
 * 
 * Redirect para home se já autenticado.
 */

import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import RegisterForm from '../components/features/auth/RegisterForm';
import { getSafeReturnPath } from '../lib/navigation';

export default function RegisterPage() {
  const { signUp, loading, error, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = getSafeReturnPath(searchParams.get('returnTo'));

  // Redirect se já logado
  useEffect(() => {
    if (isAuthenticated) {
      navigate(returnTo, { replace: true });
    }
  }, [isAuthenticated, navigate, returnTo]);

  async function handleRegister(data) {
    const result = await signUp(data);
    if (!result.error) {
      navigate(returnTo, { replace: true });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      {/* Background decorativo */}
      <div className="absolute inset-0 bg-gradient-to-bl from-palco-gold/3 via-transparent to-transparent pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="font-display font-extrabold text-3xl text-palco-gold">
              PALCO
            </h1>
          </Link>
          <p className="text-palco-text-muted mt-2">
            Crie sua conta no PALCO
          </p>
        </div>

        {/* Card do formulário */}
        <div className="bg-palco-card border border-palco-border rounded-2xl p-8">
          <RegisterForm
            onSubmit={handleRegister}
            loading={loading}
            error={error}
            returnTo={returnTo}
          />
        </div>

        {/* Link para login */}
        <p className="text-center mt-6 text-palco-text-muted text-sm">
          Já tem conta?{' '}
          <Link
            to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
            className="text-palco-gold hover:text-palco-gold-light font-medium transition-colors"
          >
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
}
