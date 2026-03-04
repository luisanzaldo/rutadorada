import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
    const posts = await getCollection('posts');

    return rss({
        title: 'Ruta Dorada Films',
        description: 'Conoce las últimas noticias del séptimo arte, críticas, análisis y más',
        site: context.site,
        items: posts
            .sort((a, b) => new Date(b.data.pubDate).valueOf() - new Date(a.data.pubDate).valueOf())
            .map((post) => {
                let imageUrl = '';
                if (post.data.image) {
                    imageUrl = post.data.image.startsWith('/')
                        ? new URL(post.data.image, context.site).toString()
                        : post.data.image;
                }

                return {
                    title: post.data.title,
                    description: post.data.description,
                    pubDate: post.data.pubDate,
                    link: `/posts/${post.slug}/`,
                    customData: imageUrl ? `<enclosure url="${imageUrl}" type="image/jpeg" />` : '',
                };
            }),
        customData: `<language>es</language>`,
    });
}
