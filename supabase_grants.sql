-- =====================================================================
-- GRANTS explícitos a la Data API de Supabase (PostgREST / supabase-js)
--
-- Contexto: desde el 30-oct-2026, Supabase deja de exponer por defecto
-- las tablas en "public" a la Data API. Las tablas existentes conservan
-- sus grants implícitos, pero correr este snippet los deja escritos
-- como código y elimina cualquier riesgo de regresión a futuro.
--
-- Idempotente: se puede correr varias veces sin romper nada.
-- RLS sigue filtrando filas; GRANT solo abre el "tubo" por operación.
--
-- Cómo aplicarlo:
--   Supabase Dashboard → SQL Editor → pegar este archivo → Run.
-- =====================================================================

-- PROFILES: solo el dueño autenticado puede leer (RLS).
-- service_role para que el trigger handle_new_user y el backfill inserten.
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

-- CANNES_SNAPSHOT: gestionada exclusivamente desde el servidor con
-- supabaseAdmin (service_role). No se expone a anon ni authenticated.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cannes_snapshot TO service_role;

-- ---------------------------------------------------------------------
-- Verificación (opcional): lista los grants actuales en public.
-- Útil para confirmar que todo quedó como esperas.
-- ---------------------------------------------------------------------
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND grantee IN ('anon', 'authenticated', 'service_role')
-- ORDER BY table_name, grantee, privilege_type;
