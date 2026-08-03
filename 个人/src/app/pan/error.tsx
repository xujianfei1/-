'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container py-10">
      <h2 className="text-lg font-semibold">加载失败</h2>
      <p className="mt-2 text-sm text-text-muted">{error.message}</p>
      <button
        onClick={reset}
        className="mt-4 rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent-soft"
      >
        重试
      </button>
    </div>
  );
}
