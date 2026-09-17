import type { APIRoute } from "astro";
import { getSession } from "../../../../lib/auth";
import { fetchSheetValues, saveSnapshots, FESTIVAL_KEYS, type Cell, type FestivalKey } from "../../../../lib/cannes";

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
        // Se traen todos los festivales antes de escribir: si Google falla en uno,
        // la fila guardada se queda como estaba en vez de perder media tabla.
        const fetched = await Promise.all(
            FESTIVAL_KEYS.map(async (key) => [key, await fetchSheetValues(key)] as const)
        );
        const fresh = Object.fromEntries(fetched) as Record<FestivalKey, { headers: string[]; rows: Cell[][] }>;
        const snapshots = await saveSnapshots(fresh);
        return new Response(JSON.stringify({ ok: true, snapshots }), {
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
