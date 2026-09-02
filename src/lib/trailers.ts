// Los tráilers se ven en una ventana modal sobre la página, no en YouTube. Para
// poder compartir esa vista, la ventana tiene URL propia: la del post del tráiler
// con el parámetro `trailer`. Al abrir ese link, la página del post carga con la
// ventana del tráiler ya desplegada sobre el fondo difuminado.
export const TRAILER_PARAM = "trailer";

// URL compartible de un tráiler: /posts/<slug>?trailer=1
export const getTrailerUrl = (slug: string): string => {
    const base = import.meta.env.BASE_URL;
    return `${base === "/" ? "" : base}/posts/${slug}?${TRAILER_PARAM}=1`;
};
