/**
 * useAuth — Hook de autenticação
 * 
 * Atalho para useContext(AuthContext) com validação.
 */

import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error(
      '[PALCO] useAuth deve ser usado dentro de um <AuthProvider>. ' +
      'Verifique que o App está envolvido pelo AuthProvider.'
    );
  }

  return context;
}
