"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import type { LocalKnownPerson } from "@/lib/db/schema";
import {
  findMatriculeConflict,
  hasHomonyms,
  rememberPerson,
  searchKnownPeople,
  searchKnownPeopleByCompanyId,
} from "@/lib/known-people";
import {
  resolveClassification,
  type Classification,
} from "@/lib/classification";
import { KnownPersonStrip } from "./known-person-strip";
import { MatriculeConflictNotice } from "./matricule-conflict-notice";

const EMPTY_FORM = {
  name: "",
  companyIdNumber: "",
  department: "",
  companyName: "",
};

export function PassengerSheet({
  crossingId,
  seatNumber,
  userId,
  onClose,
}: {
  crossingId: string;
  seatNumber: number;
  userId: string;
  onClose: () => void;
}) {
  const existing = useLiveQuery(
    () =>
      getDb()
        .passengers.where("[crossing_id+seat_number]")
        .equals([crossingId, seatNumber])
        .first(),
    [crossingId, seatNumber],
  );

  const [form, setForm] = useState(EMPTY_FORM);
  const { name, companyIdNumber, department, companyName } = form;
  const [manualOverride, setManualOverride] = useState<Classification | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const prefilledRef = useRef(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  // The remembered person a save would rename (same matricule, other name).
  const [conflict, setConflict] = useState<LocalKnownPerson | null>(null);
  // Set once the AB cancels the homonym strip: this seat's sheet stays in
  // 100% manual entry (no name/matricule suggestions at all) until closed.
  const [manualMode, setManualMode] = useState(false);
  // The strip only appears in response to the AB typing a name — never just
  // because a sheet for an already-filled seat opened with its name prefilled.
  const [nameTouched, setNameTouched] = useState(false);

  // Prefill once the existing passenger (if any) resolves from Dexie — a
  // single setState call so this doesn't cascade, and a ref guard so it
  // doesn't fight the AB's own edits afterwards.
  useEffect(() => {
    if (existing && !prefilledRef.current) {
      setForm({
        name: existing.name,
        companyIdNumber: existing.company_id_number ?? "",
        department: existing.department ?? "",
        companyName: existing.company_name ?? "",
      });
      setManualOverride(
        existing.classification_overridden ? existing.classification_final : null,
      );
      prefilledRef.current = true;
    }
  }, [existing]);

  const [suggestions, setSuggestions] = useState<LocalKnownPerson[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Mémoire intelligente (§4.5): suggest known people after 2-3 characters.
  // Looks further than the plain list shows (12 vs 5) so homonyms beyond the
  // 5 most recent still reach the disambiguation strip. In manual mode
  // (after "Annuler") nothing is ever suggested.
  useEffect(() => {
    let active = true;
    const lookup = manualMode
      ? Promise.resolve([] as LocalKnownPerson[])
      : searchKnownPeople(userId, name, 12);
    lookup.then((results) => {
      if (active) setSuggestions(results);
    });
    return () => {
      active = false;
    };
  }, [userId, name, manualMode]);

  const [idSuggestions, setIdSuggestions] = useState<LocalKnownPerson[]>([]);
  const [showIdSuggestions, setShowIdSuggestions] = useState(false);
  // Like nameTouched: the matricule strip only reacts to the AB typing.
  const [idTouched, setIdTouched] = useState(false);

  // Reverse lookup, matricule -> name/department: two TMs never share a
  // Company ID Number (§4.1), so an AB who types the matricule first
  // (before the name) gets the same recall the name search already gives,
  // just in the other direction. TM-only by construction — CC has no
  // matricule to search by.
  useEffect(() => {
    let active = true;
    const lookup = manualMode
      ? Promise.resolve([] as LocalKnownPerson[])
      : searchKnownPeopleByCompanyId(userId, companyIdNumber, 12);
    lookup.then((results) => {
      if (active) setIdSuggestions(results);
    });
    return () => {
      active = false;
    };
  }, [userId, companyIdNumber, manualMode]);

  function selectSuggestion(person: LocalKnownPerson) {
    setConflict(null);
    setForm({
      name: person.name,
      companyIdNumber: person.company_id_number ?? "",
      department: person.department ?? "",
      companyName: person.company_name ?? "",
    });
    setShowSuggestions(false);
    setShowIdSuggestions(false);
  }

  // "Annuler" on the homonym strip: nothing from memory is applied, and
  // this seat goes to 100% manual entry — every field starts from zero and
  // the TM/CC classification is computed from whatever gets typed, as usual.
  function cancelSuggestions() {
    setConflict(null);
    setForm(EMPTY_FORM);
    setManualOverride(null);
    setManualMode(true);
    setShowSuggestions(false);
    setShowIdSuggestions(false);
    nameInputRef.current?.focus();
  }

  function setName(value: string) {
    setConflict(null); // a pending warning is stale once the form changes
    setForm((f) => ({ ...f, name: value }));
    setNameTouched(true);
    setShowSuggestions(true);
  }

  const homonymStrip =
    !manualMode && nameTouched && showSuggestions && hasHomonyms(suggestions);

  // A matricule is supposed to identify one person (§4.1), so two or more
  // known entries carrying the same one means a past entry error. Never pick
  // one silently (nothing is ever prefilled until the AB taps a card): show
  // them all in the same disambiguation strip as name homonyms.
  const idStrip =
    !manualMode && idTouched && showIdSuggestions && idSuggestions.length >= 2;

  function setCompanyIdNumber(value: string) {
    setConflict(null);
    setForm((f) => ({ ...f, companyIdNumber: value }));
  }
  function setDepartment(value: string) {
    setForm((f) => ({ ...f, department: value }));
  }
  function setCompanyName(value: string) {
    setForm((f) => ({ ...f, companyName: value }));
  }

  const resolved = resolveClassification(
    { companyIdNumber, companyName },
    manualOverride,
  );

  // Save is never blocked, but a matricule already remembered under a
  // DIFFERENT name gets a one-tap check first, so a typo'd matricule can't
  // silently rename someone else's memory (§4.5). Confirmer saves; Annuler
  // returns to the form to fix the matricule.
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    const clash = await findMatriculeConflict(userId, companyIdNumber, name);
    if (clash) {
      setConflict(clash);
      setSaving(false);
      return;
    }
    await persist();
  }

  function cancelReplace() {
    setConflict(null);
    document.getElementById("companyIdNumber")?.focus();
  }

  async function persist() {
    setSaving(true);
    const now = new Date().toISOString();
    await getDb().passengers.put({
      id: existing?.id ?? crypto.randomUUID(),
      crossing_id: crossingId,
      seat_number: seatNumber,
      name: name.trim(),
      company_id_number: companyIdNumber.trim() || null,
      department: department.trim() || null,
      company_name: companyName.trim() || null,
      classification_computed: resolved.computed,
      classification_final: resolved.final,
      classification_overridden: resolved.overridden,
      created_at: existing?.created_at ?? now,
      updated_at: now,
      sync_status: "pending",
      sync_error: null,
    });

    await rememberPerson(userId, {
      name: name.trim(),
      companyIdNumber: companyIdNumber.trim() || null,
      department: department.trim() || null,
      companyName: companyName.trim() || null,
    });

    onClose();
  }

  async function handleRemove() {
    if (existing) {
      await getDb().passengers.delete(existing.id);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      {/* pb- adds env(safe-area-inset-bottom) on top of the normal p-5 so
          the Save/Remove row doesn't sit flush against an iPhone's
          home-indicator area when this renders as a bottom sheet (below
          sm:, where it's pinned to the screen edge via items-end above);
          0 on devices/browsers without a safe-area inset. */}
      <div className="w-full max-w-sm rounded-t-xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] dark:bg-zinc-900 sm:rounded-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Seat {seatNumber}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 dark:text-zinc-400"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div className="relative">
            <label
              htmlFor="passengerName"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Name
            </label>
            <input
              id="passengerName"
              type="text"
              required
              autoFocus
              autoComplete="off"
              ref={nameInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={() => {
                setShowSuggestions(true);
                setShowIdSuggestions(false);
              }}
              // While the strip is up it must survive the input losing focus
              // (the AB scrolls/taps the strip); it goes away on pick,
              // "Annuler", or when another field takes focus (below).
              onBlur={() => {
                if (!homonymStrip) setShowSuggestions(false);
              }}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-800"
            />
            {homonymStrip && (
              <KnownPersonStrip
                people={suggestions}
                onSelect={selectSuggestion}
                onCancel={cancelSuggestions}
              />
            )}
            {!manualMode && !homonymStrip && showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-md border border-zinc-300 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                {suggestions.slice(0, 5).map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      onMouseDown={() => selectSuggestion(person)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">
                        {person.name}
                      </span>
                      {/* Matricule shown alongside department/company so
                          homonyms (same name, different matricule, §4.1)
                          can actually be told apart — never auto-select
                          the first match when several share a name. */}
                      <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {[person.company_id_number, person.department, person.company_name]
                          .filter(Boolean)
                          .join(" / ") || "—"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="relative">
            <label
              htmlFor="companyIdNumber"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Company ID Number
            </label>
            <input
              id="companyIdNumber"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={companyIdNumber}
              onChange={(e) => {
                // Digits only — prevents accidentally typing the
                // department here instead (§4.1's classification rule
                // depends on this field only ever holding a matricule).
                setCompanyIdNumber(e.target.value.replace(/\D/g, ""));
                setIdTouched(true);
                setShowIdSuggestions(true);
              }}
              onFocus={() => {
                setShowSuggestions(false);
                setShowIdSuggestions(true);
              }}
              // Same rule as the name field: the strip survives blur (the AB
              // scrolls/taps it) and goes away on pick, "Annuler", or when
              // another field takes focus.
              onBlur={() => {
                if (!idStrip) setShowIdSuggestions(false);
              }}
              placeholder="blank for Director/Manager/new joiner"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-800"
            />
            {idStrip && (
              <KnownPersonStrip
                title="Several people are saved with this ID — pick one"
                people={idSuggestions}
                onSelect={selectSuggestion}
                onCancel={cancelSuggestions}
              />
            )}
            {!manualMode && !idStrip && showIdSuggestions && idSuggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-md border border-zinc-300 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                {idSuggestions.slice(0, 5).map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      onMouseDown={() => selectSuggestion(person)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">
                        {person.name}
                      </span>
                      <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {[person.company_id_number, person.department]
                          .filter(Boolean)
                          .join(" / ") || "—"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="department"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Department
              </label>
              <input
                id="department"
                type="text"
                pattern="[A-Za-z\s]*"
                value={department}
                onFocus={() => {
                  setShowSuggestions(false);
                  setShowIdSuggestions(false);
                }}
                onChange={(e) =>
                  // Letters only — prevents accidentally typing the
                  // matricule here instead of in Company ID Number.
                  setDepartment(e.target.value.replace(/[0-9]/g, ""))
                }
                placeholder="e.g. FNB, Kit, Eng"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            <div>
              <label
                htmlFor="companyName"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                External Company
              </label>
              <input
                id="companyName"
                type="text"
                value={companyName}
                onFocus={() => {
                  setShowSuggestions(false);
                  setShowIdSuggestions(false);
                }}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. UHS, Valet"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Classification
            </span>
            <div className="mt-1 flex gap-2">
              {(["TM", "CC"] as const).map((option) => {
                const active = resolved.final === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      setManualOverride(
                        option === resolved.computed ? null : option,
                      )
                    }
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                      active
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                        : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {resolved.overridden && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                Classification manually corrected (automatic result:{" "}
                {resolved.computed}).
              </p>
            )}
          </div>

          {conflict && (
            <MatriculeConflictNotice
              oldName={conflict.name}
              newName={name.trim()}
              onConfirm={persist}
              onCancel={cancelReplace}
            />
          )}

          <div className={`flex gap-2 pt-2 ${conflict ? "hidden" : ""}`}>
            {existing && (
              <button
                type="button"
                onClick={handleRemove}
                className="flex-1 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 dark:border-red-900 dark:text-red-400"
              >
                Remove
              </button>
            )}
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
