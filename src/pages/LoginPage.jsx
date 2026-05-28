/**
 * LoginPage — Tela de login
 * 
 * Redirect para home se já autenticado.
 */

import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoginForm from '../components/features/auth/LoginForm';

export default function LoginPage() {
  const { signIn, loading, error, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect se já logado
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  async function handleLogin(credentials) {
    const result = await signIn(credentials);
    if (!result.error) {
      navigate('/', { replace: true });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      {/* Background decorativo */}
      <div className="absolute inset-0 bg-gradient-to-br from-palco-gold/3 via-transparent to-transparent pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="font-display font-extrabold text-3xl text-palco-gold">
              PALCO
            </h1>
          </Link>
          <p className="text-palco-text-muted mt-2">
            Entre na sua conta
          </p>
        </div>

        {/* Card do formulário */}
        <div className="bg-palco-card border border-palco-border rounded-2xl p-8">
          <LoginForm
            onSubmit={handleLogin}
            loading={loading}
            error={error}
          />
        </div>

        {/* Link para cadastro */}
        <p className="text-center mt-6 text-palco-text-muted text-sm">
          Não tem conta?{' '}
          <Link
            to="/register"
            className="text-palco-gold hover:text-palco-gold-light font-medium transition-colors"
          >
            Cadastre-se grátis
          </Link>
        </p>
      </div>
    </div>
  );
}
