/**
 * AppShell — Layout principal
 *
 * Renderiza o Header fixo no topo e envolve o conteúdo
 * com padding superior para compensar a header fixa.
 *
 * @param {React.ReactNode} children - Conteúdo da página
 */

import Header from './Header';

export default function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-palco-black">
      <Header />
      <main className="pt-16">{children}</main>
    </div>
  );
}
