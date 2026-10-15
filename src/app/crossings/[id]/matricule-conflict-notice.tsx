// One-tap confirmation shown when the AB saves a passenger whose matricule is
// already remembered (on this device) under a different name: saving would
// replace that remembered name. Lightweight on purpose — a small inline bar
// in place of the Save row, resolved with a single tap either way:
//  - Confirmer: the new name replaces the old one and the passenger is saved.
//  - Annuler: nothing is saved, the old name stays tied to that matricule, and
//    the AB is back in the form to fix the matricule they just typed (or carry
//    on with a different one).
export function MatriculeConflictNotice({
  oldName,
  newName,
  onConfirm,
  onCancel,
}: {
  oldName: string;
  newName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
    >
      <p>
        Ce matricule est déjà associé à <strong>{oldName}</strong> — remplacer par{" "}
        <strong>{newName}</strong> ?
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
        >
          Confirmer
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
