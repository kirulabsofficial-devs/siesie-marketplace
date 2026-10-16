import { useId, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import type { Photo } from "../data/types";
import { uid } from "../lib/format";
import { LIVE_BACKEND } from "../data/runtime";

/** Downscales to a small JPEG so the demo can keep photos in localStorage. The real app uploads to S3. */
async function toThumb(file: File, max = LIVE_BACKEND ? 1600 : 480): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PhotoPicker({ value, onChange, max = 4, label = "Add photos", hint }: { value: Photo[]; onChange: (p: Photo[]) => void; max?: number; label?: string; hint?: string }) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = max - value.length;
    const picked = [...files].filter((f) => f.type.startsWith("image/")).slice(0, room);
    if (files.length > room) setError(`You can add up to ${max} photos.`);
    try {
      const thumbs = await Promise.all(picked.map(async (f) => ({ id: uid("ph"), caption: f.name.replace(/\.[^.]+$/, ""), src: await toThumb(f) })));
      onChange([...value, ...thumbs]);
    } catch {
      setError("One of those files couldn't be read. Try a JPG or PNG.");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.map((p) => (
          <div key={p.id} className="relative size-24 overflow-hidden rounded-[var(--radius-tile)] border-2 border-grout-deep bg-tile-dim">
            {p.src ? <img src={p.src} alt={p.caption} className="size-full object-cover" /> : <span className="p-1 text-xs">{p.caption}</span>}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x.id !== p.id))}
              className="absolute right-1 top-1 grid size-7 place-items-center rounded bg-ink/80 text-tile hover:bg-ink"
              aria-label={`Remove ${p.caption}`}
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
        {value.length < max && (
          <label
            htmlFor={id}
            className="grid size-24 cursor-pointer place-items-center rounded-[var(--radius-tile)] border-2 border-dashed border-grout-deep bg-tile text-center text-xs font-bold text-ink-soft hover:border-ink-soft hover:text-ink has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-cobalt-bright"
          >
            <span className="flex flex-col items-center gap-1">
              <ImagePlus className="size-6" aria-hidden />
              {label}
            </span>
            <input id={id} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => add(e.target.files)} />
          </label>
        )}
      </div>
      {hint && <p className="mt-2 text-sm text-ink-soft">{hint}</p>}
      {error && <p className="mt-2 text-sm font-bold text-kiln-deep">{error}</p>}
    </div>
  );
}
