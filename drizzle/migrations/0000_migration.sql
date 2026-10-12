CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  age int,
  blood_type text NOT NULL DEFAULT '',
  conditions text[] NOT NULL DEFAULT '{}',
  allergies text[] NOT NULL DEFAULT '{}',
  medications text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  relationship text NOT NULL DEFAULT 'Other',
  phone text NOT NULL,
  call boolean NOT NULL DEFAULT true,
  sms boolean NOT NULL DEFAULT true,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own contacts" ON public.contacts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  share_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  reason text NOT NULL,
  reading text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  lat double precision,
  lng double precision,
  accuracy double precision,
  location_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own incidents" ON public.incidents FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_shared_incident(_token uuid)
RETURNS TABLE (reason text, reading text, status text, lat double precision, lng double precision, accuracy double precision, location_at timestamptz, started_at timestamptz, resolved_at timestamptz, full_name text, age int, blood_type text, conditions text[], allergies text[], medications text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.reason, i.reading, i.status, i.lat, i.lng, i.accuracy, i.location_at, i.started_at, i.resolved_at,
         p.full_name, p.age, p.blood_type, p.conditions, p.allergies, p.medications
  FROM public.incidents i LEFT JOIN public.profiles p ON p.id = i.user_id
  WHERE i.share_token = _token
    AND (i.status = 'active' OR i.resolved_at > now() - interval '1 hour');
$$;
REVOKE ALL ON FUNCTION public.get_shared_incident(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shared_incident(uuid) TO anon, authenticated;