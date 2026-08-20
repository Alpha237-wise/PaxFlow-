"use client";

import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import {
  buildManifestData,
  type ManifestCrossingInput,
  type ManifestRow,
} from "@/lib/manifest";

// Fixed pixel width, independent of the viewport: this element is exported
// as an image/PDF, not viewed responsively (§9.4 — deterministic template).
// Wider than a single-column layout needs, to fit the two side-by-side
// seat blocks that mirror the paper form's landscape layout (§9.2, revised
// 2026-08-20 from a reference photo of the blank paper template).
const MANIFEST_WIDTH = 1100;

// The paper template splits the writing table at seat 25/26 regardless of
// how many seats the boat actually has (confirmed for the 51-seat layout
// from the reference photo; applied the same way to the unconfirmed
// 50-seat layout, consistent with §5's existing placeholder note).
const LEFT_BLOCK_MAX_SEAT = 25;

// Simplified reconstruction of the company mark seen on the paper
// template (docs/reference/seat-plan-blank-manifest.jpg), redrawn as line
// art from that photo rather than extracted as a pixel crop — explicit
// request from the project owner (2026-08-20) to include it, overriding
// §9.4's original "no logo" rule for this employee-built internal tool.
function CompanyLogo() {
  return (
    <div className="flex flex-col items-center text-center">
      <svg viewBox="0 0 140 100" width="70" height="50" aria-hidden="true">
        <g fill="none" stroke="black" strokeWidth={2.2} strokeLinecap="round">
          <path d="M 22 88 C 6 84, 2 70, 4 54" />
          <path d="M 22 88 C 8 55, 18 20, 50 5" />
          <path d="M 22 88 C 35 55, 65 40, 98 34" />
          <path d="M 22 88 C 55 84, 88 82, 110 68" />
        </g>
      </svg>
      <p className="mt-1 text-[9px] font-medium tracking-wide">
        BANANA ISLAND RESORT DOHA
      </p>
      <p className="text-[9px] tracking-wide text-zinc-600">BY ANANTARA</p>
    </div>
  );
}

function SeatTable({ rows }: { rows: ManifestRow[] }) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-b border-black">
          <th className="py-0.5 pr-1 text-left font-semibold">Seat</th>
          <th className="py-0.5 pr-1 text-left font-semibold">Name</th>
          <th className="py-0.5 pr-1 text-left font-semibold">
            Company ID Number
          </th>
          <th className="py-0.5 text-left font-semibold">
            Department/Company
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.seat} className="border-b border-zinc-200">
            <td className="py-0.5 pr-1">{row.seat}</td>
            <td className="py-0.5 pr-1">{row.name}</td>
            <td className="py-0.5 pr-1">{row.companyIdNumber}</td>
            <td className="py-0.5">{row.departmentCompany}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

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

  const leftRows = manifest.rows.filter((r) => r.seat <= LEFT_BLOCK_MAX_SEAT);
  const rightRows = manifest.rows.filter((r) => r.seat > LEFT_BLOCK_MAX_SEAT);

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

          <div className="mt-4 flex gap-6">
            <div className="flex-1">
              <SeatTable rows={leftRows} />
            </div>
            <div className="flex-1">
              <SeatTable rows={rightRows} />
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between gap-6">
            <div className="grid grid-cols-2 gap-x-6 text-sm">
              <div className="space-y-0.5">
                <div>
                  <span className="text-zinc-500">Captain on board: </span>
                  {manifest.captainOnBoard}
                </div>
                <div>
                  <span className="text-zinc-500">Mechanic: </span>
                  {manifest.mechanic}
                </div>
                <div>
                  <span className="text-zinc-500">AB: </span>
                  {manifest.abName}
                </div>
                <div>
                  <span className="text-zinc-500">Marine Hostess: </span>
                  {manifest.marineHostess}
                </div>
              </div>
              <div className="space-y-0.5">
                <div>
                  <span className="text-zinc-500">Total No. of TM: </span>
                  {manifest.totalTM}
                </div>
                <div>
                  <span className="text-zinc-500">Total No. of Guest: </span>
                  {manifest.totalGuests}
                </div>
                <div>
                  <span className="text-zinc-500">Total No. of Contractors No.: </span>
                  {manifest.totalContractors}
                </div>
              </div>
            </div>
            <CompanyLogo />
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
