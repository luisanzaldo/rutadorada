import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ cookies }) => {
    try {
        cookies.delete("session", { path: "/" });
        
        return new Response(
            JSON.stringify({ success: true }), 
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (e) {
        console.error('Error en /api/auth/logout:', e);
        return new Response(
            JSON.stringify({ success: false, error: 'Error al cerrar sesión' }), 
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
