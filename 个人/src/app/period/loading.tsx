export default function Loading() {
  return (
    <div className="container flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-soft border-t-accent" />
        <p className="text-sm text-text-muted">正在加载经期预测...</p>
      </div>
    </div>
  );
}
