import { Editor, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import Underline from '@tiptap/extension-underline';
import { Markdown } from 'tiptap-markdown';

// Extensión personalizada para el bloque de Curiosidad
const Curiosity = Node.create({
    name: 'curiosity',
    group: 'block',
    selectable: true,
    draggable: true,
    atom: true, // Se comporta como una unidad única
    parseHTML() {
        return [
            { tag: 'div[data-type="curiosity"]' },
            {
                tag: 'div',
                getAttrs: element => {
                    const classes = element.getAttribute('class') || '';
                    if (classes.includes('border-[#F2AF0D]') || element.querySelector('h4')?.innerText.includes('Curiosidades')) {
                        return {};
                    }
                    return false;
                }
            }
        ]
    },
    addAttributes() {
        return {
            title: {
                default: '',
                parseHTML: element => element.querySelector('h4')?.innerText || '',
            },
            content: {
                default: '',
                parseHTML: element => (element.querySelector('p')?.innerText || '').replace(/\r?\n|\r/g, " "),
            },
        }
    },
    renderHTML({ HTMLAttributes }) {
        const { title, content } = HTMLAttributes;
        return [
            'div',
            { 'data-type': 'curiosity', class: 'my-8 rounded-xl border border-[#F2AF0D]/20 bg-[#F2AF0D]/5 p-6 relative overflow-hidden' },
            ['div', { class: 'absolute top-0 left-0 h-full w-1 bg-[#F2AF0D]' }],
            ['div', { class: 'flex items-start gap-4' },
                ['div', { class: 'rounded-full bg-[#F2AF0D]/20 p-2 text-[#F2AF0D] shrink-0 flex items-center justify-center' },
                    ['span', { class: 'material-symbols-outlined text-sm' }, 'star']
                ],
                ['div', {},
                    ['h4', { class: 'text-lg font-bold text-slate-900 dark:text-white mb-1 uppercase font-display' }, title],
                    ['p', { class: 'text-slate-600 dark:text-slate-300 text-sm leading-relaxed' }, content]
                ]
            ]
        ];
    },
});

// Nodo para bloques de valoración (Bueno/Regular/Malo)
const Point = Node.create({
    name: 'point',
    group: 'block',
    selectable: true,
    draggable: true,
    atom: true,
    addAttributes() {
        return {
            type: {
                default: 'good',
                parseHTML: element => element.getAttribute('data-type')
            },
            title: {
                default: '',
                parseHTML: element => element.querySelector('h4')?.innerText || '',
            },
            content: {
                default: '',
                parseHTML: element => (element.querySelector('p')?.innerText || '').replace(/\r?\n|\r/g, " "),
            },
        };
    },
    parseHTML() {
        return [
            { tag: 'div[data-type="good"]', getAttrs: () => ({ type: 'good' }) },
            { tag: 'div[data-type="regular"]', getAttrs: () => ({ type: 'regular' }) },
            { tag: 'div[data-type="bad"]', getAttrs: () => ({ type: 'bad' }) },
            {
                tag: 'div',
                getAttrs: element => {
                    const text = element.querySelector('h4')?.innerText || '';
                    if (text.toLowerCase().includes('lo bueno')) return { type: 'good' };
                    if (text.toLowerCase().includes('lo regular')) return { type: 'regular' };
                    if (text.toLowerCase().includes('lo malo')) return { type: 'bad' };
                    return false;
                }
            }
        ]
    },
    renderHTML({ HTMLAttributes }) {
        const { type, title, content } = HTMLAttributes;
        const colors = {
            good: '#22c55e',
            regular: '#f97316',
            bad: '#ef4444'
        };
        const color = (colors as any)[type] || '#22c55e';

        return [
            'div',
            {
                'data-type': type,
                class: 'my-8 rounded-xl border p-6 relative overflow-hidden',
                style: `border-color: ${color}33; background-color: ${color}0D;` // 20% alpha border, 5% alpha bg
            },
            ['div', { class: 'absolute top-0 left-0 h-full w-1', style: `background-color: ${color}` }],
            ['div', { class: 'flex items-start gap-4' },
                ['div', { class: 'rounded-full p-2 shrink-0 flex items-center justify-center', style: `background-color: ${color}33` },
                    ['span', { class: 'material-symbols-outlined text-sm', style: `color: ${color} !important;` }, 'speed']
                ],
                ['div', {},
                    ['h4', { class: 'text-lg font-bold text-slate-900 dark:text-white mb-1 uppercase font-display' }, title],
                    ['p', { class: 'text-slate-600 dark:text-slate-300 text-sm leading-relaxed' }, content]
                ]
            ]
        ];
    },
});

export interface PostEditorOptions {
    /** Markdown inicial para pre-cargar el editor (modo edición). */
    initialMarkdown?: string;
}

/** Sombrea el botón de la toolbar cuando el cursor está sobre ese formato. */
function setBtnState(btn: Element | null | undefined, isActive: boolean) {
    if (!btn) return;
    if (isActive) btn.classList.add('tiptap-btn-active');
    else btn.classList.remove('tiptap-btn-active');
}

/**
 * Editor de una sola línea para el título y la descripción del post: sólo
 * admite negrita e itálica y guarda el resultado como Markdown en línea
 * (**negrita**, *itálica*) dentro del input oculto con ese mismo id, que es lo
 * que viaja al frontmatter. Espera el markup de RichTextInput.astro: el área
 * editable es #<id>-editor y el input oculto es #<id>.
 */
export function initInlineEditor(id: string): Editor | null {
    const editorElement = document.getElementById(`${id}-editor`);
    const valueInput = document.getElementById(id);
    if (!editorElement || !(valueInput instanceof HTMLInputElement)) return null;

    const element = editorElement;
    const input = valueInput;
    const field = element.closest('[data-rich-field]');
    const boldBtn = field?.querySelector('[data-rich-btn="bold"]');
    const italicBtn = field?.querySelector('[data-rich-btn="italic"]');

    const editor = new Editor({
        element,
        extensions: [
            // Sólo párrafo + negrita/itálica: nada de títulos, listas ni bloques.
            StarterKit.configure({
                blockquote: false,
                bulletList: false,
                code: false,
                codeBlock: false,
                hardBreak: false,
                heading: false,
                horizontalRule: false,
                link: false,
                listItem: false,
                listKeymap: false,
                orderedList: false,
                strike: false,
                underline: false,
                trailingNode: false,
            }),
            // html: true para que el valor inicial (ya convertido a HTML) entre
            // como negrita/itálica y no como texto literal.
            Markdown.configure({ html: true }),
        ],
        // El valor guardado llega ya convertido a HTML desde el servidor, así se
        // evita que Markdown interprete el texto del título como bloques.
        content: element.dataset.initialHtml || '',
        editorProps: {
            attributes: { class: 'focus:outline-none' },
            // Campo de una línea: Enter no debe partir el texto en párrafos.
            handleKeyDown: (_view, event) => event.key === 'Enter',
        },
        onUpdate: () => syncValue(),
        onSelectionUpdate: () => updateButtons(),
    });

    function syncValue() {
        const markdown = editor.storage.markdown.getMarkdown()
            // El campo se guarda en una sola línea del frontmatter.
            .replace(/\s*\n+\s*/g, ' ')
            // Markdown escapa caracteres que aquí no interpretamos (\[, \_, \`...);
            // el asterisco sí se conserva escapado porque marca el énfasis.
            .replace(/\\([^*])/g, '$1')
            // El serializador convierte < y > en entidades; el frontmatter
            // guarda el texto tal cual y ya se escapa al pintarlo.
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .trim();
        input.value = markdown;
        element.classList.toggle('is-empty', editor.isEmpty);
        updateButtons();
    }

    function updateButtons() {
        setBtnState(boldBtn, editor.isActive('bold'));
        setBtnState(italicBtn, editor.isActive('italic'));
    }

    boldBtn?.addEventListener('click', () => { editor.chain().focus().toggleBold().run() });
    italicBtn?.addEventListener('click', () => { editor.chain().focus().toggleItalic().run() });

    syncValue();

    return editor;
}

/**
 * Crea el editor Tiptap del panel admin y conecta la toolbar y los modales
 * (imagen, YouTube, curiosidad y puntos de valoración). Espera el markup de
 * EditorPanel.astro y EditorModals.astro en la página.
 * Devuelve la instancia del editor, o null si no existe #tiptap-editor.
 */
export function initPostEditor(options: PostEditorOptions = {}): Editor | null {
    const editorElement = document.getElementById('tiptap-editor');
    if (!editorElement) return null;

    const inputContent = document.getElementById('contentMarkdown') as HTMLInputElement | null;
    const fileExtInput = document.getElementById('fileExtension') as HTMLInputElement | null;

    // Referencias de Modales
    const modalImage = document.getElementById('modal-image');
    const modalYoutube = document.getElementById('modal-youtube');
    const modalCuriosity = document.getElementById('modal-curiosity');
    const modalPoint = document.getElementById('modal-point');
    const modalImageContent = document.getElementById('modal-image-content');
    const modalYoutubeContent = document.getElementById('modal-youtube-content');
    const modalCuriosityContent = document.getElementById('modal-curiosity-content');
    const modalPointContent = document.getElementById('modal-point-content');

    // Configuración dinámica modal puntos
    const pointModalTitle = document.getElementById('point-modal-title');
    const pointModalIcon = document.getElementById('point-modal-icon');
    const btnInsertPoint = document.getElementById('btn-insert-point');
    let currentPointType = 'good';

    // Referencias inmediatas a los botones
    const btns = {
        bold: document.querySelector('[data-tiptap-btn="bold"]'),
        italic: document.querySelector('[data-tiptap-btn="italic"]'),
        underline: document.querySelector('[data-tiptap-btn="underline"]'),
        h1: document.querySelector('[data-tiptap-btn="h1"]'),
        h2: document.querySelector('[data-tiptap-btn="h2"]'),
        h3: document.querySelector('[data-tiptap-btn="h3"]'),
    };

    const editor = new Editor({
        element: editorElement,
        extensions: [
            StarterKit.configure({
                hardBreak: false,
            }),
            Image.configure({
                inline: false,
            }),
            Youtube.configure({ inline: false }),
            Underline,
            Markdown.configure({
                html: true,
            }),
            Curiosity,
            Point
        ],
        content: '<p></p>',
        editorProps: {
            attributes: {
                class: 'focus:outline-none',
                'data-placeholder': 'Comienza a escribir la publicación aquí...'
            },
        },
        onUpdate: ({ editor }) => {
            // TipTap Markdown extrae el texto puro MD que usaremos después en colecciones
            const mdText = editor.storage.markdown.getMarkdown()
                .replace(/(!\[[^\]]*\]\([^)]*\))\n?(#{1,6} )/g, '$1\n\n$2');
            if (inputContent) inputContent.value = mdText;

            // Detectar si hay un iframe de youtube presente y forzar a que sea MDX!
            if (fileExtInput) {
                if (editor.getHTML().includes('<iframe') || mdText.includes('<iframe')) {
                    fileExtInput.value = '.mdx';
                } else {
                    fileExtInput.value = '.md';
                }
            }

            updateActiveButtons(editor);
        },
        onSelectionUpdate: ({ editor }) => {
            updateActiveButtons(editor);
        }
    });

    // Establecer contenido inicial (modo edición)
    if (options.initialMarkdown) {
        editor.commands.setContent(options.initialMarkdown);
        if (inputContent) inputContent.value = options.initialMarkdown;
    }

    // Registrar listeners para los botones de texto
    btns.bold?.addEventListener('click', () => { editor.chain().focus().toggleBold().run() });
    btns.italic?.addEventListener('click', () => { editor.chain().focus().toggleItalic().run() });
    btns.underline?.addEventListener('click', () => { editor.chain().focus().toggleUnderline().run() });
    btns.h1?.addEventListener('click', () => { editor.chain().focus().toggleHeading({ level: 1 }).run() });
    btns.h2?.addEventListener('click', () => { editor.chain().focus().toggleHeading({ level: 2 }).run() });
    btns.h3?.addEventListener('click', () => { editor.chain().focus().toggleHeading({ level: 3 }).run() });

    // Detecta y sombrea como activo el formato detectado por el cursor
    function updateActiveButtons(ed: any) {
        setBtnState(btns.bold, ed.isActive('bold'));
        setBtnState(btns.italic, ed.isActive('italic'));
        setBtnState(btns.underline, ed.isActive('underline'));
        setBtnState(btns.h1, ed.isActive('heading', { level: 1 }));
        setBtnState(btns.h2, ed.isActive('heading', { level: 2 }));
        setBtnState(btns.h3, ed.isActive('heading', { level: 3 }));
    }

    // --- Lógica Modales Media ---
    const openModal = (modal: HTMLElement | null, content: HTMLElement | null) => {
        modal?.classList.remove('hidden');
        setTimeout(() => content?.classList.remove('scale-95', 'opacity-0'), 10);
    };

    const closeModal = (modal: HTMLElement | null, content: HTMLElement | null) => {
        content?.classList.add('scale-95', 'opacity-0');
        setTimeout(() => modal?.classList.add('hidden'), 200);
    };

    // Los modales de media se reutilizan en cada inserción, así que hay que dejarlos
    // en blanco al abrirlos: si no, arrastran la URL/archivo de la inserción anterior.
    const resetImageModal = () => {
        const urlInput = document.getElementById('tiptap-img-url') as HTMLInputElement | null;
        const fileInput = document.getElementById('tiptap-img-file') as HTMLInputElement | null;
        if (urlInput) urlInput.value = '';
        if (fileInput) fileInput.value = '';
    };

    const resetYoutubeModal = () => {
        const urlInput = document.getElementById('tiptap-yt-url') as HTMLInputElement | null;
        if (urlInput) urlInput.value = '';
    };

    document.getElementById('btn-image-modal')?.addEventListener('click', () => {
        resetImageModal();
        openModal(modalImage, modalImageContent);
    });

    document.getElementById('btn-video-modal')?.addEventListener('click', () => {
        resetYoutubeModal();
        openModal(modalYoutube, modalYoutubeContent);
    });

    document.querySelectorAll('.btn-close-modal').forEach(btn => btn.addEventListener('click', () => {
        closeModal(modalImage, modalImageContent);
        closeModal(modalYoutube, modalYoutubeContent);
        closeModal(modalCuriosity, modalCuriosityContent);
        closeModal(modalPoint, modalPointContent);
    }));

    document.getElementById('btn-curiosity-modal')?.addEventListener('click', () => {
        openModal(modalCuriosity, modalCuriosityContent);
    });

    // Insertar Bloque de Curiosidad
    document.getElementById('btn-insert-curiosity')?.addEventListener('click', () => {
        const titleInput = document.getElementById('curiosity-title') as HTMLInputElement;
        const contentInput = document.getElementById('curiosity-content') as HTMLTextAreaElement;
        const title = titleInput?.value;
        const content = contentInput?.value;

        if (title && content) {
            const cleanContent = content.replace(/\r?\n|\r/g, " ");
            // HTML con data-type para que el editor lo reconozca como nodo Curiosity
            const html = `<div data-type="curiosity" class="my-8 rounded-xl border border-[#F2AF0D]/20 bg-[#F2AF0D]/5 p-6 relative overflow-hidden"><div class="absolute top-0 left-0 h-full w-1 bg-[#F2AF0D]"></div><div class="flex items-start gap-4"><div class="rounded-full bg-[#F2AF0D]/20 p-2 text-[#F2AF0D] shrink-0 flex items-center justify-center"><span class="material-symbols-outlined" style="font-size: 20px;">star</span></div><div><h4 class="text-lg font-bold text-slate-900 dark:text-white mb-1 uppercase font-display">${title}</h4><p class="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">${cleanContent}</p></div></div></div>`;

            editor.commands.insertContent(html);

            if (titleInput) titleInput.value = '';
            if (contentInput) contentInput.value = '';
            closeModal(modalCuriosity, modalCuriosityContent);
        } else {
            alert("Por favor llena ambos campos (Título y Contenido).");
        }
    });

    // Botones para abrir Modal Puntos
    const setupPointButton = (id: string, type: string, title: string, color: string) => {
        const btn = document.getElementById(id);
        btn?.addEventListener('click', () => {
            currentPointType = type;

            // Configurar título por defecto según el tipo
            const pointTitleInput = document.getElementById('point-title') as HTMLInputElement;
            if (pointTitleInput) {
                const defaultTitles: Record<string, string> = {
                    good: 'Lo bueno',
                    regular: 'Lo regular',
                    bad: 'Lo malo'
                };
                pointTitleInput.value = defaultTitles[type] || '';
            }

            if (pointModalTitle) {
                (pointModalTitle.querySelector('span') as HTMLElement).textContent = title;
            }
            if (pointModalIcon) {
                pointModalIcon.style.color = color;
            }
            if (btnInsertPoint) {
                btnInsertPoint.style.backgroundColor = color;
                btnInsertPoint.textContent = `Insertar punto ${type === 'good' ? 'positivo' : type === 'regular' ? 'regular' : 'negativo'}`;
            }

            openModal(modalPoint, modalPointContent);
        });
    };

    setupPointButton('btn-good-modal', 'good', 'Agregar punto positivo', '#22c55e');
    setupPointButton('btn-regular-modal', 'regular', 'Agregar punto regular', '#f97316');
    setupPointButton('btn-bad-modal', 'bad', 'Agregar punto negativo', '#ef4444');

    // Lógica de inserción de puntos
    btnInsertPoint?.addEventListener('click', () => {
        const titleInput = document.getElementById('point-title') as HTMLInputElement;
        const contentInput = document.getElementById('point-content') as HTMLTextAreaElement;
        const title = titleInput?.value;
        const content = contentInput?.value;

        if (title && content) {
            editor.commands.insertContent({
                type: 'point',
                attrs: {
                    type: currentPointType,
                    title,
                    content
                }
            });

            // Reset y cerrar
            if (titleInput) titleInput.value = '';
            if (contentInput) contentInput.value = '';
            closeModal(modalPoint, modalPointContent);
        } else {
            alert("Por favor llena ambos campos (Título y Contenido).");
        }
    });

    // Insertar Imagen desde UI (URL o subida de archivo local)
    document.getElementById('btn-insert-image')?.addEventListener('click', async () => {
        const urlInput = document.getElementById('tiptap-img-url') as HTMLInputElement;
        const fileInput = document.getElementById('tiptap-img-file') as HTMLInputElement;
        const insertBtn = document.getElementById('btn-insert-image') as HTMLButtonElement;
        const urlValue = urlInput?.value.trim();

        if (fileInput?.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            const originalLabel = insertBtn?.textContent || 'Insertar en el artículo';
            if (insertBtn) { insertBtn.disabled = true; insertBtn.textContent = 'Subiendo...'; }

            try {
                const uploadRes = await fetch('/api/posts/upload-image', {
                    method: 'POST',
                    headers: { 'Content-Type': file.type, 'x-filename': encodeURIComponent(file.name) },
                    body: file
                });
                const uploadData = await uploadRes.json();
                if (uploadRes.ok && uploadData.success) {
                    const imageSrc = uploadData.previewUrl || uploadData.url;
                    editor.chain().focus().setImage({ src: imageSrc }).run();
                    resetImageModal();
                    closeModal(modalImage, modalImageContent);
                } else {
                    alert(`No se pudo subir la imagen: ${uploadData.error || 'Error desconocido'}`);
                }
            } catch (e: any) {
                alert(`Error al subir la imagen: ${e.message}`);
            } finally {
                if (insertBtn) { insertBtn.disabled = false; insertBtn.textContent = originalLabel; }
            }
            return;
        }

        if (urlValue) {
            editor.chain().focus().setImage({ src: urlValue }).run();
            resetImageModal();
            closeModal(modalImage, modalImageContent);
        } else {
            alert("Por favor ingresa un enlace o selecciona un archivo para tu imagen.");
        }
    });

    // Insertar YouTube desde UI
    document.getElementById('btn-insert-youtube')?.addEventListener('click', () => {
        const urlInput = document.getElementById('tiptap-yt-url') as HTMLInputElement;
        const url = urlInput?.value;

        if (url) {
            editor.chain().focus().setYoutubeVideo({ src: url }).run();
            resetYoutubeModal();
            closeModal(modalYoutube, modalYoutubeContent);
        } else {
            alert("Agrega un enlace de YouTube válido.");
        }
    });

    return editor;
}
