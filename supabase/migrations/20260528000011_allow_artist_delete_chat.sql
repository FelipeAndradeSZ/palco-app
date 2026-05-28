-- =========================================================================
-- Migração: Permissão para Artistas Limparem seus Chats
-- =========================================================================

-- 1. Habilita política de DELETE para a tabela chat_messages para o artista dono do chat
DROP POLICY IF EXISTS "Artists can delete own chat messages" ON public.chat_messages;
CREATE POLICY "Artists can delete own chat messages"
  ON public.chat_messages
  FOR DELETE
  USING (artist_id = auth.uid());

-- Recarregar cache do PostgREST
NOTIFY pgrst, 'reload schema';
