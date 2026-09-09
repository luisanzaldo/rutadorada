-- Tabla de contenido para RutaDorada Films.
--
-- El sitio LEE de esta tabla: src/lib/posts.ts la consulta y src/lib/render.ts
-- convierte el markdown al servir. Pero la fuente de verdad de QUÉ notas existen
-- sigue siendo git: import-posts.mjs sube lo que haya en src/content/posts y su
-- --prune borra las filas cuyo slug ya no esté ahí.
--
-- Esa convivencia es PERMANENTE, no un paso intermedio. El plan de migración
-- preveía apagar la escritura doble y dejar solo la base, y esa fase se descartó
-- a conciencia: el bot de Telegram commitea markdown a git y no escribe en
-- Supabase, así que el upsert del CI es el único puente por el que sus notas
-- llegan aquí. Retirarlo lo dejaría publicando en el vacío.
--
-- Decisiones que conviene entender antes de tocar nada:
--
--   * El slug es la llave de unión con el resto del sistema. Las tablas likes,
--     comentarios y favoritos guardan articulo_id TEXT con ese mismo valor y sin
--     llave foránea. Mientras los slugs no cambien, toda la interacción de los
--     lectores sobrevive. Por eso el slug debe ser INMUTABLE una vez publicado:
--     renombrarlo huérfana comentarios en silencio.
--
--   * body admite cadena vacía. 20 de las 194 notas son tráilers cuyo contenido
--     es el video, no el texto; un NOT NULL a secas rompería su importación.
--
--   * featured existe por fidelidad con el frontmatter, pero hoy no lo usa nadie:
--     ninguna nota lo declara y el Hero toma simplemente las cinco más recientes.

-- ---------------------------------------------------------------------------
-- 1. Tabla
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.posts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT        UNIQUE NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','scheduled','published')),

  title         TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  body          TEXT        NOT NULL DEFAULT '',

  pub_date      TIMESTAMPTZ NOT NULL,
  author        TEXT        NOT NULL,
  author_image  TEXT,
  category      TEXT        NOT NULL,
  tags          TEXT[]      NOT NULL DEFAULT '{}',
  read_time     TEXT,
  featured      BOOLEAN     NOT NULL DEFAULT FALSE,

  rating        INT         CHECK (rating BETWEEN 0 AND 100),
  letterboxd    TEXT,
  video_url     TEXT,

  image_url     TEXT        NOT NULL,
  image_credit  TEXT,        -- crédito editorial de la imagen
  image_source  TEXT,        -- URL de origen, procedencia para la fase 4

  ficha_tecnica JSONB,       -- sinopsis, director, cast, duracion
  fuente        JSONB,       -- nombre, url

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. Índices
-- ---------------------------------------------------------------------------

-- El listado principal: publicados, más recientes primero.
CREATE INDEX IF NOT EXISTS idx_posts_feed     ON public.posts (status, pub_date DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category ON public.posts (category);
CREATE INDEX IF NOT EXISTS idx_posts_tags     ON public.posts USING GIN (tags);

-- ---------------------------------------------------------------------------
-- 3. updated_at automático
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.posts_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_posts_updated_at ON public.posts;
CREATE TRIGGER trg_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.posts_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS: lectura pública solo de lo publicado
-- ---------------------------------------------------------------------------

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Posts publicados: lectura publica" ON public.posts;
CREATE POLICY "Posts publicados: lectura publica"
  ON public.posts FOR SELECT
  USING (status = 'published' AND pub_date <= NOW());

-- Borradores y programados quedan fuera del alcance de anon y authenticated.
-- La escritura va siempre con service_role, que ignora RLS por definición.

-- ---------------------------------------------------------------------------
-- 5. GRANTS para la Data API
-- ---------------------------------------------------------------------------
-- RLS filtra filas; GRANT abre el "tubo" por operación. Sin esto la tabla
-- existe pero supabase-js no la ve. Misma convención que supabase_grants.sql.

GRANT SELECT                         ON public.posts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO service_role;
