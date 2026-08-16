import { Component } from 'react';
import { clearChunkReloadGuard, requestChunkReload } from '../../lib/chunkRecovery';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    requestChunkReload(error);
  }

  handleReload = () => {
    clearChunkReloadGuard();
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-palco-black px-4 text-center">
        <section className="w-full max-w-md rounded-2xl border border-palco-border bg-palco-card p-7">
          <p className="text-xs font-black uppercase text-palco-gold">PALCO</p>
          <h1 className="mt-3 font-display text-2xl font-black text-palco-text">
            A pagina precisa ser atualizada
          </h1>
          <p className="mt-3 text-sm leading-6 text-palco-text-muted">
            Uma nova versao do PALCO foi publicada ou a conexao falhou durante o carregamento.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 w-full rounded-xl bg-palco-gold px-5 py-3 text-sm font-black text-palco-black"
          >
            Atualizar agora
          </button>
        </section>
      </main>
    );
  }
}
