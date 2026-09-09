import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        description: z.string(),
        pubDate: z.date(),
        author: z.string(),
        rating: z.number().min(0).max(100).optional(),
        letterboxd: z.string().url().or(z.literal("")).optional(),
        authorImage: z.string().optional(),
        image: z.string(),
        // Procedencia de la portada cuando venía de un medio ajeno. Se guarda al
        // migrarla a R2, porque a partir de ahí la URL ya no delata su origen.
        imageSource: z.string().optional(),
        category: z.string(),
        readTime: z.string(),
        featured: z.boolean().default(false),
        tags: z.array(z.string()).default([]),
        videoUrl: z.string().optional(),
        fichaTecnica: z.object({
            sinopsis: z.string(),
            director: z.string(),
            cast: z.string(),
            duracion: z.string(),
        }).optional(),
        fuente: z.object({
            nombre: z.string(),
            url: z.string()
        }).optional(),
    }),
});

export const collections = {
    'posts': posts,
};
