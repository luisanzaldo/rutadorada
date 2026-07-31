// `tiptap-markdown` registra su storage en runtime, pero no amplía la interfaz
// `Storage` de Tiptap 3 (que se declara vacía a propósito para este merge). Sin
// esto, `editor.storage.markdown` no existe para TypeScript.
import type { MarkdownStorage } from 'tiptap-markdown';

declare module '@tiptap/core' {
    interface Storage {
        markdown: MarkdownStorage;
    }
}
