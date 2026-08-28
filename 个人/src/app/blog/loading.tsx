export default function BlogLoading() {
  return (
    <div className="container flex min-h-screen flex-col py-6 md:py-10">
      <div className="flex flex-1 animate-pulse flex-col gap-4">
        <div className="h-8 w-28 rounded-lg bg-surface" />
        <div className="h-4 w-44 rounded bg-surface" />
        <div className="mt-2 h-28 rounded-xl bg-surface" />
        <div className="h-28 rounded-xl bg-surface" />
        <div className="h-28 rounded-xl bg-surface" />
      </div>
    </div>
  );
}
