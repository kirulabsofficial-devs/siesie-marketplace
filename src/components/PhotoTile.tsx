import { useState } from "react";
import type { Photo, TilePattern } from "../data/types";
import { SERVICE_PHOTOS } from "../data/serviceData";
import { cn } from "../lib/cn";

/**
 * Renders real high-res photography with automatic fallback to vector tile swatches
 * if an image fails to load or hasn't been set.
 */
export function PhotoTile({ photo, className, showCaption = true }: { photo: Photo; className?: string; showCaption?: boolean }) {
  const [loadError, setLoadError] = useState(false);
  const resolvedSrc = photo.src || SERVICE_PHOTOS[photo.id];

  return (
    <figure className={cn("relative aspect-[4/3] overflow-hidden bg-slate-100", className)}>
      {resolvedSrc && !loadError ? (
        <img
          src={resolvedSrc}
          alt={photo.caption || "Service photo"}
          className="size-full object-cover transition-transform duration-300 hover:scale-105"
          loading="lazy"
          onError={() => setLoadError(true)}
        />
      ) : (
        <Pattern kind={photo.pattern ?? "grid"} seed={photo.id} label={photo.caption} />
      )}
      {showCaption && photo.caption && (
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-3 pb-2 pt-6 text-[0.8125rem] font-medium leading-snug text-white">
          {photo.caption}
        </figcaption>
      )}
    </figure>
  );
}


const GLAZES = [
  { a: "#f4f5f1", b: "#c9d0cb", line: "#9aa39d" },
  { a: "#dfe5f5", b: "#1c2f8a", line: "#aeb8dc" },
  { a: "#e9eee9", b: "#6f8a7d", line: "#b9c5bd" },
  { a: "#f3efe6", b: "#8d8474", line: "#cfc7b7" },
  { a: "#e5ebe8", b: "#2f5f73", line: "#b3c4c8" },
];

function hex(cx: number, cy: number, r: number) {
  const dx = r * 0.866;
  return [
    [cx, cy - r],
    [cx + dx, cy - r / 2],
    [cx + dx, cy + r / 2],
    [cx, cy + r],
    [cx - dx, cy + r / 2],
    [cx - dx, cy - r / 2],
  ]
    .map((p) => p.join(","))
    .join(" ");
}

function Pattern({ kind, seed, label }: { kind: TilePattern; seed: string; label: string }) {
  const h = [...seed].reduce((s, c) => (s * 33 + c.charCodeAt(0)) >>> 0, 5);
  const g = GLAZES[h % GLAZES.length];
  const pid = `pat-${seed}-${kind}`;
  return (
    <svg viewBox="0 0 160 120" className="size-full" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${label} (sample image)`}>
      <defs>
        {kind === "checker" && (
          <pattern id={pid} width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="40" height="40" fill={g.line} />
            <rect x="1" y="1" width="18" height="18" fill={g.a} />
            <rect x="21" y="21" width="18" height="18" fill={g.a} />
            <rect x="21" y="1" width="18" height="18" fill={g.b} />
            <rect x="1" y="21" width="18" height="18" fill={g.b} />
          </pattern>
        )}
        {kind === "subway" && (
          <pattern id={pid} width="40" height="20" patternUnits="userSpaceOnUse">
            <rect width="40" height="20" fill={g.line} />
            <rect x="1" y="1" width="38" height="8" rx="0.5" fill={g.a} />
            <rect x="-19" y="11" width="38" height="8" rx="0.5" fill={g.a} />
            <rect x="21" y="11" width="38" height="8" rx="0.5" fill={g.a} />
          </pattern>
        )}
        {kind === "herringbone" && (
          <pattern id={pid} width="32" height="32" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="32" height="32" fill={g.line} />
            <rect x="1" y="1" width="22" height="7" fill={g.a} />
            <rect x="24" y="1" width="7" height="22" fill={g.b} opacity="0.75" />
            <rect x="9" y="9" width="7" height="22" fill={g.b} opacity="0.75" />
            <rect x="17" y="24" width="22" height="7" fill={g.a} />
            <rect x="-15" y="24" width="22" height="7" fill={g.a} />
          </pattern>
        )}
        {kind === "hex" && (
          <pattern id={pid} width="26" height="45" patternUnits="userSpaceOnUse">
            <rect width="26" height="45" fill={g.line} />
            {[
              [13, 15],
              [0, 37.5],
              [26, 37.5],
              [0, -7.5],
              [26, -7.5],
            ].map(([cx, cy], i) => (
              <polygon key={i} points={hex(cx, cy, 14)} fill={i === 0 ? g.a : g.b} opacity={i === 0 ? 1 : 0.35} />
            ))}
          </pattern>
        )}
        {kind === "grid" && (
          <pattern id={pid} width="30" height="30" patternUnits="userSpaceOnUse">
            <rect width="30" height="30" fill={g.line} />
            <rect x="1" y="1" width="28" height="28" fill={g.a} />
          </pattern>
        )}
        {kind === "terrazzo" && (
          <pattern id={pid} width="60" height="60" patternUnits="userSpaceOnUse">
            <rect width="60" height="60" fill={g.a} />
            <circle cx="8" cy="12" r="2.4" fill={g.b} />
            <circle cx="30" cy="6" r="1.4" fill={g.line} />
            <circle cx="47" cy="20" r="3" fill={g.line} />
            <circle cx="18" cy="38" r="1.8" fill={g.b} opacity="0.7" />
            <circle cx="41" cy="46" r="2.2" fill={g.b} />
            <circle cx="55" cy="54" r="1.2" fill={g.b} />
            <circle cx="6" cy="52" r="3.2" fill={g.line} />
            <polygon points="26,24 31,22 30,28" fill={g.b} opacity="0.6" />
          </pattern>
        )}
        {kind === "pipes" && (
          <pattern id={pid} width="160" height="120" patternUnits="userSpaceOnUse">
            <rect width="160" height="120" fill={g.a} />
            <path d="M-10 40 H70 a12 12 0 0 1 12 12 V130" stroke={g.b} strokeWidth="14" fill="none" />
            <path d="M170 78 H110 a10 10 0 0 0 -10 10 V130" stroke={g.line} strokeWidth="10" fill="none" />
            <rect x="60" y="32" width="12" height="16" rx="2" fill={g.line} />
          </pattern>
        )}
      </defs>
      <rect width="160" height="120" fill={`url(#${pid})`} />
    </svg>
  );
}
