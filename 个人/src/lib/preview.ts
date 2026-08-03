/**
 * 判断文件是否可在线预览
 *
 * 现阶段支持: 图片 (image/*) + PDF. 后续可加 video/audio/text.
 */

export type PreviewKind = 'image' | 'pdf' | null;

const IMAGE_RE = /^image\/(jpeg|png|gif|webp|svg\+xml|bmp|ico|avif)$/i;
const PDF_MIME = 'application/pdf';

export function getPreviewKind(mime: string | null, name: string): PreviewKind {
  if (!mime) return null;
  if (IMAGE_RE.test(mime)) return 'image';
  if (mime === PDF_MIME) return 'pdf';
  // 兜底: 扩展名判断
  if (/\.(jpe?g|png|gif|webp|svg|bmp|avif)$/i.test(name)) return 'image';
  if (/\.pdf$/i.test(name)) return 'pdf';
  return null;
}

export function isPreviewable(mime: string | null, name: string): boolean {
  return getPreviewKind(mime, name) !== null;
}
