// Tipos del esquema público de Supabase, escritos a mano a partir de
// `supabase_setup.sql`. Sin esto, `supabase.from(...)` infiere `never` y
// `supabase.rpc(...)` infiere `undefined` en sus argumentos.
//
// La forma imita la salida de `supabase gen types typescript`, así que el día
// que se generen automáticamente basta con reemplazar este archivo.
//
// Nota: `handle_user_deletion` no está en `supabase_setup.sql`; su firma está
// deducida de la única llamada que existe (src/pages/settings.astro).

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export type Database = {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string;
                    role: string;
                    created_at: string;
                };
                Insert: {
                    id: string;
                    role?: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    role?: string;
                    created_at?: string;
                };
                Relationships: [];
            };
            likes: {
                Row: {
                    id: number;
                    articulo_id: string;
                    user_id: string;
                    created_at: string;
                };
                Insert: {
                    id?: number;
                    articulo_id: string;
                    user_id: string;
                    created_at?: string;
                };
                Update: {
                    id?: number;
                    articulo_id?: string;
                    user_id?: string;
                    created_at?: string;
                };
                Relationships: [];
            };
            favoritos: {
                Row: {
                    id: number;
                    articulo_id: string;
                    user_id: string;
                    created_at: string;
                };
                Insert: {
                    id?: number;
                    articulo_id: string;
                    user_id: string;
                    created_at?: string;
                };
                Update: {
                    id?: number;
                    articulo_id?: string;
                    user_id?: string;
                    created_at?: string;
                };
                Relationships: [];
            };
            comentarios: {
                Row: {
                    id: number;
                    articulo_id: string;
                    user_id: string | null;
                    author_name: string | null;
                    contenido: string;
                    created_at: string;
                };
                Insert: {
                    id?: number;
                    articulo_id: string;
                    user_id?: string | null;
                    author_name?: string | null;
                    contenido: string;
                    created_at?: string;
                };
                Update: {
                    id?: number;
                    articulo_id?: string;
                    user_id?: string | null;
                    author_name?: string | null;
                    contenido?: string;
                    created_at?: string;
                };
                Relationships: [];
            };
        };
        Views: Record<never, never>;
        Functions: {
            get_bookmark_count: {
                Args: { p_articulo_id: string };
                Returns: number;
            };
            handle_user_deletion: {
                Args: { p_user_id: string };
                Returns: undefined;
            };
        };
        Enums: Record<never, never>;
        CompositeTypes: Record<never, never>;
    };
};
