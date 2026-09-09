/**
 * Lectura de notas desde Supabase.
 *
 * Fase 5, paso 2: esta capa existe pero todavía no la usa nadie. Sustituirá a
 * `getCollection("posts")` en los 12 archivos que hoy lo llaman, así que su
 * contrato es deliberadamente el mismo que el de una entrada de contenido de
 * Astro —`{ slug, body, data }` con `data.pubDate` como `Date` de verdad— para
 * que el cambio sea una sustitución de import y nada más.
 *
 * Lo que NO cubre todavía: `post.render()`, que solo usa la página de la nota y
 * exige renderizar markdown en runtime. Va aparte porque es código nuevo, no
 * configuración: hay que reimplementar el plugin de enlaces externos de
 * `astro.config.mjs` y decidir la política de HTML crudo, que las notas llevan
 * dentro.
 */

/** Una fila de `public.posts`, tal cual la devuelve PostgREST. */
export type FilaPost = {
  slug: string;
  status: 'draft' | 'scheduled' | 'published';
  title: string;
  description: string;
  body: string;
  pub_date: string;
  author: string;
  author_image: string | null;
  category: string;
  tags: string[] | null;
  read_time: string | null;
  featured: boolean;
  rating: number | null;
  letterboxd: string | null;
  video_url: string | null;
  image_url: string;
  image_credit: string | null;
  image_source: string | null;
  ficha_tecnica: FichaTecnica | null;
  fuente: Fuente | null;
};

export type FichaTecnica = { sinopsis: string; director: string; cast: string; duracion: string };
export type Fuente = { nombre: string; url: string };

/**
 * La forma que consumen hoy las páginas, idéntica a la de `getCollection`
 * salvo en una cosa: NO trae el cuerpo.
 *
 * Traer los 198 cuerpos cuesta 894 KB y 1,6 s; solo los metadatos, 137 KB y
 * 0,3 s. Ninguna página que liste notas necesita el texto — la única que lo
 * pedía era `Header.astro`, para el índice de búsqueda que va inline en cada
 * página, y que es justamente el problema que esta fase viene a resolver. El
 * cuerpo se pide de una en una con `getPost`.
 */
export type EntradaPost = {
  slug: string;
  data: {
    title: string;
    description: string;
    pubDate: Date;
    author: string;
    authorImage?: string;
    image: string;
    imageSource?: string;
    category: string;
    readTime?: string;
    featured: boolean;
    tags: string[];
    rating?: number;
    letterboxd?: string;
    videoUrl?: string;
    fichaTecnica?: FichaTecnica;
    fuente?: Fuente;
  };
};

/**
 * `null` en la base y campo ausente en el frontmatter son lo mismo. El esquema
 * de contenido los declara opcionales, así que la entrada tampoco los lleva:
 * dejarlos como `null` haría que `?? valorPorDefecto` dejara de funcionar en
 * los componentes.
 */
const opcional = <T,>(v: T | null | undefined): T | undefined =>
  v === null || v === undefined || v === '' ? undefined : v;

/** Una nota con su texto. Solo la página de la nota necesita esto. */
export type EntradaPostCompleta = EntradaPost & { body: string };

export function filaAEntrada(fila: FilaPost): EntradaPost {
  return {
    slug: fila.slug,
    data: {
      title: fila.title,
      description: fila.description ?? '',
      // Tiene que ser un Date real: las páginas llaman a .getTime(),
      // .toISOString() y .toLocaleDateString() sobre este valor.
      pubDate: new Date(fila.pub_date),
      author: fila.author,
      authorImage: opcional(fila.author_image),
      image: fila.image_url,
      imageSource: opcional(fila.image_source),
      category: fila.category,
      readTime: opcional(fila.read_time),
      featured: fila.featured ?? false,
      tags: fila.tags ?? [],
      rating: opcional(fila.rating),
      letterboxd: opcional(fila.letterboxd),
      videoUrl: opcional(fila.video_url),
      fichaTecnica: opcional(fila.ficha_tecnica),
      fuente: opcional(fila.fuente),
    },
  };
}

/** Sin `body`: es el 85% del peso y ninguna vista de listado lo usa. */
const COLUMNAS = [
  'slug', 'status', 'title', 'description', 'pub_date', 'author',
  'author_image', 'category', 'tags', 'read_time', 'featured', 'rating',
  'letterboxd', 'video_url', 'image_url', 'image_credit', 'image_source',
  'ficha_tecnica', 'fuente',
].join(',');

const COLUMNAS_CON_CUERPO = `${COLUMNAS},body`;

/** Añade el cuerpo a una entrada ya mapeada. */
export function filaAEntradaCompleta(fila: FilaPost): EntradaPostCompleta {
  return { ...filaAEntrada(fila), body: fila.body ?? '' };
}

const PAGINA = 1000;

type Entorno = { PUBLIC_SUPABASE_URL?: string; PUBLIC_SUPABASE_ANON_KEY?: string };

/**
 * El entorno se puede inyectar. Hoy se leen de `import.meta.env`, que Astro
 * inlinea al construir; en la fase 6, cuando los secretos pasen a Worker
 * secrets, bastará con pasarle `Astro.locals.runtime.env` sin tocar nada más.
 */
function credenciales(env?: Entorno) {
  const url = env?.PUBLIC_SUPABASE_URL ?? import.meta.env.PUBLIC_SUPABASE_URL;
  const key = env?.PUBLIC_SUPABASE_ANON_KEY ?? import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Faltan PUBLIC_SUPABASE_URL o PUBLIC_SUPABASE_ANON_KEY');
  return { url, key };
}

/**
 * Todas las notas publicadas, con las columnas que se pidan.
 *
 * Expuesta porque no toda vista quiere la misma forma: el índice de búsqueda
 * necesita los cuerpos y no necesita casi nada más, y traerse las columnas de
 * un listado completo para descartarlas sería el derroche que esta capa evita.
 */
export async function consultarPublicadas<T>(columnas: string, env?: Entorno): Promise<T[]> {
  const { url, key } = credenciales(env);
  const filas: T[] = [];

  for (let desde = 0; ; desde += PAGINA) {
    const q = new URL(`${url}/rest/v1/posts`);
    q.searchParams.set('select', columnas);
    q.searchParams.set('status', 'eq.published');
    // El slug desempata: dos notas comparten pub_date y sin criterio
    // secundario Postgres puede devolverlas en distinto orden entre
    // consultas, lo que haría bailar el HTML sin que cambie nada.
    q.searchParams.set('order', 'pub_date.desc,slug.asc');
    q.searchParams.set('limit', String(PAGINA));
    q.searchParams.set('offset', String(desde));

    const res = await fetch(q.toString(), {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);

    const lote: T[] = await res.json();
    filas.push(...lote);
    if (lote.length < PAGINA) return filas;
  }
}

/**
 * Al construir, el catálogo se lee una sola vez y se conserva.
 *
 * Deduplicar solo lo que está en vuelo —lo que hace `enVuelo` más abajo— es lo
 * correcto al servir: el ámbito de módulo de un Worker sobrevive entre
 * peticiones, así que cachear ahí serviría contenido viejo. Un build no tiene
 * ese problema: es una foto de un instante y nada de lo que lea puede quedarse
 * obsoleto dentro de él.
 *
 * Sin esta foto cada página se descargaba el catálogo entero. Medido sobre las
 * 249 páginas: 243 consultas y 34,7 MB para entregar 0,9 MB de contenido, 77 de
 * los 114 segundos que tardaba el build. Y el coste crecía con el cuadrado del
 * número de notas, porque crecen a la vez las páginas y el tamaño de cada
 * consulta.
 *
 * Se activa solo con SNAPSHOT_BUILD, que pone el script `build` de
 * package.json. `astro dev` no la lleva, y en el Worker `process.env` es un
 * objeto vacío, así que al servir esto es siempre falso.
 */
const FOTO_DE_BUILD = typeof process !== 'undefined' && !!process.env?.SNAPSHOT_BUILD;

let fotoCatalogo: Promise<EntradaPost[]> | null = null;

/**
 * Deduplica solo las peticiones en vuelo, no entre peticiones distintas.
 *
 * Una sola página llama a esto desde una docena de sitios —el header, el hero,
 * la barra lateral, la propia página— y todas deben compartir una única
 * consulta. Pero el ámbito de módulo de un Worker sobrevive entre peticiones,
 * así que cachearlo ahí serviría contenido viejo. La promesa se limpia al
 * resolverse: comparten quienes coinciden en el tiempo, y la siguiente petición
 * empieza de cero.
 */
let enVuelo: Promise<EntradaPost[]> | null = null;

export function getPosts(env?: Entorno): Promise<EntradaPost[]> {
  if (FOTO_DE_BUILD) {
    fotoCatalogo ??= consultarPublicadas<FilaPost>(COLUMNAS, env).then((filas) =>
      filas.map(filaAEntrada),
    );
    // Una copia por llamada, no la foto misma. `index.astro` y `archive.astro`
    // ordenan el resultado in situ con .sort(), así que sin copia la primera
    // página en construirse reordenaría el array de todas las demás. Hoy no se
    // notaría —ordenan por pub_date desc, que es el orden en que ya llegan—
    // pero cambiar cualquiera de esos criterios corrompería el resto del sitio
    // en silencio y según el orden del build.
    return fotoCatalogo.then((posts) => posts.slice());
  }

  if (enVuelo) return enVuelo;
  enVuelo = consultarPublicadas<FilaPost>(COLUMNAS, env)
    .then((filas) => filas.map(filaAEntrada))
    .finally(() => {
      enVuelo = null;
    });
  return enVuelo;
}

/**
 * Al construir, los cuerpos se piden todos de una vez.
 *
 * Pedir una fila sola es lo acertado al servir, que es para lo que se escribió:
 * se muestra una nota y solo hace falta esa. Al construir se generan las 198, y
 * entonces la cuenta se invierte — 198 viajes de ida y vuelta costaban 27 s
 * medidos para traer los mismos 0,9 MB que una sola consulta de 1,6 s.
 *
 * El mapa se queda con las publicadas, igual que `consultarPublicadas`, así que
 * un borrador sigue devolviendo `undefined` como en la ruta de una sola fila.
 */
let fotoCuerpos: Promise<Map<string, EntradaPostCompleta>> | null = null;

function catalogoConCuerpos(env?: Entorno): Promise<Map<string, EntradaPostCompleta>> {
  fotoCuerpos ??= consultarPublicadas<FilaPost>(COLUMNAS_CON_CUERPO, env).then(
    (filas) => new Map(filas.map((fila) => [fila.slug, filaAEntradaCompleta(fila)])),
  );
  return fotoCuerpos;
}

/**
 * Una nota con su cuerpo, o `undefined` si no existe o no está publicada.
 *
 * Consulta esa fila y solo esa. La versión anterior se traía las 198 para
 * quedarse con una, que es justo el derroche que esta capa viene a evitar.
 */
export async function getPost(slug: string, env?: Entorno): Promise<EntradaPostCompleta | undefined> {
  if (FOTO_DE_BUILD) return (await catalogoConCuerpos(env)).get(slug);

  const { url, key } = credenciales(env);

  const q = new URL(`${url}/rest/v1/posts`);
  q.searchParams.set('select', COLUMNAS_CON_CUERPO);
  q.searchParams.set('slug', `eq.${slug}`);
  q.searchParams.set('status', 'eq.published');
  q.searchParams.set('limit', '1');

  const res = await fetch(q.toString(), {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);

  const [fila]: FilaPost[] = await res.json();
  return fila ? filaAEntradaCompleta(fila) : undefined;
}
