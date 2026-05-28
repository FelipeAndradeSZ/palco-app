/**
 * AuthContext — Estado global de autenticação
 * 
 * Centraliza toda a lógica de auth para que componentes
 * nunca precisem chamar services diretamente.
 * 
 * Estado gerenciado:
 * - user: dados do Supabase Auth (id, email, metadata)
 * - profile: dados da tabela profiles (name, role, avatar_url)
 * - loading: true durante verificação inicial da sessão
 * - error: último erro de auth (null se tudo ok)
 */

import { createContext, useState, useEffect, useCallback } from 'react';
import * as authService from '../services/authService';
import { getProfile, updateProfile } from '../services/profileService';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true); // true até verificar sessão inicial
  const [error, setError] = useState(null);

  /**
   * Carrega o perfil completo do banco após auth.
   * Inclui artist_details/venue_details via join.
   */
  const loadProfile = useCallback(async (userId) => {
    try {
      const { data, error: profileError } = await getProfile(userId);
      if (profileError) {
        console.error('[PALCO] Erro ao carregar perfil:', profileError.message);
        setProfile(null);
        return;
      }
      setProfile(data);
    } catch (err) {
      console.error('[PALCO] Erro inesperado ao carregar perfil:', err);
      setProfile(null);
    }
  }, []);

  /**
   * Efeito inicial: verifica sessão existente e
   * observa mudanças de auth (login, logout, token refresh).
   */
  useEffect(() => {
    let isMounted = true;

    // 1. Verificar sessão existente
    const initializeAuth = async () => {
      try {
        const { session } = await authService.getSession();
        if (isMounted && session?.user) {
          setUser(session.user);
          await loadProfile(session.user.id);
        }
      } catch (err) {
        console.error('[PALCO] Erro na inicialização de auth:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // 2. Observar mudanças de auth
    const subscription = authService.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        setError(null);

        // Verifica se veio de um fluxo OAuth com role pendente
        const pendingRole = localStorage.getItem('@palco/pending_role');
        if (pendingRole) {
          try {
            await updateProfile(session.user.id, { role: pendingRole, onboarding_completed: true });
            localStorage.removeItem('@palco/pending_role');
          } catch (err) {
            console.error('[PALCO] Erro ao atualizar pending role', err);
          }
        }

        await loadProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setError(null);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user);
      }
    });

    // 3. Cleanup
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  /**
   * Login — Chama service e deixa o onAuthStateChange atualizar o estado.
   */
  const handleSignIn = useCallback(async ({ email, password }) => {
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await authService.signIn({ email, password });
      if (signInError) {
        setError(signInError.message);
        return { error: signInError };
      }
      return { error: null };
    } catch (err) {
      const message = 'Erro inesperado no login. Tente novamente.';
      setError(message);
      return { error: { message } };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Registro — Passa metadata para o trigger criar profile/wallet/details.
   */
  const handleSignUp = useCallback(async ({ email, password, name, role, mainGenre }) => {
    setError(null);
    setLoading(true);
    try {
      const { error: signUpError } = await authService.signUp({
        email, password, name, role, mainGenre,
      });
      if (signUpError) {
        setError(signUpError.message);
        return { error: signUpError };
      }
      return { error: null };
    } catch (err) {
      const message = 'Erro inesperado no cadastro. Tente novamente.';
      setError(message);
      return { error: { message } };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Logout
   */
  const handleSignOut = useCallback(async () => {
    setLoading(true);
    try {
      await authService.signOut();
      // onAuthStateChange cuidará de limpar user/profile
    } catch (err) {
      console.error('[PALCO] Erro no logout:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Recarrega o perfil (útil após edições de perfil).
   */
  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await loadProfile(user.id);
    }
  }, [user, loadProfile]);

  const value = {
    user,
    profile,
    loading,
    error,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
    refreshProfile,
    isAuthenticated: !!user,
    requiresOnboarding: profile ? profile.onboarding_completed === false : false,
    isArtist: profile?.role === 'artist',
    isVenue: profile?.role === 'venue',
    isListener: profile?.role === 'listener',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
