-- The WebRTC INSERT policy checks live presence as the authenticated sender.
-- Expose only this boolean predicate; it contains no private row data.

grant execute on function public.is_artist_stream_fresh(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
