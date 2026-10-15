import type { LocalKnownPerson } from "@/lib/db/schema";
import { classifyPassenger } from "@/lib/classification";

// Disambiguation strip for homonyms (several remembered people sharing a
// name, TM and/or CC mixed): a horizontally scrollable row of cards — name,
// matricule, department/company, TM/CC — instead of a dropdown list, with an
// "Annuler" button pinned at the right edge of the strip so it stays
// reachable however far the AB has scrolled. Presentational only: the
// caller decides what picking a card / cancelling does.
export function KnownPersonStrip({
  title = "Several people share this name — pick one",
  people,
  onSelect,
  onCancel,
}: {
  title?: string;
  people: LocalKnownPerson[];
  onSelect: (person: LocalKnownPerson) => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-2">
      <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
        {title}
      </p>
      <div
        role="group"
        aria-label="Known people with the same name"
        className="flex snap-x gap-2 overflow-x-auto pb-1"
      >
        {people.map((person) => {
          const classification = classifyPassenger({
            companyIdNumber: person.company_id_number,
            companyName: person.company_name,
          });
          const where = [person.department, person.company_name]
            .filter(Boolean)
            .join(" / ");
          return (
            <button
              key={person.id}
              type="button"
              // onMouseDown, like the plain suggestion list: fires before the
              // name input's blur, and a touch-scroll of the strip never
              // synthesises it (only a real tap does).
              onMouseDown={() => onSelect(person)}
              className="w-44 shrink-0 snap-start rounded-lg border border-zinc-300 bg-white p-2 text-left dark:border-zinc-700 dark:bg-zinc-800"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {person.name}
                </span>
                <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                  {classification}
                </span>
              </span>
              <span className="mt-0.5 block text-xs text-zinc-600 dark:text-zinc-300">
                {person.company_id_number ? `ID ${person.company_id_number}` : "No ID"}
              </span>
              <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                {where || "—"}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onMouseDown={onCancel}
          className="sticky right-0 shrink-0 self-stretch rounded-lg border border-red-300 bg-white px-3 text-sm font-medium text-red-700 shadow-[-8px_0_8px_-4px_rgba(0,0,0,0.12)] dark:border-red-900 dark:bg-zinc-900 dark:text-red-400"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
