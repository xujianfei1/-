/**
 * GET /blog/feed.xml - RSS 2.0 订阅源 (公开, 已发布文章前 50 篇)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getPublishedPosts } from '@/server/posts';

export const dynamic = 'force-dynamic';

/** XML 特殊字符转义 */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(req: NextRequest) {
  try {
    const site = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const posts = (await getPublishedPosts()).slice(0, 50);

    const items = posts
      .map((p) => {
        const url = `${site}/blog/${p.slug}`;
        const desc = p.summary || '';
        const date = new Date(p.publishedAt ?? p.updatedAt).toUTCString();
        const tags = p.tags ? p.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
        const category = tags.map((t) => `<category>${esc(t)}</category>`).join('');
        return `    <item>
      <title>${esc(p.title)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>
      <pubDate>${date}</pubDate>
      <description>${esc(desc)}</description>
      ${category}
    </item>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc('博客 - 个人门户')}</title>
    <link>${esc(`${site}/blog`)}</link>
    <description>${esc('技术文章和思考分享')}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${esc(`${site}/blog/feed.xml`)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=600',
      },
    });
  } catch (err) {
    console.error('GET /blog/feed.xml failed:', err);
    return NextResponse.json({ error: '生成订阅源失败' }, { status: 500 });
  }
}
