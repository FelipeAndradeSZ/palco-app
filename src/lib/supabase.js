import { createClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase — Singleton
 * 
 * Utiliza apenas a ANON KEY (segura para client-side).
 * Toda a proteção de dados é feita via RLS (Row Level Security)
 * configurado diretamente no banco de dados.
 * 
 * A service_role key NUNCA deve ser usada no frontend.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validação rigorosa — falha rápido se as variáveis não existirem
if (!supabaseUrl) {
  throw new Error(
    '[PALCO] VITE_SUPABASE_URL não está definida. ' +
    'Verifique o arquivo .env na raiz do projeto.'
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    '[PALCO] VITE_SUPABASE_ANON_KEY não está definida. ' +
    'Verifique o arquivo .env na raiz do projeto.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
