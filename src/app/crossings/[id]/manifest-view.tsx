"use client";

import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import { buildManifestData, type ManifestCrossingInput } from "@/lib/manifest";

// Fixed pixel width, independent of the viewport: this element is exported
// as an image/PDF, not viewed responsively (§9.4 — deterministic template).
const MANIFEST_WIDTH = 800;

export function ManifestView({
  crossingId,
  vesselName,
  crossing,
  seatLayoutRef,
}: {
  crossingId: string;
  vesselName: string;
  crossing: ManifestCrossingInput;
  seatLayoutRef: "51-seats" | "50-seats";
}) {
  const manifestRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"pdf" | "image" | null>(null);

  const passengers = useLiveQuery(
    () => getDb().passengers.where("crossing_id").equals(crossingId).toArray(),
    [crossingId],
  );

  const manifest = buildManifestData(
    crossing,
    vesselName,
    passengers ?? [],
    seatLayoutRef,
  );

  async function toPngDataUrl(): Promise<{ url: string; width: number; height: number }> {
    const node = manifestRef.current;
    if (!node) throw new Error("Manifest node not mounted");
    const { toPng } = await import("html-to-image");
    const url = await toPng(node, { backgroundColor: "#ffffff", pixelRatio: 2 });
    return { url, width: node.offsetWidth, height: node.offsetHeight };
  }

  function download(href: string, filename: string) {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
  }

  async function handleDownloadImage() {
    setBusy("image");
    try {
      const { url } = await toPngDataUrl();
      download(url, `paxflow-manifest-${manifest.date}-${manifest.vesselName}.png`);
    } finally {
      setBusy(null);
    }
  }

  async function handleDownloadPdf() {
    setBusy("pdf");
    try {
      const [{ url, width, height }, { default: jsPDF }] = await Promise.all([
        toPngDataUrl(),
        import("jspdf"),
      ]);
      const pdf = new jsPDF({
        unit: "px",
        format: [width, height],
        orientation: width > height ? "landscape" : "portrait",
      });
      pdf.addImage(url, "PNG", 0, 0, width, height);
      pdf.save(`paxflow-manifest-${manifest.date}-${manifest.vesselName}.pdf`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-3">
      <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        Manifest
      </h2>

      <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <div
          ref={manifestRef}
          style={{ width: MANIFEST_WIDTH }}
          className="bg-white p-6 text-black"
        >
          <h3 className="text-lg font-semibold">PaxFlow — Manifest</h3>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div>
              <span className="text-zinc-500">Date: </span>
              {manifest.date}
            </div>
            <div>
              <span className="text-zinc-500">Vessel Name: </span>
              {manifest.vesselName}
            </div>
            <div>
              <span className="text-zinc-500">Time of Departure: </span>
              {manifest.timeOfDeparture}
            </div>
            <div>
              <span className="text-zinc-500">Time of Arrival: </span>
              {manifest.timeOfArrival}
            </div>
            <div>
              <span className="text-zinc-500">Part of Origin: </span>
              {manifest.portOfOrigin}
            </div>
            <div>
              <span className="text-zinc-500">Destination: </span>
              {manifest.destination}
            </div>
          </div>

          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1 text-left font-semibold">Seat</th>
                <th className="py-1 text-left font-semibold">Name</th>
                <th className="py-1 text-left font-semibold">
                  Company ID Number
                </th>
                <th className="py-1 text-left font-semibold">
                  Department/Company
                </th>
              </tr>
            </thead>
            <tbody>
              {manifest.rows.map((row) => (
                <tr key={row.seat} className="border-b border-zinc-200">
                  <td className="py-1">{row.seat}</td>
                  <td className="py-1">{row.name}</td>
                  <td className="py-1">{row.companyIdNumber}</td>
                  <td className="py-1">{row.departmentCompany}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex justify-between text-sm">
            <div>
              <span className="text-zinc-500">MH: </span>
              {manifest.marineHostess}
            </div>
            <div>
              <span className="text-zinc-500">Total No. of Guest: </span>
              {manifest.totalGuests}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={busy !== null}
          className="flex-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {busy === "pdf" ? "Generating…" : "Download PDF"}
        </button>
        <button
          type="button"
          onClick={handleDownloadImage}
          disabled={busy !== null}
          className="flex-1 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
        >
          {busy === "image" ? "Generating…" : "Download Image"}
        </button>
      </div>
    </div>
  );
}
