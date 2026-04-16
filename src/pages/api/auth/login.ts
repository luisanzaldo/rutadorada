import type { APIRoute } from 'astro';
import { USERS } from '../../../lib/users';
import { createSession } from '../../../lib/auth';
import bcrypt from 'bcryptjs';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        // En Vercel, el header Content-Type debe ser application/json
        const contentType = request.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            return new Response(
                JSON.stringify({ success: false, error: 'Content-Type debe ser application/json' }), 
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const body = await request.json();
        const username = body.username;
        const password = body.password;

        if (!username || !password) {
            return new Response(
                JSON.stringify({ success: false, error: 'Por favor, completa todos los campos' }), 
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const user = USERS.find((u) => u.username === username);

        // Siempre ejecutar bcrypt.compare para normalizar el tiempo de respuesta
        // y evitar la enumeración de usuarios por timing o por código HTTP.
        const DUMMY_HASH = '$2b$10$abcdefghijklmnopqrstuuTGnQ1V7ND3ZcEL9JfGAlkNRJZFw2e3G';
        const hashToCompare = user ? user.passwordHash : DUMMY_HASH;
        const isPasswordCorrect = await bcrypt.compare(password, hashToCompare);

        if (user && isPasswordCorrect) {
            // Credenciales correctas: Crear sesión
            const token = await createSession(user.username);

            // Guardar en cookie
            cookies.set("session", token, {
                path: "/",
                httpOnly: true,
                secure: true,
                sameSite: "strict",
                maxAge: 60 * 60 * 24 * 7, // 7 días
            });

            return new Response(
                JSON.stringify({ success: true }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        } else {
            return new Response(
                JSON.stringify({ success: false, error: 'Credenciales incorrectas' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }
    } catch (e) {
        console.error('Error en /api/auth/login:', e);
        return new Response(
            JSON.stringify({ success: false, error: 'Ocurrió un error al procesar el inicio de sesión' }), 
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
