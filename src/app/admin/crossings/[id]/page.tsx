import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { summarizeCrossing } from "@/lib/crossing-summary";
import { buildManifestData } from "@/lib/manifest";
import { toPassengerRow } from "@/lib/db/schema";

export default async function AdminCrossingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "super_admin") {
    redirect("/");
  }

  const { id } = await params;

  const { data: crossing } = await supabase
    .from("crossings")
    .select(
      "*, vessels(name), profiles(full_name)",
    )
    .eq("id", id)
    .single();

  if (!crossing) {
    notFound();
  }

  const { data: passengers } = await supabase
    .from("passengers")
    .select("*")
    .eq("crossing_id", id)
    .order("seat_number");

  const passengerRows = (passengers ?? []).map(toPassengerRow);
  const summary = summarizeCrossing(passengerRows);
  const vesselLabel =
    crossing.vessel_name_override || crossing.vessels?.name || "—";
  const manifest = buildManifestData(crossing, vesselLabel, passengerRows);

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-8 dark:bg-black">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {vesselLabel}
          </h1>
          <Link
            href="/admin"
            className="text-sm font-medium text-zinc-900 underline dark:text-zinc-50"
          >
            Back to supervision
          </Link>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-zinc-500 dark:text-zinc-400">Date</dt>
          <dd className="text-zinc-900 dark:text-zinc-50">{manifest.date}</dd>
          <dt className="text-zinc-500 dark:text-zinc-400">AB</dt>
          <dd className="text-zinc-900 dark:text-zinc-50">
            {crossing.profiles?.full_name || "—"}
          </dd>
          <dt className="text-zinc-500 dark:text-zinc-400">Origin</dt>
          <dd className="text-zinc-900 dark:text-zinc-50">
            {manifest.portOfOrigin || "—"}
          </dd>
          <dt className="text-zinc-500 dark:text-zinc-400">Destination</dt>
          <dd className="text-zinc-900 dark:text-zinc-50">
            {manifest.destination || "—"}
          </dd>
        </dl>

        <div className="flex gap-3">
          <div className="flex-1 rounded-lg border border-zinc-200 p-3 text-center dark:border-zinc-800">
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {summary.totalTM}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">TM</p>
          </div>
          <div className="flex-1 rounded-lg border border-zinc-200 p-3 text-center dark:border-zinc-800">
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {summary.totalCC}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">CC</p>
          </div>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-300 dark:border-zinc-700">
              <th className="py-1 text-left font-semibold text-zinc-700 dark:text-zinc-300">
                Seat
              </th>
              <th className="py-1 text-left font-semibold text-zinc-700 dark:text-zinc-300">
                Name
              </th>
              <th className="py-1 text-left font-semibold text-zinc-700 dark:text-zinc-300">
                Company ID
              </th>
              <th className="py-1 text-left font-semibold text-zinc-700 dark:text-zinc-300">
                Dept/Company
              </th>
            </tr>
          </thead>
          <tbody>
            {manifest.rows.map((row) => (
              <tr key={row.seat} className="border-b border-zinc-200 dark:border-zinc-800">
                <td className="py-1 text-zinc-900 dark:text-zinc-50">{row.seat}</td>
                <td className="py-1 text-zinc-900 dark:text-zinc-50">{row.name}</td>
                <td className="py-1 text-zinc-900 dark:text-zinc-50">{row.companyIdNumber}</td>
                <td className="py-1 text-zinc-900 dark:text-zinc-50">{row.departmentCompany}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
