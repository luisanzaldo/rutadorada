/**
 * Los títulos y descripciones de los posts se guardan en el frontmatter como
 * texto plano que admite énfasis Markdown en línea: *itálica*, **negrita** y
 * ***ambas***. El editor del panel admin genera esas marcas y aquí se traducen
 * a HTML para mostrarlas (renderRichText) o se limpian para los contextos que
 * exigen texto plano: <title>, meta tags, alt, RSS y el buscador
 * (stripRichText).
 */

const HTML_ESCAPES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

// El énfasis sólo abre delante de un carácter visible y sólo cierra detrás de
// otro, igual que en Markdown: así "3 * 4 * 5" no se convierte en itálica.
const EMPHASIS_RULES = [
    { pattern: /\*\*\*(?=\S)([^*]+)(?<=\S)\*\*\*/g, html: '<strong><em>$1</em></strong>' },
    { pattern: /\*\*(?=\S)([^*]+)(?<=\S)\*\*/g, html: '<strong>$1</strong>' },
    { pattern: /\*(?=\S)([^*]+)(?<=\S)\*/g, html: '<em>$1</em>' },
];

// Marcador temporal: un carácter de uso privado que no aparece en los textos.
const SENTINEL = String.fromCharCode(0xe000);
const SENTINEL_RE = new RegExp(`${SENTINEL}(\\d+)${SENTINEL}`, 'g');

/**
 * Aparta los caracteres escapados con backslash (\*, \[, \_ ...) que produce el
 * serializador Markdown, para que no se confundan con marcas de énfasis.
 */
function protectEscapes(value: string) {
    const literals: string[] = [];
    const text = value.replace(/\\([\s\S])/g, (_match, char: string) => {
        literals.push(char);
        return `${SENTINEL}${literals.length - 1}${SENTINEL}`;
    });
    return { text, literals };
}

function restoreEscapes(text: string, literals: string[], transform: (char: string) => string) {
    return text.replace(SENTINEL_RE, (_match, index: string) => transform(literals[Number(index)] ?? ''));
}

function applyEmphasis(text: string, asHtml: boolean) {
    let result = text;
    // Dos pasadas: la segunda resuelve el énfasis anidado, p. ej.
    // "**negrita con *itálica* dentro**".
    for (let pass = 0; pass < 2; pass++) {
        for (const rule of EMPHASIS_RULES) {
            result = result.replace(rule.pattern, asHtml ? rule.html : '$1');
        }
    }
    return result;
}

/**
 * Convierte el texto en HTML seguro: escapa todo el marcado del autor y sólo
 * deja pasar las etiquetas <strong> y <em> que generan las marcas de énfasis.
 */
export function renderRichText(value?: string | null): string {
    if (!value) return '';
    const { text, literals } = protectEscapes(String(value));
    const html = applyEmphasis(escapeHtml(text), true);
    return restoreEscapes(html, literals, escapeHtml);
}

/** Devuelve el texto sin marcas de énfasis, para contextos de texto plano. */
export function stripRichText(value?: string | null): string {
    if (!value) return '';
    const { text, literals } = protectEscapes(String(value));
    const plain = applyEmphasis(text, false);
    return restoreEscapes(plain, literals, (char) => char);
}
