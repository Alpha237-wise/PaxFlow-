"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import {
  resolveClassification,
  type Classification,
} from "@/lib/classification";

export function PassengerSheet({
  crossingId,
  seatNumber,
  onClose,
}: {
  crossingId: string;
  seatNumber: number;
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

  const [form, setForm] = useState({
    name: "",
    companyIdNumber: "",
    department: "",
    companyName: "",
  });
  const { name, companyIdNumber, department, companyName } = form;
  const [manualOverride, setManualOverride] = useState<Classification | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const prefilledRef = useRef(false);

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

  function setName(value: string) {
    setForm((f) => ({ ...f, name: value }));
  }
  function setCompanyIdNumber(value: string) {
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
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
      <div className="w-full max-w-sm rounded-t-xl bg-white p-5 dark:bg-zinc-900 sm:rounded-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Siège {seatNumber}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 dark:text-zinc-400"
          >
            Fermer
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>

          <div>
            <label
              htmlFor="companyIdNumber"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Company ID Number
            </label>
            <input
              id="companyIdNumber"
              type="text"
              value={companyIdNumber}
              onChange={(e) => setCompanyIdNumber(e.target.value)}
              placeholder="vide pour Director/Manager/new joiner"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-800"
            />
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
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="ex: FNB, Kit, Eng"
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
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="ex: UHS, Valet"
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
                Classification corrigée manuellement (calcul automatique :{" "}
                {resolved.computed}).
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            {existing && (
              <button
                type="button"
                onClick={handleRemove}
                className="flex-1 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 dark:border-red-900 dark:text-red-400"
              >
                Retirer
              </button>
            )}
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
