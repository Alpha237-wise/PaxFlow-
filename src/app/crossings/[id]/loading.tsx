// Shown during the ~1-2s server round-trip Next.js needs before a
// navigation to this dynamic route (e.g. tapping "Next Crossing") becomes
// visible — this route has no generateStaticParams (crossing ids are
// per-user runtime data, nothing to prerender), so without this file the
// screen shows nothing at all for that whole window, which reads as the
// app being stuck rather than just working (see the docs at
// node_modules/next/dist/docs/01-app/01-getting-started/
// 04-linking-and-navigating.md's "Dynamic routes without loading.tsx").
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-8 dark:bg-black">
      <div className="w-full max-w-sm space-y-4 md:max-w-2xl">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
      </div>
    </div>
  );
}
