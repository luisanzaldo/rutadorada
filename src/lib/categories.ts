// Slugs de las cuatro categorías con página propia. Deben coincidir con los
// params de getStaticPaths en src/pages/[categoria].astro.
const CATEGORY_SLUGS: Record<string, string> = {
    "Artículos": "articulos",
    "Críticas": "criticas",
    "Premios": "premios",
    "Tráilers": "trailers",
};

// Devuelve la URL de la sección de una categoría, o null si esa categoría no
// tiene página (así la etiqueta se muestra como texto y no como enlace roto).
export const getCategoryUrl = (category: string): string | null => {
    const slug = CATEGORY_SLUGS[category];
    if (!slug) return null;

    const base = import.meta.env.BASE_URL;
    return `${base === "/" ? "" : base}/${slug}`;
};
