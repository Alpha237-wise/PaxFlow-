"use client";

import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { warpQuadToCanvas, type Point } from "@/lib/perspective-warp";
import { uploadManifestTemplate } from "@/lib/manifest-template";

// Output aspect ratio matches the calibration box in
// manifest-template-calibration.ts (~1.528:1, measured from the reference
// photo) — the overlay positions assume the stored template has this shape.
const OUTPUT_WIDTH = 2000;
const OUTPUT_HEIGHT = 1309;

type CornerPct = { x: number; y: number };

const DEFAULT_CORNERS: [CornerPct, CornerPct, CornerPct, CornerPct] = [
  { x: 5, y: 5 },
  { x: 95, y: 5 },
  { x: 95, y: 95 },
  { x: 5, y: 95 },
];

const CORNER_LABELS = ["Top-left", "Top-right", "Bottom-right", "Bottom-left"];

async function renderPdfFirstPageToDataUrl(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url,
  ).toString();
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvas, viewport }).promise;
  return canvas.toDataURL("image/png");
}

function PreviewCanvas({ canvas }: { canvas: HTMLCanvasElement }) {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren(canvas);
  }, [canvas]);
  return <div ref={hostRef} className="[&>canvas]:block [&>canvas]:w-full [&>canvas]:rounded-md" />;
}

// Upload/Replace flow for the shared manifest template photo (§9 rewrite,
// 2026-08-20) — same component either way, since replacing is just
// uploading again over the single well-known row/file
// (manifest-template.ts's MANIFEST_TEMPLATE_ROW_ID). Steps: pick a
// file/photo/PDF -> drag 4 corner handles onto the paper's edges ->
// perspective-correct via warpQuadToCanvas -> preview -> confirm upload.
export function ManifestTemplateUpload({
  userId,
  currentPreviewUrl,
  currentUpdatedAt,
}: {
  userId: string;
  currentPreviewUrl: string | null;
  currentUpdatedAt: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragCorner = useRef<number | null>(null);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [corners, setCorners] =
    useState<[CornerPct, CornerPct, CornerPct, CornerPct]>(DEFAULT_CORNERS);
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);
  const [step, setStep] = useState<"idle" | "corners" | "preview">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadFile(file: File) {
    setError(null);
    let url: string;
    if (file.type === "application/pdf") {
      try {
        url = await renderPdfFirstPageToDataUrl(file);
      } catch {
        setError("Could not read that PDF. Try a photo/image instead.");
        return;
      }
    } else {
      url = URL.createObjectURL(file);
    }
    const img = new Image();
    img.onload = () => {
      setImageEl(img);
      setImageUrl(url);
      setCorners(DEFAULT_CORNERS);
      setStep("corners");
    };
    img.onerror = () => setError("Could not read that file as an image.");
    img.src = url;
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void loadFile(file);
    e.target.value = "";
  }

  function handlePointerDown(index: number, e: PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    dragCorner.current = index;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    const idx = dragCorner.current;
    if (idx === null || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    setCorners((prev) => {
      const next = [...prev] as typeof prev;
      next[idx] = { x, y };
      return next;
    });
  }

  function handlePointerUp() {
    dragCorner.current = null;
  }

  function handleStraighten() {
    if (!imageEl) return;
    const srcCorners = corners.map((c) => [
      (c.x / 100) * imageEl.naturalWidth,
      (c.y / 100) * imageEl.naturalHeight,
    ]) as [Point, Point, Point, Point];
    try {
      const canvas = warpQuadToCanvas(
        imageEl,
        imageEl.naturalWidth,
        imageEl.naturalHeight,
        srcCorners,
        OUTPUT_WIDTH,
        OUTPUT_HEIGHT,
      );
      setPreviewCanvas(canvas);
      setStep("preview");
    } catch {
      setError(
        "Those corner points don't form a valid rectangle — spread them out more and try again.",
      );
    }
  }

  async function handleConfirmUpload() {
    if (!previewCanvas) return;
    setBusy(true);
    setError(null);
    try {
      const blob: Blob | null = await new Promise((resolve) =>
        previewCanvas.toBlob((b) => resolve(b), "image/png"),
      );
      if (!blob) {
        setError("Could not export the corrected image.");
        return;
      }
      const { error: uploadError } = await uploadManifestTemplate(blob, userId);
      if (uploadError) {
        setError(uploadError);
        return;
      }
      setStep("idle");
      setImageUrl(null);
      setImageEl(null);
      setPreviewCanvas(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function handleCancel() {
    setStep("idle");
    setImageUrl(null);
    setImageEl(null);
    setPreviewCanvas(null);
    setError(null);
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        Manifest template
      </h2>

      {step === "idle" && (
        <div className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          {currentPreviewUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage signed URL, not a local asset */}
              <img
                src={currentPreviewUrl}
                alt="Current manifest template"
                className="max-h-40 w-full rounded-md border border-zinc-200 object-contain dark:border-zinc-800"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Last updated{" "}
                {currentUpdatedAt ? new Date(currentUpdatedAt).toLocaleString() : "—"}
              </p>
            </>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No template uploaded yet. Crossings will show a plain reconstruction until one is
              added.
            </p>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
          >
            {currentPreviewUrl ? "Replace" : "Upload"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}

      {step === "corners" && imageUrl && (
        <div className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Drag each dot onto a corner of the paper form.
          </p>
          <div
            ref={containerRef}
            className="relative touch-none select-none"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- object/data URL from a freshly picked file, not a static asset */}
            <img
              src={imageUrl}
              alt="Uploaded manifest form"
              className="block w-full"
              draggable={false}
            />
            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              <polygon
                points={corners.map((c) => `${c.x},${c.y}`).join(" ")}
                fill="rgba(37, 99, 235, 0.15)"
                stroke="rgb(37, 99, 235)"
                strokeWidth={0.4}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {corners.map((c, i) => (
              <div
                key={i}
                onPointerDown={(e) => handlePointerDown(i, e)}
                title={CORNER_LABELS[i]}
                style={{ left: `${c.x}%`, top: `${c.y}%` }}
                className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 border-white bg-blue-600 shadow"
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleStraighten}
              className="flex-1 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
            >
              Straighten
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === "preview" && previewCanvas && (
        <div className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <PreviewCanvas canvas={previewCanvas} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirmUpload}
              disabled={busy}
              className="flex-1 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
            >
              {busy ? "Uploading…" : "Looks good — Upload"}
            </button>
            <button
              type="button"
              onClick={() => setStep("corners")}
              disabled={busy}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              Retry corners
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
