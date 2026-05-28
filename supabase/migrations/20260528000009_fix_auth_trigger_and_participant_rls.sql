-- =========================================================================
-- Migração: Correção do Trigger de Auth e Política de RLS de Participantes
-- =========================================================================

-- 1. Corrige o trigger de criação de novo usuário para evitar colisão com tr_handle_new_profile_wallet
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role, avatar_url, onboarding_completed)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', 'Usuário ' || substr(NEW.id::text, 1, 5)),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'listener'::public.user_role),
    NEW.raw_user_meta_data->>'avatar_url',
    (NEW.raw_user_meta_data->>'role' IS NOT NULL) -- Se tem role no meta, veio do email (ou onboarding manual), então onboarding concluído.
  );

  -- Evita erro de constraint se a carteira já foi criada pelo trigger AFTER INSERT em profiles
  INSERT INTO public.wallets (profile_id, balance)
  VALUES (NEW.id, 0.00)
  ON CONFLICT (profile_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. Adiciona a política de RLS em room_participants para permitir UPDATE (necessário para o upsert de joinRoom)
DROP POLICY IF EXISTS "RoomParticipants: usuario edita participacao" ON public.room_participants;
CREATE POLICY "RoomParticipants: usuario edita participacao"
  ON public.room_participants FOR UPDATE
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

-- Recarregar cache do PostgREST
NOTIFY pgrst, 'reload schema';
