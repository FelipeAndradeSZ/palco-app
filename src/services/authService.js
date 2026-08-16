/**
 * Auth Service — Camada de comunicação com Supabase Auth
 * 
 * Encapsula todas as operações de autenticação.
 * Nenhum componente React importa diretamente daqui —
 * eles usam o AuthContext/useAuth.
 */

import { supabase } from '../lib/supabase';

/**
 * Registra um novo usuário.
 * O trigger `handle_new_user` no banco cria automaticamente:
 * - profile (com role)
 * - wallet (zerada)
 * - artist_details (se role = artist)
 * - venue_details (se role = venue)
 * 
 * @param {{ email: string, password: string, name: string, role: string, mainGenre?: string }} data
 * @returns {Promise<{ data: object, error: object|null }>}
 */
export async function signUp({ email, password, name, role, mainGenre }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role,
        main_genre: mainGenre || null,
      },
    },
  });

  return { data, error };
}

/**
 * Login com email e senha.
 * @returns {Promise<{ data: object, error: object|null }>}
 */
export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { data, error };
}

/**
 * Logout — encerra a sessão e limpa tokens.
 * @returns {Promise<{ error: object|null }>}
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Retorna a sessão ativa atual (ou null).
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
}

/**
 * Observa mudanças de estado de autenticação.
 * Retorna a subscription para cleanup.
 */
export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      callback(event, session);
    }
  );
  return subscription;
}

/**
 * Login Social via OAuth (Google, Apple, etc)
 * O Supabase gerencia o redirecionamento automaticamente.
 * @param {'google' | 'apple'} provider 
 */
export async function signInWithOAuth(provider, returnTo = '/') {
  const safeReturnTo = typeof returnTo === 'string'
    && returnTo.startsWith('/')
    && !returnTo.startsWith('//')
    && !returnTo.includes('\\')
    ? returnTo
    : '/';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}${safeReturnTo}`,
    },
  });
  return { data, error };
}
