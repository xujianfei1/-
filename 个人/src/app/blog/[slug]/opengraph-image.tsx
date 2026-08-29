/**
 * 每篇博客的电影感 OG 分享图 (1200x630)
 * 微信 / Twitter / IM 链接预览自动取用; 与详情页剧照同一套确定性调色
 */
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getPublishedPostBySlug } from '@/server/posts';
import { cinemaPaletteFor } from '@/lib/cinema';

export const runtime = 'nodejs';
export const alt = '文章封面';
export const size = { width: 1200, height: 630 };

let fontCache: Buffer | null = null;
async function getFont() {
  if (!fontCache) {
    fontCache = await readFile(path.join(process.cwd(), 'public', 'fonts', 'NotoSansSC-Regular.otf'));
  }
  return fontCache;
}

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  const title = post?.title ?? '博客';
  const p = cinemaPaletteFor(slug);
  const date = post ? new Date(post.publishedAt ?? post.updatedAt).toLocaleDateString('zh-CN') : '';
  const font = await getFont();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#000',
        }}
      >
        {/* 剧照区 */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 96px',
            background: `linear-gradient(118deg, ${p.from}, ${p.to})`,
            position: 'relative',
          }}
        >
          {/* 片场光斑 */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              background: `radial-gradient(ellipse 55% 75% at 70% 20%, ${p.glow}, transparent 62%)`,
              opacity: 0.35,
            }}
          />
          {/* 暗角 */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              background: `radial-gradient(ellipse 90% 90% at 50% 50%, transparent 55%, rgba(0,0,0,0.5) 100%)`,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 30 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                transform: 'rotate(45deg)',
                background: 'linear-gradient(135deg, #d97706, #fbbf24)',
                display: 'flex',
              }}
            />
            <div style={{ color: p.ink, fontSize: 27, opacity: 0.9, display: 'flex' }}>
              个人门户 · 博客
            </div>
          </div>
          <div
            style={{
              color: p.ink,
              fontSize: title.length > 16 ? 60 : 76,
              fontWeight: 700,
              lineHeight: 1.28,
              maxWidth: 1010,
              display: 'flex',
              flexWrap: 'wrap',
              textShadow: '0 2px 12px rgba(0,0,0,0.45)',
            }}
          >
            {title}
          </div>
        </div>
        {/* 遮幅底条 */}
        <div
          style={{
            height: 46,
            background: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 96px',
          }}
        >
          <div style={{ color: p.ink, fontSize: 22, opacity: 0.7, display: 'flex' }}>{date}</div>
          <div style={{ color: p.ink, fontSize: 22, opacity: 0.7, display: 'flex' }}>xujianfei.cn/blog</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'NotoSansSC', data: font, weight: 400, style: 'normal' },
        { name: 'NotoSansSC', data: font, weight: 700, style: 'normal' },
      ],
    },
  );
}
