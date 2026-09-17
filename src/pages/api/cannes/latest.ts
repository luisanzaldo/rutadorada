import type { APIRoute } from "astro";
import { getSnapshot, isFestivalKey } from "../../../lib/cannes";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
    const requested = url.searchParams.get("festival");
    // Sin parámetro responde Cannes: era la única tabla cuando nació el endpoint.
    const festival = isFestivalKey(requested) ? requested : "cannes";

    try {
        const snapshot = await getSnapshot(festival);
        return new Response(JSON.stringify({ ok: true, festival, snapshot }), {
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
