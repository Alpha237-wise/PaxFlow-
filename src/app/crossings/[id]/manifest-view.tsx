"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import {
  buildManifestData,
  type ManifestCrossingInput,
  type ManifestData,
  type ManifestRow,
} from "@/lib/manifest";
import {
  HEADER_FIELDS,
  FOOTER_FIELDS,
  LEFT_SEAT_BLOCK,
  RIGHT_SEAT_BLOCK,
  LEFT_BLOCK_MAX_SEAT,
  seatRowYPct,
  type FieldPosition,
} from "@/lib/manifest-template-calibration";

// Fixed pixel width, independent of the viewport: this element is exported
// as an image/PDF, not viewed responsively (§9.4 — deterministic template).
const MANIFEST_WIDTH = 1100;

function fieldStyle(pos: FieldPosition): CSSProperties {
  const base: CSSProperties = {
    position: "absolute",
    top: `${pos.yPct}%`,
    whiteSpace: "nowrap",
    fontSize: 13,
    lineHeight: 1,
    color: "black",
  };
  if (pos.align === "right") {
    return { ...base, right: `${100 - pos.xPct}%`, textAlign: "right", transform: "translateY(-100%)" };
  }
  if (pos.align === "center") {
    return { ...base, left: `${pos.xPct}%`, textAlign: "center", transform: "translate(-50%, -100%)" };
  }
  return { ...base, left: `${pos.xPct}%`, textAlign: "left", transform: "translateY(-100%)" };
}

// Overlays data as absolutely-positioned text on top of the real
// photographed/scanned paper form (§9 rewrite, 2026-08-20) — replaces the
// earlier coded HTML reconstruction of the paper layout. Positions come
// from manifest-template-calibration.ts, expressed as percentages of this
// image so the same calibration works at any render width.
function PhotoOverlayManifest({
  templateUrl,
  manifest,
}: {
  templateUrl: string;
  manifest: ManifestData;
}) {
  const leftRows = manifest.rows.filter((r) => r.seat <= LEFT_BLOCK_MAX_SEAT);
  const rightRows = manifest.rows.filter((r) => r.seat > LEFT_BLOCK_MAX_SEAT);

  function seatRows(rows: ManifestRow[], block: typeof LEFT_SEAT_BLOCK) {
    return rows.map((row, i) => {
      const yPct = seatRowYPct(block, i, rows.length);
      return (
        <div key={row.seat}>
          <span style={fieldStyle({ xPct: block.seatXPct, yPct })}>{row.seat}</span>
          <span style={fieldStyle({ xPct: block.nameXPct, yPct })}>{row.name}</span>
          <span style={fieldStyle({ xPct: block.companyIdXPct, yPct })}>
            {row.companyIdNumber}
          </span>
          <span style={fieldStyle({ xPct: block.departmentXPct, yPct })}>
            {row.departmentCompany}
          </span>
        </div>
      );
    });
  }

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- exported via
          html-to-image, which needs a plain <img> it can rasterize directly */}
      <img src={templateUrl} alt="Manifest template" style={{ width: "100%", display: "block" }} />

      <span style={fieldStyle(HEADER_FIELDS.date)}>{manifest.date}</span>
      <span style={fieldStyle(HEADER_FIELDS.vesselName)}>{manifest.vesselName}</span>
      <span style={fieldStyle(HEADER_FIELDS.timeOfDeparture)}>{manifest.timeOfDeparture}</span>
      <span style={fieldStyle(HEADER_FIELDS.timeOfArrival)}>{manifest.timeOfArrival}</span>
      <span style={fieldStyle(HEADER_FIELDS.portOfOrigin)}>{manifest.portOfOrigin}</span>
      <span style={fieldStyle(HEADER_FIELDS.destination)}>{manifest.destination}</span>

      {seatRows(leftRows, LEFT_SEAT_BLOCK)}
      {seatRows(rightRows, RIGHT_SEAT_BLOCK)}

      <span style={fieldStyle(FOOTER_FIELDS.captainOnBoard)}>{manifest.captainOnBoard}</span>
      <span style={fieldStyle(FOOTER_FIELDS.mechanic)}>{manifest.mechanic}</span>
      <span style={fieldStyle(FOOTER_FIELDS.abName)}>{manifest.abName}</span>
      <span style={fieldStyle(FOOTER_FIELDS.marineHostess)}>{manifest.marineHostess}</span>
      <span style={fieldStyle(FOOTER_FIELDS.totalTM)}>{manifest.totalTM}</span>
      <span style={fieldStyle(FOOTER_FIELDS.totalGuests)}>{manifest.totalGuests}</span>
      <span style={fieldStyle(FOOTER_FIELDS.totalContractors)}>{manifest.totalContractors}</span>
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

// Fallback used only when no template photo has been uploaded/synced yet
// (§9 rewrite) — the earlier coded reconstruction of the paper layout,
// kept as-is so a crossing is never unexportable while the Super Admin
// hasn't uploaded a template.
function CodedTemplateManifest({ manifest }: { manifest: ManifestData }) {
  const leftRows = manifest.rows.filter((r) => r.seat <= LEFT_BLOCK_MAX_SEAT);
  const rightRows = manifest.rows.filter((r) => r.seat > LEFT_BLOCK_MAX_SEAT);

  return (
    <div className="bg-white p-6 text-black">
      <h3 className="text-lg font-semibold">PaxFlow — Manifest</h3>
      <p className="text-xs text-zinc-500">
        (No manifest template photo uploaded yet — showing a plain reconstruction. Ask a
        Super Admin to upload the paper form under Super Admin.)
      </p>
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

      <div className="mt-4 grid grid-cols-2 gap-x-6 text-sm">
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
    </div>
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

  const template = useLiveQuery(() => getDb().manifest_template.get("current"), []);

  // Recomputed only when the cached blob actually changes (e.g. after a
  // Super Admin replaces the template and this device syncs it down) —
  // revoked in a separate cleanup-only effect below, never via setState.
  const templateUrl = useMemo(
    () => (template ? URL.createObjectURL(template.blob) : null),
    [template],
  );

  useEffect(() => {
    return () => {
      if (templateUrl) URL.revokeObjectURL(templateUrl);
    };
  }, [templateUrl]);

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
        <div ref={manifestRef} style={{ width: MANIFEST_WIDTH }} className="bg-white">
          {templateUrl ? (
            <PhotoOverlayManifest templateUrl={templateUrl} manifest={manifest} />
          ) : (
            <CodedTemplateManifest manifest={manifest} />
          )}
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
