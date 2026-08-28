'use client';

/**
 * 博客正文 Markdown 渲染
 * - react-markdown 默认不渲染原始 HTML, 无 XSS 注入面
 * - remark-gfm: 表格 / 任务列表 / 删除线 / 自动链接
 * - rehype-highlight: 代码块高亮 (token 配色见 globals.css, 跟随主题)
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

export function Markdown({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert md:prose-base max-w-none prose-headings:font-semibold prose-a:text-accent prose-code:rounded prose-code:bg-surface prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none prose-pre:border prose-pre:border-border/40 prose-pre:bg-surface prose-img:rounded-xl">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
