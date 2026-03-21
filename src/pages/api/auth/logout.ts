import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
    try {
        console.log('API: Iniciando proceso de logout...');
        
        // Elimiñar la cookie de sesión
        cookies.delete("session", { path: "/" });
        
        console.log('API: Cookie eliminada, enviando respuesta...');
        
        return new Response(
            JSON.stringify({ success: true }), 
            { 
                status: 200, 
                headers: { 
                    'Content-Type': 'application/json'
                } 
            }
        );
    } catch (e) {
        console.error('Error en /api/auth/logout:', e);
        return new Response(
            JSON.stringify({ 
                success: false, 
                error: 'Error al cerrar sesión',
                details: e instanceof Error ? e.message : String(e)
            }), 
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
