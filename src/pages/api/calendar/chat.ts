import type { APIRoute } from "astro";
import { getSession } from "../../../lib/auth";

export const prerender = false;

type ChatMessage = {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
    }>;
    tool_call_id?: string;
    name?: string;
};

type ClientMessage = { role: "user" | "assistant"; content: string };

const VALID_CATEGORIES = ["Actividad", "Tarea", "Contenido"] as const;
type Category = (typeof VALID_CATEGORIES)[number];

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const NOTION_PAGES_URL = "https://api.notion.com/v1/pages";
const NOTION_VERSION = "2025-09-03";

const addEventTool = {
    type: "function" as const,
    function: {
        name: "add_calendar_event",
        description:
            "Agrega un evento al calendario de Notion. Úsala cuando el usuario te pida añadir, programar o registrar un evento, actividad o contenido en una fecha específica. SOLO se llena UNA categoría por evento.",
        parameters: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description: "Título del evento (ej. 'La Odisea', 'Reunión con productora').",
                },
                date: {
                    type: "string",
                    description:
                        "Fecha del evento en formato ISO YYYY-MM-DD. Resuelve fechas relativas como 'mañana', 'próximo viernes', 'el 7 de mayo' usando la fecha de hoy proporcionada en el system prompt.",
                },
                category: {
                    type: "string",
                    enum: VALID_CATEGORIES as unknown as string[],
                    description:
                        "La columna Select de Notion donde se va a guardar el valor. Debe ser exactamente una de: Actividad (estrenos, premieres, festivales), Tarea (reuniones, entregables, hitos internos), Contenido (videos, posts, artículos publicados).",
                },
                value: {
                    type: "string",
                    description:
                        "Valor concreto dentro de la categoría elegida (ej. 'Estrenos' para Actividad, 'Video' para Contenido). Puede ser una opción nueva si el usuario menciona algo que no existe.",
                },
            },
            required: ["name", "date", "category", "value"],
        },
    },
};

const findEventsTool = {
    type: "function" as const,
    function: {
        name: "find_calendar_event",
        description:
            "Busca eventos existentes en el calendario por título y/o fecha. Devuelve hasta 10 coincidencias con su page_id, título, fecha y categoría. Úsala SIEMPRE antes de borrar para localizar el evento exacto y mostrárselo al usuario.",
        parameters: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description: "Texto a buscar dentro del título (búsqueda parcial, no estricta).",
                },
                date: {
                    type: "string",
                    description: "Fecha exacta en formato ISO YYYY-MM-DD para filtrar (opcional).",
                },
            },
        },
    },
};

const deleteEventTool = {
    type: "function" as const,
    function: {
        name: "delete_calendar_event",
        description:
            "Manda un evento a la papelera de Notion. SOLO úsala DESPUÉS de que el usuario haya confirmado explícitamente con un 'sí', 'confirmo', 'adelante', 'bórralo', etc. NUNCA borres en el mismo turno en el que el usuario pidió borrar: primero busca con find_calendar_event, muéstrale los matches al usuario, y espera confirmación.",
        parameters: {
            type: "object",
            properties: {
                page_id: {
                    type: "string",
                    description: "ID de la página devuelto por find_calendar_event.",
                },
            },
            required: ["page_id"],
        },
    },
};

function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}

function todayHuman(): string {
    return new Date().toLocaleDateString("es-MX", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

function buildSystemPrompt(): string {
    return [
        "Eres un asistente que ayuda al equipo de RutaDorada Films a gestionar su calendario de Notion (agregar, consultar y borrar eventos).",
        `Hoy es ${todayHuman()} (ISO: ${todayISO()}). Usa esta fecha para resolver expresiones relativas como "mañana", "próximo viernes", "en dos semanas".`,
        "El calendario tiene tres categorías mutuamente excluyentes (cada evento usa SOLO UNA):",
        "- 'Actividad': estrenos, premieres, festivales, conferencias, lanzamientos públicos.",
        "- 'Tarea': reuniones internas, entregables, hitos de producción, deadlines.",
        "- 'Contenido': piezas que ya se publicaron (Video, Post, Artículo, Reel, etc.).",
        "",
        "REGLAS PARA AGREGAR (add_calendar_event):",
        "- Llama la herramienta con name, date (YYYY-MM-DD), category y value.",
        "- Si falta información esencial, pregúntala antes. No inventes datos.",
        "- Si el value no existe, úsalo igual: el sistema crea opciones nuevas.",
        "",
        "REGLAS PARA BORRAR — flujo obligatorio en DOS turnos:",
        "1. Cuando el usuario pida borrar un evento, llama find_calendar_event con el título y/o fecha. NO llames delete_calendar_event todavía.",
        "2. Muestra los matches al usuario (título, fecha, categoría) y pide confirmación EXPLÍCITA: '¿Confirmas que quiero borrar X del Y?'.",
        "3. Si hay 0 matches: dile que no encontraste nada y termina ahí.",
        "4. Si hay varios matches: lístalos numerados y pídele que aclare cuál.",
        "5. SOLO cuando el usuario responda con un 'sí' explícito (o equivalente: 'confirmo', 'adelante', 'bórralo'), llama delete_calendar_event con el page_id correspondiente.",
        "6. Si el usuario dice 'no' o cualquier cosa que no sea confirmación clara, NO borres y termina la operación.",
        "",
        "Responde siempre en español, breve y directo. Confirma el resultado después de cada acción.",
    ].join("\n");
}

function isValidISODate(s: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + "T00:00:00");
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function getNotionConfig(): { ok: true; token: string; dataSourceId: string } | { ok: false; error: string } {
    const token = import.meta.env.NOTION_TOKEN;
    const dataSourceId = import.meta.env.NOTION_CALENDAR_DATA_SOURCE_ID;
    const missing: string[] = [];
    if (!token) missing.push("NOTION_TOKEN");
    if (!dataSourceId) missing.push("NOTION_CALENDAR_DATA_SOURCE_ID");
    if (missing.length > 0) {
        return { ok: false, error: `Faltan env vars en el servidor: ${missing.join(", ")}.` };
    }
    return { ok: true, token, dataSourceId };
}

function notionHeaders(token: string): Record<string, string> {
    return {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    };
}

async function createNotionEvent(args: {
    name: string;
    date: string;
    category: Category;
    value: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
    const cfg = getNotionConfig();
    if (!cfg.ok) return cfg;

    const properties: Record<string, unknown> = {
        Name: { title: [{ text: { content: args.name } }] },
        Date: { date: { start: args.date } },
        [args.category]: { select: { name: args.value } },
    };

    const res = await fetch(NOTION_PAGES_URL, {
        method: "POST",
        headers: notionHeaders(cfg.token),
        body: JSON.stringify({
            parent: { type: "data_source_id", data_source_id: cfg.dataSourceId },
            properties,
        }),
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: `Notion: ${data?.message || `HTTP ${res.status}`}` };
    }
    return { ok: true };
}

type FoundEvent = {
    page_id: string;
    name: string;
    date: string | null;
    category: Category | null;
    value: string | null;
};

async function findNotionEvents(args: {
    name?: string;
    date?: string;
}): Promise<{ ok: true; events: FoundEvent[] } | { ok: false; error: string }> {
    const cfg = getNotionConfig();
    if (!cfg.ok) return cfg;

    const filters: unknown[] = [];
    if (args.name && args.name.trim()) {
        filters.push({ property: "Name", title: { contains: args.name.trim() } });
    }
    if (args.date && isValidISODate(args.date)) {
        filters.push({ property: "Date", date: { equals: args.date } });
    }

    const body: Record<string, unknown> = { page_size: 10 };
    if (filters.length === 1) {
        body.filter = filters[0];
    } else if (filters.length > 1) {
        body.filter = { and: filters };
    }

    const url = `https://api.notion.com/v1/data_sources/${cfg.dataSourceId}/query`;
    const res = await fetch(url, {
        method: "POST",
        headers: notionHeaders(cfg.token),
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: `Notion: ${data?.message || `HTTP ${res.status}`}` };
    }

    const data = await res.json();
    const results: any[] = Array.isArray(data?.results) ? data.results : [];

    const events: FoundEvent[] = results.map((r) => {
        const props = r?.properties || {};
        const titleArr = props?.Name?.title;
        const name = Array.isArray(titleArr) && titleArr.length > 0
            ? titleArr.map((t: any) => t?.plain_text || "").join("")
            : "(sin título)";
        const date = props?.Date?.date?.start || null;

        let category: Category | null = null;
        let value: string | null = null;
        for (const cat of VALID_CATEGORIES) {
            const sel = props?.[cat]?.select;
            if (sel?.name) {
                category = cat;
                value = sel.name;
                break;
            }
        }

        return { page_id: r.id, name, date, category, value };
    });

    return { ok: true, events };
}

async function deleteNotionEvent(pageId: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const cfg = getNotionConfig();
    if (!cfg.ok) return cfg;

    const res = await fetch(`${NOTION_PAGES_URL}/${pageId}`, {
        method: "PATCH",
        headers: notionHeaders(cfg.token),
        body: JSON.stringify({ in_trash: true }),
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: `Notion: ${data?.message || `HTTP ${res.status}`}` };
    }
    return { ok: true };
}

async function callGroq(messages: ChatMessage[]): Promise<{
    ok: true;
    message: ChatMessage;
} | { ok: false; error: string }> {
    const GROQ_API_KEY = import.meta.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
        return { ok: false, error: "GROQ_API_KEY no está configurada en el servidor." };
    }

    const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: GROQ_MODEL,
            messages,
            tools: [addEventTool, findEventsTool, deleteEventTool],
            tool_choice: "auto",
            temperature: 0.2,
        }),
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const baseMsg = data?.error?.message || `HTTP ${res.status}`;
        const failed = data?.error?.failed_generation;
        const detail = failed ? ` | failed_generation: ${String(failed).slice(0, 500)}` : "";
        console.error("Groq error:", JSON.stringify(data).slice(0, 1500));
        return { ok: false, error: `Groq: ${baseMsg}${detail}` };
    }

    const data = await res.json();
    const choice = data?.choices?.[0]?.message;
    if (!choice) return { ok: false, error: "Respuesta inválida del modelo." };
    return { ok: true, message: choice as ChatMessage };
}

function toolError(callId: string, name: string, error: string): ChatMessage {
    return {
        role: "tool",
        tool_call_id: callId,
        name,
        content: JSON.stringify({ ok: false, error }),
    };
}

function toolSuccess(callId: string, name: string, payload: Record<string, unknown>): ChatMessage {
    return {
        role: "tool",
        tool_call_id: callId,
        name,
        content: JSON.stringify({ ok: true, ...payload }),
    };
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const session = await getSession(request);
        if (!session) {
            return new Response(JSON.stringify({ ok: false, error: "No autorizado" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        const body = await request.json().catch(() => null) as { messages?: ClientMessage[] } | null;
        const clientMessages = body?.messages;
        if (!Array.isArray(clientMessages) || clientMessages.length === 0) {
            return new Response(JSON.stringify({ ok: false, error: "Faltan mensajes" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const MAX_HISTORY = 20;
        const trimmed = clientMessages.slice(-MAX_HISTORY).map((m) => ({
            role: m.role,
            content: String(m.content || "").slice(0, 4000),
        }));

        const messages: ChatMessage[] = [
            { role: "system", content: buildSystemPrompt() },
            ...trimmed,
        ];

        const created: Array<{ name: string; date: string; category: Category; value: string }> = [];
        const deleted: Array<{ page_id: string }> = [];
        const MAX_TOOL_HOPS = 4;

        for (let hop = 0; hop < MAX_TOOL_HOPS; hop++) {
            const groqRes = await callGroq(messages);
            if (!groqRes.ok) {
                return new Response(JSON.stringify({ ok: false, error: groqRes.error }), {
                    status: 502,
                    headers: { "Content-Type": "application/json" },
                });
            }

            const reply = groqRes.message;
            messages.push(reply);

            const toolCalls = reply.tool_calls ?? [];
            if (toolCalls.length === 0) {
                return new Response(
                    JSON.stringify({ ok: true, reply: reply.content || "", created, deleted }),
                    { status: 200, headers: { "Content-Type": "application/json" } },
                );
            }

            for (const call of toolCalls) {
                const fnName = call.function?.name;
                let parsed: Record<string, any>;
                try {
                    parsed = JSON.parse(call.function?.arguments || "{}");
                } catch {
                    messages.push(toolError(call.id, fnName || "unknown", "Argumentos JSON inválidos"));
                    continue;
                }

                if (fnName === "add_calendar_event") {
                    const name = String(parsed.name || "").trim();
                    const date = String(parsed.date || "").trim();
                    const category = String(parsed.category || "").trim();
                    const value = String(parsed.value || "").trim();

                    if (!name || !date || !category || !value) {
                        messages.push(toolError(call.id, fnName, "Faltan campos requeridos (name, date, category, value)"));
                        continue;
                    }
                    if (!isValidISODate(date)) {
                        messages.push(toolError(call.id, fnName, `Fecha inválida: ${date}. Debe ser YYYY-MM-DD.`));
                        continue;
                    }
                    if (!VALID_CATEGORIES.includes(category as Category)) {
                        messages.push(toolError(call.id, fnName, `Categoría inválida: ${category}.`));
                        continue;
                    }

                    const r = await createNotionEvent({ name, date, category: category as Category, value });
                    if (r.ok) {
                        created.push({ name, date, category: category as Category, value });
                        messages.push(toolSuccess(call.id, fnName, { name, date, category, value }));
                    } else {
                        messages.push(toolError(call.id, fnName, r.error));
                    }
                } else if (fnName === "find_calendar_event") {
                    const name = parsed.name ? String(parsed.name).trim() : undefined;
                    const date = parsed.date ? String(parsed.date).trim() : undefined;

                    if (!name && !date) {
                        messages.push(toolError(call.id, fnName, "Debes proporcionar al menos name o date."));
                        continue;
                    }
                    if (date && !isValidISODate(date)) {
                        messages.push(toolError(call.id, fnName, `Fecha inválida: ${date}. Debe ser YYYY-MM-DD.`));
                        continue;
                    }

                    const r = await findNotionEvents({ name, date });
                    if (r.ok) {
                        messages.push(toolSuccess(call.id, fnName, { events: r.events, count: r.events.length }));
                    } else {
                        messages.push(toolError(call.id, fnName, r.error));
                    }
                } else if (fnName === "delete_calendar_event") {
                    const pageId = String(parsed.page_id || "").trim();
                    if (!pageId) {
                        messages.push(toolError(call.id, fnName, "Falta page_id."));
                        continue;
                    }

                    const r = await deleteNotionEvent(pageId);
                    if (r.ok) {
                        deleted.push({ page_id: pageId });
                        messages.push(toolSuccess(call.id, fnName, { page_id: pageId }));
                    } else {
                        messages.push(toolError(call.id, fnName, r.error));
                    }
                } else {
                    messages.push(toolError(call.id, fnName || "unknown", "Herramienta desconocida"));
                }
            }
        }

        return new Response(
            JSON.stringify({
                ok: true,
                reply: "Se alcanzó el límite de operaciones por turno. Intenta de nuevo.",
                created,
                deleted,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
        );
    } catch (error: any) {
        console.error("Error en /api/calendar/chat:", error);
        return new Response(
            JSON.stringify({ ok: false, error: error?.message || "Error interno del servidor" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        );
    }
};
