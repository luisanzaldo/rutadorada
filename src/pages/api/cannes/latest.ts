import type { APIRoute } from "astro";
import { getSnapshot } from "../../../lib/cannes";

export const prerender = false;

export const GET: APIRoute = async () => {
    try {
        const snapshot = await getSnapshot();
        return new Response(JSON.stringify({ ok: true, snapshot }), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=60, s-maxage=60",
            },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Error desconocido.";
        return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};
