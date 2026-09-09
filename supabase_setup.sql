-- =====================================================================
-- Migración Supabase para RutaDorada
-- Crea tablas, políticas RLS, función RPC y trigger de perfiles.
-- Es idempotente: se puede correr varias veces sin romper nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLAS
-- ---------------------------------------------------------------------

-- Perfiles: extiende auth.users con un rol (user/admin)
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Likes: un usuario puede dar like una vez por artículo
CREATE TABLE IF NOT EXISTS public.likes (
  id          BIGSERIAL PRIMARY KEY,
  articulo_id TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (articulo_id, user_id)
);

-- Comentarios: un usuario puede dejar varios comentarios por artículo
CREATE TABLE IF NOT EXISTS public.comentarios (
  id          BIGSERIAL PRIMARY KEY,
  articulo_id TEXT NOT NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT,
  contenido   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Favoritos (bookmarks): un usuario puede guardar un artículo una vez
CREATE TABLE IF NOT EXISTS public.favoritos (
  id          BIGSERIAL PRIMARY KEY,
  articulo_id TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (articulo_id, user_id)
);

-- ---------------------------------------------------------------------
-- 2. ÍNDICES (rendimiento en consultas frecuentes)
-- ---------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_likes_articulo       ON public.likes(articulo_id);
CREATE INDEX IF NOT EXISTS idx_likes_user           ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_comentarios_articulo ON public.comentarios(articulo_id);
CREATE INDEX IF NOT EXISTS idx_favoritos_articulo   ON public.favoritos(articulo_id);
CREATE INDEX IF NOT EXISTS idx_favoritos_user       ON public.favoritos(user_id);

-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (activar en todas)
-- ---------------------------------------------------------------------

ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favoritos   ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 4. GRANTS A LA DATA API (PostgREST / supabase-js / GraphQL)
-- Desde el 30-oct-2026 Supabase ya no expone tablas nuevas en "public"
-- a la Data API por defecto. Estos GRANT son idempotentes y dejan el
-- script preparado para tablas nuevas. RLS sigue filtrando filas: GRANT
-- abre el "tubo" y las policies deciden qué se ve.
-- ---------------------------------------------------------------------

-- PROFILES: solo el dueño autenticado puede leer (RLS). service_role
-- para que el trigger handle_new_user y el backfill puedan insertar.
GRANT SELECT                         ON public.profiles    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles    TO service_role;

-- LIKES: lectura pública, escritura autenticada.
GRANT SELECT                         ON public.likes       TO anon, authenticated;
GRANT INSERT, DELETE                 ON public.likes       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.likes       TO service_role;

-- COMENTARIOS: lectura pública, escritura autenticada.
GRANT SELECT                         ON public.comentarios TO anon, authenticated;
GRANT INSERT, DELETE                 ON public.comentarios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comentarios TO service_role;

-- FAVORITOS: privados al dueño (RLS). El conteo público va por RPC.
GRANT SELECT, INSERT, DELETE         ON public.favoritos   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favoritos   TO service_role;

-- ---------------------------------------------------------------------
-- 5. POLÍTICAS RLS
-- ---------------------------------------------------------------------

-- LIKES: lectura pública, escritura autenticada solo del propio user
DROP POLICY IF EXISTS "Likes lectura publica"   ON public.likes;
DROP POLICY IF EXISTS "Likes insert propio"     ON public.likes;
DROP POLICY IF EXISTS "Likes delete propio"     ON public.likes;

CREATE POLICY "Likes lectura publica"
  ON public.likes FOR SELECT USING (true);

CREATE POLICY "Likes insert propio"
  ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Likes delete propio"
  ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- COMENTARIOS: lectura pública, insert solo autenticados, delete propio o admin
DROP POLICY IF EXISTS "Comentarios lectura publica" ON public.comentarios;
DROP POLICY IF EXISTS "Comentarios insert propio"   ON public.comentarios;
DROP POLICY IF EXISTS "Comentarios delete propio"   ON public.comentarios;

CREATE POLICY "Comentarios lectura publica"
  ON public.comentarios FOR SELECT USING (true);

CREATE POLICY "Comentarios insert propio"
  ON public.comentarios FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Comentarios delete propio"
  ON public.comentarios FOR DELETE USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- FAVORITOS: privados (cada user ve solo los suyos)
DROP POLICY IF EXISTS "Favoritos lectura propia" ON public.favoritos;
DROP POLICY IF EXISTS "Favoritos insert propio"  ON public.favoritos;
DROP POLICY IF EXISTS "Favoritos delete propio"  ON public.favoritos;

CREATE POLICY "Favoritos lectura propia"
  ON public.favoritos FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Favoritos insert propio"
  ON public.favoritos FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Favoritos delete propio"
  ON public.favoritos FOR DELETE USING (auth.uid() = user_id);

-- PROFILES: cada user ve solo su propio perfil
DROP POLICY IF EXISTS "Profiles lectura propia" ON public.profiles;

CREATE POLICY "Profiles lectura propia"
  ON public.profiles FOR SELECT USING (auth.uid() = id);

-- ---------------------------------------------------------------------
-- 6. FUNCIÓN RPC: contador público de favoritos
-- (favoritos es privado por RLS, pero queremos mostrar el total a todos)
-- SECURITY DEFINER hace que la función corra con permisos del owner,
-- saltando RLS para devolver solo un COUNT (no expone filas).
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_bookmark_count(p_articulo_id TEXT)
RETURNS BIGINT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::BIGINT FROM public.favoritos WHERE articulo_id = p_articulo_id;
$$;

-- Permitir que cualquiera (anon + authenticated) llame a la función
GRANT EXECUTE ON FUNCTION public.get_bookmark_count(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. TRIGGER: crear profile automáticamente al registrarse un usuario
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------
-- 8. BACKFILL: crear profile para usuarios que ya existían antes del trigger
-- ---------------------------------------------------------------------

INSERT INTO public.profiles (id, role)
SELECT id, 'user' FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 9. TRIGGER: el nombre del autor de un comentario lo fija el servidor
--
-- El cliente insertaba author_name tal cual y la política RLS solo
-- comprueba user_id, así que cualquier usuario autenticado podía enviar
-- el nombre que quisiera en cada comentario. El render ya escapa el
-- valor (Comments.astro), pero el dato debe nacer limpio: este trigger
-- ignora lo que mande el cliente y toma el nombre de la cuenta que firma
-- el comentario, con la misma prioridad que usa el cliente para
-- mostrarlo: full_name, luego la parte local del email, luego 'Usuario'.
--
-- SECURITY DEFINER porque auth.users no es legible por authenticated.
-- Solo actúa si hay user_id; una fila sin él (service_role) se deja tal
-- cual. No hace falta cubrir UPDATE: authenticated no tiene ese GRANT.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.comentarios_set_author_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(
           NULLIF(BTRIM(u.raw_user_meta_data->>'full_name'), ''),
           NULLIF(split_part(u.email, '@', 1), ''),
           'Usuario'
         )
    INTO v_name
    FROM auth.users AS u
   WHERE u.id = NEW.user_id;

  -- Si el usuario no existe, la FK ya rechaza la fila; el COALESCE cubre
  -- el caso teórico de que el SELECT no devuelva nada.
  NEW.author_name := LEFT(COALESCE(v_name, 'Usuario'), 80);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comentarios_set_author_name ON public.comentarios;
CREATE TRIGGER comentarios_set_author_name
  BEFORE INSERT ON public.comentarios
  FOR EACH ROW EXECUTE FUNCTION public.comentarios_set_author_name();

-- Opcional, NO se ejecuta solo: alinea los comentarios ya existentes con
-- el nombre actual de su cuenta. Reescribe author_name de todo el
-- histórico, así que queda comentado para que sea una decisión consciente.
--
-- UPDATE public.comentarios AS c
--    SET author_name = LEFT(COALESCE(
--          NULLIF(BTRIM(u.raw_user_meta_data->>'full_name'), ''),
--          NULLIF(split_part(u.email, '@', 1), ''),
--          'Usuario'), 80)
--   FROM auth.users AS u
--  WHERE u.id = c.user_id;
