-- =========================================================================
-- Migração: Isolamento de Chat por Artista
-- =========================================================================

-- 1. Adiciona a coluna artist_id na tabela chat_messages
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS artist_id uuid
    CONSTRAINT chat_messages_artist_id_fkey REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Cria índice para busca rápida por sala e cantor
CREATE INDEX IF NOT EXISTS chat_messages_room_artist_idx
  ON public.chat_messages (room_id, artist_id);

-- Recarregar cache do PostgREST
NOTIFY pgrst, 'reload schema';
