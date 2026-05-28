import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { confirmCheckoutSession } from '../services/walletService';
import { useAuth } from '../hooks/useAuth';
import Spinner from '../components/ui/Spinner';

export default function WalletReturnPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Confirmando pagamento...');

  useEffect(() => {
    let cancelled = false;
    const sessionId = searchParams.get('session_id');

    async function confirmPayment() {
      if (!sessionId) {
        setStatus('error');
        setMessage('Sessao de pagamento nao encontrada.');
        return;
      }

      try {
        const result = await confirmCheckoutSession(sessionId);
        if (cancelled) return;
        await refreshProfile();
        setStatus('success');
        setMessage(`Saldo atualizado. Novo saldo: R$ ${Number(result.balance || 0).toFixed(2)}.`);
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setMessage(err.message || 'Nao foi possivel confirmar o pagamento.');
      }
    }

    confirmPayment();

    return () => {
      cancelled = true;
    };
  }, [refreshProfile, searchParams]);

  useEffect(() => {
    if (status !== 'success') return undefined;
    const timeout = setTimeout(() => navigate('/rooms'), 2500);
    return () => clearTimeout(timeout);
  }, [navigate, status]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-palco-black px-4">
      <div className="w-full max-w-md rounded-2xl border border-palco-border bg-palco-card p-6 text-center">
        {status === 'loading' ? (
          <div className="flex justify-center">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl font-black ${
            status === 'success'
              ? 'bg-palco-success/15 text-palco-success'
              : 'bg-palco-live/15 text-palco-live'
          }`}
          >
            {status === 'success' ? '✓' : '!'}
          </div>
        )}
        <h1 className="mt-5 font-display text-2xl font-black text-palco-text">
          {status === 'success' ? 'Pagamento confirmado' : 'Confirmando saldo'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-palco-text-muted">{message}</p>
        <Link
          to="/rooms"
          className="mt-6 inline-flex rounded-xl bg-palco-gold px-5 py-3 text-sm font-black text-palco-black no-underline transition hover:bg-palco-gold-light"
        >
          Voltar para salas
        </Link>
      </div>
    </div>
  );
}
