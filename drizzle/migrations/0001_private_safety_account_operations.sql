GRANT DELETE ON public.profiles, public.incidents TO authenticated;
CREATE POLICY "own profile delete" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);
REVOKE EXECUTE ON FUNCTION public.get_shared_incident(uuid) FROM anon, authenticated;
COMMENT ON FUNCTION public.get_shared_incident(uuid) IS 'DEPRECATED: sharing disabled until explicit consent, expiry and recipient workflow are implemented';
CREATE OR REPLACE FUNCTION public.replace_my_contacts(_contacts jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF jsonb_typeof(_contacts) <> 'array' OR jsonb_array_length(_contacts) > 50 THEN RAISE EXCEPTION 'Invalid contacts'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(_contacts) c WHERE length(trim(c->>'name')) < 2 OR coalesce(c->>'phone','') !~ '^\+?[0-9]{3,15}$') THEN RAISE EXCEPTION 'Invalid contact'; END IF;
  DELETE FROM public.contacts WHERE user_id = auth.uid();
  INSERT INTO public.contacts(user_id,name,relationship,phone,call,sms,position)
  SELECT auth.uid(), c->>'name', coalesce(c->>'relationship','Other'), c->>'phone', coalesce((c->>'call')::boolean,true), coalesce((c->>'sms')::boolean,true), (ordinality-1)::int FROM jsonb_array_elements(_contacts) WITH ORDINALITY AS t(c,ordinality);
END $$;
REVOKE ALL ON FUNCTION public.replace_my_contacts(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_my_contacts(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.clear_my_safety_data() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  DELETE FROM public.contacts WHERE user_id=auth.uid();
  DELETE FROM public.incidents WHERE user_id=auth.uid();
  DELETE FROM public.profiles WHERE id=auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.clear_my_safety_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_my_safety_data() TO authenticated;