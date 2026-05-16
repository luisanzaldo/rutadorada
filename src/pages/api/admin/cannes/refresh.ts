import type { APIRoute } from "astro";
import { getSession } from "../../../../lib/auth";
import { fetchSheetValues, saveSnapshot } from "../../../../lib/cannes";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    const session = await getSession(request);
    if (!session) {
        return new Response(JSON.stringify({ ok: false, error: "No autorizado." }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const sheetData = await fetchSheetValues();
        const snapshot = await saveSnapshot(sheetData);
        return new Response(JSON.stringify({ ok: true, snapshot }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Error desconocido.";
        return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};
