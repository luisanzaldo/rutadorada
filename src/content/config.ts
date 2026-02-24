import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        description: z.string(),
        pubDate: z.date(),
        author: z.string(),
        authorImage: z.string().optional(),
        image: z.string(),
        category: z.string(),
        subCategory: z.string().optional(),
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
    }),
});

export const collections = {
    'posts': posts,
};
