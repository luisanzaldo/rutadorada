// Convierte una etiqueta en un slug apto para URL: "San Sebastián" -> "san-sebastian"
export const slugifyTag = (tag: string): string =>
    tag
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

export const getTagUrl = (tag: string): string => {
    const base = import.meta.env.BASE_URL;
    return `${base === "/" ? "" : base}/etiquetas/${slugifyTag(tag)}`;
};
