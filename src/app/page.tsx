export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-zinc-50 px-6 text-center dark:bg-black">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        PaxFlow
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Auth et écran de choix du BIRD à venir (§21, étapes 2 et 5).
      </p>
    </div>
  );
}
