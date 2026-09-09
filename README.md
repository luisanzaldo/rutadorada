# 🎬 RutaDorada Films

Blog editorial de cine en español: noticias, críticas, tráilers y cobertura de la temporada de premios (Oscar, Cannes, Venecia). Publicado en [rutadoradafilms.com](https://www.rutadoradafilms.com).

## 🛠️ Stack

- **[Astro 5](https://astro.build/)** — sitio estático; el panel admin y los endpoints de la API se sirven en runtime (`prerender = false`).
- **[Tailwind CSS 4](https://tailwindcss.com/)** — estilos, con tema claro/oscuro.
- **[Supabase](https://supabase.com/)** — contenido de las notas, auth de lectores, likes, favoritos y comentarios.
- **[Tiptap](https://tiptap.dev/)** — editor enriquecido del panel admin.
- **[Cloudflare](https://www.cloudflare.com/)** — Pages para el hosting, R2 para las imágenes y DNS.

## 🏗️ Cómo funciona

### El contenido vive en dos sitios a la vez

- Los posts se escriben desde el panel admin o desde un bot de Telegram, y ambos los commitean a `src/content/posts/` como `.md`/`.mdx`. **Git decide qué notas existen.**
- Pero el sitio **las lee de Supabase**, no de los archivos: `src/lib/posts.ts` consulta la tabla `posts` y `src/lib/render.ts` convierte el markdown al servir, con el mismo procesador que usa Astro al construir.
- Un paso del CI reconcilia ambos **antes** de cada build: `scripts/import-posts.mjs --commit --prune` sube a Supabase lo que haya en git y borra las filas cuyo slug ya no exista. Es el único camino por el que las notas del bot llegan a la base, porque el bot no escribe en Supabase.
- El esquema del frontmatter está en `src/content/config.ts`. Hoy es documental: ninguna página consulta ya la colección de Astro.

### Las imágenes

- Las portadas viven en R2 y se sirven desde `img.rutadoradafilms.com` con el **hash del contenido en la URL**, así que sustituir una portada cambia la URL y ninguna caché puede servir la copia vieja.
- `scripts/ingest-images.mjs` corre en el CI antes del build y sube la imagen de cualquier nota que no esté ya en R2, venga del bot o del admin. Es incremental y tolerante: un medio caído no rompe el despliegue.
- Las variantes (`-sm` para móvil, `-og` para tarjetas sociales) se pre-generan al ingerir y se derivan en `src/lib/images.ts`. No hay Worker de imágenes ni transformaciones por petición.

### El panel admin

- `/admin` permite crear y editar posts desde el navegador; el contenido se commitea al repo vía la API de GitHub y GitHub Actions construye y despliega.
- La sesión usa JWT (`jose`) + bcrypt. Los hashes van en **base64** en las variables de entorno: los `$` de un hash bcrypt se corrompen al inlinearse en el bundle.

### Build y despliegue

- GitHub Actions (`.github/workflows/deploy.yml`) construye y sube con `wrangler pages deploy`. El proyecto se creó por CLI, sin integración Git.
- `paths-ignore` evita builds por commits que no cambian el sitio publicado: `drafts/`, `scheduled/`, `rss-state.json` y `*.sql`.
- El build hace **dos consultas** a Supabase, no una por página: `SNAPSHOT_BUILD=1` (lo pone el script `build`) hace que el catálogo se lea una sola vez durante la construcción. Al servir, esa foto está desactivada.
- Una salvaguarda rompe el build si algún secreto crítico queda sin inlinear, porque Astro solo sustituye `import.meta.env` leyendo un archivo `.env`, y en Workers `process.env` es un objeto vacío.
- La caché la define `public/_headers`. **Las reglas que casan se concatenan**, no se sobrescriben: lo específico va primero y el comodín al final.

### El buscador

- El índice se sirve desde `/api/search-index.json` y el cliente lo pide una sola vez, al abrir la lupa. Antes iba inline en cada página y pesaba 741 KB por página.
- Lo cachea una **Cache Rule del panel de Cloudflare** — la única pieza de configuración que no vive en este repositorio. Las respuestas de Pages Functions son dinámicas por defecto y su `s-maxage` se ignora.

## 🚀 Desarrollo

```bash
npm install
cp .env.example .env   # y llena las variables
npm run dev            # servidor de desarrollo
npm run build          # build de producción
npm run preview        # previsualizar el build
```

## 🔧 Scripts de mantenimiento

Todos se ejecutan a mano salvo donde se indique.

| Script | Uso |
| --- | --- |
| `import-posts.mjs` | Sincroniza Supabase con los markdown de git. **Lo corre el CI** antes de cada build, con `--commit --prune`. |
| `ingest-images.mjs` | Sube a R2 las portadas que falten y genera sus variantes. **Lo corre el CI** antes del build. |
| `prune-r2-images.mjs` | Borra de R2 las imágenes que ya no referencia ninguna nota, con 30 días de cuarentena. Cruza git *y* Supabase, porque los borradores viven solo en la base. |
| `subset-icon-font.py` | Regenera el subconjunto de Material Symbols con los iconos en uso (3,7 MB → 17 KB). Con `--check` solo avisa si falta alguno. Necesita `fonttools`, `brotli` y `uharfbuzz`. |
| `check-parity.mjs` | Contrasta campo a campo las notas de git contra las de Supabase. |
| `check-render-parity.mjs` | Compara el HTML que produce el renderizado en runtime contra el del build anterior. |

## 🔑 Variables de entorno

Ver `.env.example`. En producción viven como *secrets* de GitHub Actions, donde las de GitHub llevan prefijo `GH_` para no chocar con las que Actions reserva.

| Variable | Uso |
| --- | --- |
| `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` | Cliente Supabase (contenido, auth de lectores, likes, comentarios) |
| `SUPABASE_SERVICE_ROLE_KEY` | Operaciones admin de Supabase (server-side) |
| `JWT_SECRET` | Firma de la sesión del panel admin |
| `HASH_LUISANZALDO_B64`, `HASH_RAMONFIGUEROA_B64` | Hashes bcrypt de los usuarios admin, en base64 |
| `GITHUB_TOKEN`, `GITHUB_REPO` | Publicación de posts vía API de GitHub |
| `PUBLIC_GA4_MEASUREMENT_ID`, `PUBLIC_CLARITY_PROJECT_ID`, `PUBLIC_COOKIEYES_ID` | Analytics (solo producción, condicionados a consentimiento) |
| `GROQ_API_KEY`, `NOTION_TOKEN`, `NOTION_CALENDAR_DATA_SOURCE_ID` | Asistente de calendario editorial (`/api/calendar/chat`) |
| `GOOGLE_API_KEY`, `CANNES_SHEET_ID`, `CANNES_SHEET_RANGE` | Calificaciones de festivales desde Google Sheets |

Solo en el CI: `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`, para desplegar.

## 📂 Estructura

```
src/
├── components/        # UI compartida (Header, cards, sidebars, modales)
│   └── admin/         # Editor Tiptap compartido (EditorPanel, EditorModals)
├── content/posts/     # Artículos en Markdown/MDX — git decide cuáles existen
├── layouts/           # Layout base (SEO, fuentes, analytics)
├── lib/
│   ├── posts.ts       # Lectura de notas desde Supabase
│   ├── postsDb.ts     # Escritura de notas en Supabase
│   ├── render.ts      # Markdown → HTML al servir
│   ├── images.ts      # Variantes de imagen derivadas del hash
│   ├── richText.ts    # Énfasis *markdown* en títulos y descripciones
│   └── auth.ts, users.ts, supabase.ts, tiptap-editor.ts, ...
├── pages/
│   ├── [categoria].astro   # Listados: /criticas, /premios, /trailers, /articulos
│   ├── admin/              # Panel de publicación (server-rendered)
│   ├── api/                # Endpoints (auth, posts, search-index, cannes, calendar)
│   └── posts/[...slug]     # Página de artículo
└── styles/global.css  # Tailwind + fuentes autohospedadas
scripts/               # Mantenimiento (ver arriba)
public/
├── _headers           # Política de caché
└── fonts/             # Fuentes autohospedadas
wrangler.toml          # Config de Cloudflare Pages, incluido nodejs_compat
```

## 📜 SQL de Supabase

`supabase_posts.sql` crea la tabla `posts` con su RLS —lectura pública solo de lo publicado—, y `supabase_setup.sql` y `supabase_grants.sql` cubren el esquema y los permisos de las tablas de interacción. Sin los GRANT explícitos la Data API no expone la tabla. `likes`, `comentarios` y `favoritos` guardan `likes`, `comentarios` y `favoritos` guardan `articulo_id TEXT` —el slug— sin llave foránea, así que **el slug debe ser inmutable después de publicar** o esas interacciones quedan huérfanas en silencio.
