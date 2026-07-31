# 🎬 RutaDorada Films

Blog editorial de cine en español: noticias, críticas, tráilers y cobertura de la temporada de premios (Oscar, Cannes, Venecia). Publicado en [rutadoradafilms.com](https://www.rutadoradafilms.com).

## 🛠️ Stack

- **[Astro 5](https://astro.build/)** — sitio estático con content collections (posts en Markdown/MDX) y rutas server-rendered para el panel admin y la API.
- **[Tailwind CSS 4](https://tailwindcss.com/)** — estilos, con tema claro/oscuro.
- **[Supabase](https://supabase.com/)** — auth de lectores, likes, favoritos y comentarios.
- **[Tiptap](https://tiptap.dev/)** — editor enriquecido del panel admin.
- **[Vercel](https://vercel.com/)** — hosting y deploy.

## 🏗️ Cómo funciona

- Los posts viven en `src/content/posts/` como `.md`/`.mdx` (schema en `src/content/config.ts`).
- El **panel admin** (`/admin`) permite crear y editar posts desde el navegador: el contenido se commitea al repo vía la API de GitHub y se dispara un deploy hook de Vercel. La sesión del admin usa JWT (`jose`) + bcrypt; los usuarios se definen en `src/lib/users.ts` con hashes en variables de entorno.
- En `prebuild`, `scripts/download-images.mjs` descarga las imágenes de portada externas, las optimiza con `sharp` (versión desktop 1280×720 y móvil 600×338) y reescribe el frontmatter para servirlas localmente desde `public/images/posts/`.
- Los lectores pueden registrarse (Supabase Auth) para dar likes, guardar favoritos y comentar.
- `rss-state.json` lo actualiza una automatización externa; el `ignoreCommand` de `vercel.json` evita que esos commits disparen builds.

## 🚀 Desarrollo

```bash
npm install
cp .env.example .env   # y llena las variables
npm run dev            # servidor de desarrollo
npm run build          # build de producción (incluye prebuild de imágenes)
npm run preview        # previsualizar el build
```

## 🔑 Variables de entorno

Ver `.env.example`. Resumen:

| Variable | Uso |
| --- | --- |
| `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` | Cliente Supabase (auth de lectores, likes, comentarios) |
| `SUPABASE_SERVICE_ROLE_KEY` | Operaciones admin de Supabase (server-side) |
| `JWT_SECRET` | Firma de la sesión del panel admin |
| `HASH_LUISANZALDO`, `HASH_RAMONFIGUEROA` | Hashes bcrypt de los usuarios admin |
| `GITHUB_TOKEN`, `GITHUB_REPO` | Publicación de posts vía API de GitHub |
| `VERCEL_DEPLOY_HOOK` | Redeploy al publicar desde el admin |
| `PUBLIC_GA4_MEASUREMENT_ID`, `PUBLIC_CLARITY_PROJECT_ID`, `PUBLIC_COOKIEYES_ID` | Analytics (solo producción, condicionados a consentimiento) |
| `GROQ_API_KEY`, `NOTION_TOKEN`, `NOTION_CALENDAR_DATA_SOURCE_ID` | Asistente de calendario editorial (`/api/calendar/chat`) |
| `GOOGLE_API_KEY`, `CANNES_SHEET_ID`, `CANNES_SHEET_RANGE` | Calificaciones de festivales desde Google Sheets |

## 📂 Estructura

```
src/
├── components/        # UI compartida (Header, cards, sidebars, modales)
│   └── admin/         # Editor Tiptap compartido (EditorPanel, EditorModals)
├── content/posts/     # Artículos en Markdown/MDX
├── layouts/           # Layout base (SEO, fuentes, analytics)
├── lib/               # auth (JWT), supabase, tiptap-editor, users
├── pages/
│   ├── [categoria].astro   # Listados: /criticas, /premios, /trailers, /articulos
│   ├── admin/              # Panel de publicación (server-rendered)
│   ├── api/                # Endpoints (auth, posts, cannes, calendar)
│   └── posts/[...slug]     # Página de artículo
└── styles/global.css  # Tailwind + fuentes autohospedadas
```

## 📜 SQL de Supabase

`supabase_setup.sql` y `supabase_grants.sql` contienen el esquema y permisos de las tablas de likes/favoritos/comentarios.
