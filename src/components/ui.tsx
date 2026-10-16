import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import { BadgeCheck, ChevronRight, Heart, Loader2, Star, X } from "lucide-react";
import type { JobStatus, Photo, VerificationStatus } from "../data/types";
import { cn } from "../lib/cn";
import { initials } from "../lib/format";
import { PhotoTile } from "./PhotoTile";

// ── Buttons ────────────────────────────────────────────────────────────────

type Variant = "primary" | "secondary" | "ghost" | "danger" | "light" | "gradient" | "dark";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-cobalt-bright text-white hover:bg-cobalt active:bg-cobalt shadow-[var(--shadow-cobalt)] border border-transparent",
  gradient: "bg-gradient-to-br from-cobalt-bright to-indigo-600 text-white hover:from-cobalt hover:to-indigo-700 shadow-[var(--shadow-cobalt)] border border-transparent",
  dark: "bg-ink text-white hover:bg-ink-mid shadow-[var(--shadow-card)] border border-transparent",
  secondary: "bg-white text-ink border border-grout-deep hover:border-ink-faint hover:bg-tile-dim shadow-[var(--shadow-flush)]",
  ghost: "bg-transparent text-ink-mid border border-transparent hover:bg-grout",
  danger: "bg-white text-kiln-deep border border-kiln/25 hover:bg-kiln-wash hover:border-kiln/40",
  light: "bg-white text-cobalt border border-transparent hover:bg-cobalt-wash shadow-[var(--shadow-card)]",
};

// Every size clears the 44px minimum touch target.
const SIZE: Record<Size, string> = {
  sm: "min-h-11 px-4 text-xs rounded-full gap-1.5 font-bold",
  md: "min-h-12 px-5 text-sm rounded-2xl gap-2 font-bold",
  lg: "min-h-14 px-7 text-base rounded-2xl gap-2.5 font-extrabold tracking-tight",
};

const base =
  "press sheen inline-flex items-center justify-center select-none whitespace-nowrap disabled:opacity-45 disabled:pointer-events-none disabled:shadow-none";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; busy?: boolean }
>(function Button({ variant = "primary", size = "md", busy, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      className={cn(base, VARIANT[variant], SIZE[size], className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function LinkButton({ variant = "primary", size = "md", className, ...rest }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={cn(base, VARIANT[variant], SIZE[size], className)} {...rest} />;
}

/** Circular icon-only control. Always needs a label — it has no visible text. */
export function IconButton({
  label,
  children,
  className,
  tone = "surface",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: "surface" | "glass" | "solid" }) {
  const tones = {
    surface: "bg-white text-ink-mid border border-grout-deep hover:bg-tile-dim hover:text-ink shadow-[var(--shadow-flush)]",
    glass: "bg-white/20 text-white border border-white/30 backdrop-blur-md hover:bg-white/30",
    solid: "bg-ink text-white border border-transparent hover:bg-ink-mid",
  };
  return (
    <button type="button" aria-label={label} title={label} className={cn("press grid size-11 shrink-0 place-items-center rounded-full", tones[tone], className)} {...rest}>
      {children}
    </button>
  );
}

// ── Heart Favorite Button ──────────────────────────────────────────────────

export function FavoriteButton({ id, className, size = "md" }: { id: string; className?: string; size?: "sm" | "md" | "lg" }) {
  const [fav, setFav] = useState(() => {
    try {
      return localStorage.getItem(`fav_${id}`) === "1";
    } catch {
      return false;
    }
  });

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !fav;
    setFav(next);
    try {
      if (next) localStorage.setItem(`fav_${id}`, "1");
      else localStorage.removeItem(`fav_${id}`);
    } catch {}
  };

  const dims = { sm: "size-9", md: "size-10", lg: "size-11" }[size];
  const iconDims = { sm: "size-4", md: "size-4.5", lg: "size-5" }[size];

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={fav}
      aria-label={fav ? "Remove from saved" : "Save to favourites"}
      // tap-target keeps the circle visually light on a small card while the
      // touchable area still reaches 44px.
      className={cn(
        "press tap-target grid place-items-center rounded-full backdrop-blur-md active:scale-90",
        fav ? "bg-white text-kiln shadow-[var(--shadow-card)]" : "bg-white/85 text-ink-faint hover:text-kiln hover:bg-white shadow-[var(--shadow-flush)]",
        dims,
        className,
      )}
    >
      <Heart className={cn(iconDims, "transition-transform duration-200", fav ? "fill-kiln text-kiln scale-110" : "fill-transparent")} aria-hidden />
    </button>
  );
}

// ── Surfaces ───────────────────────────────────────────────────────────────

export function Tile({
  className,
  children,
  as: As = "section",
  ...rest
}: { className?: string; children: ReactNode; as?: "section" | "div" | "article" | "li" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={cn("rounded-[var(--radius-card)] bg-white border border-slate-100 shadow-[var(--shadow-tile)]", className)} {...rest}>
      {children}
    </As>
  );
}

export function PageHeader({ title, lead, actions, back }: { title: ReactNode; lead?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <header className="mb-6 sm:mb-8">
      {back}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="display-narrow text-2xl text-ink sm:text-3xl">{title}</h1>
          {lead && <p className="mt-1.5 max-w-2xl text-sm text-ink-soft sm:text-base">{lead}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/**
 * Heading row used above every content block: title, optional one-line context,
 * optional "see all" link. Consistent everywhere so sections read as one system.
 */
export function SectionHeader({
  title,
  lead,
  to,
  linkLabel = "See all",
  action,
  className,
}: {
  title: ReactNode;
  lead?: ReactNode;
  to?: string;
  linkLabel?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="display-narrow text-lg text-ink sm:text-xl">{title}</h2>
        {lead && <p className="mt-0.5 truncate text-xs text-ink-soft sm:text-sm">{lead}</p>}
      </div>
      {action ??
        (to && (
          <Link
            to={to}
            className="press group -mr-2 inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-full px-3 text-xs font-bold text-cobalt-bright hover:bg-cobalt-wash sm:text-sm"
          >
            {linkLabel}
            <ChevronRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ))}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border-2 border-dashed border-grout-deep bg-tile-dim px-6 py-10 text-center">
      <p className="font-bold text-ink">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * One number and what it means. The workhorse of both dashboards.
 *
 * `tone` colours only the accent rail and the icon chip, never the figure
 * itself — a money amount has to stay readable, and the escrow palette already
 * carries meaning elsewhere.
 */
export function StatCard({
  label,
  value,
  note,
  icon,
  tone = "neutral",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "cobalt" | "held" | "released" | "alert";
  className?: string;
}) {
  const tones = {
    neutral: "bg-grout text-ink-mid",
    cobalt: "bg-cobalt-wash text-cobalt",
    held: "bg-ochre-wash text-ochre-deep",
    released: "bg-celadon-wash text-emerald-700",
    alert: "bg-kiln-wash text-kiln-deep",
  };
  return (
    // h-full so a card with no note still matches its neighbours in a row.
    <div className={cn("flex h-full flex-col rounded-[var(--radius-card)] border border-slate-100 bg-white p-4 shadow-[var(--shadow-tile)] sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-xs font-bold break-words text-ink-soft sm:text-sm">{label}</p>
        {icon && <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", tones[tone])}>{icon}</span>}
      </div>
      {/*
        Sans with tabular figures, not the mono face. Mono is right for
        references and inline amounts, but its very wide GH₵ pushes a headline
        figure onto two lines in a half-width card.
      */}
      <p className="mt-2 text-xl font-extrabold tracking-tight tabular-nums text-ink sm:text-2xl">{value}</p>
      {note && <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{note}</p>}
    </div>
  );
}

/** Loading placeholder. Always match the real content box to keep CLS at zero. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} aria-hidden />;
}

export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-slate-100 bg-white shadow-[var(--shadow-tile)]">
      <Skeleton className="aspect-[16/10] rounded-none" />
      <div className="flex flex-col gap-2.5 p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="mt-2 h-9 w-full rounded-full" />
      </div>
    </div>
  );
}

// ── Forms ──────────────────────────────────────────────────────────────────

export function Field({
  label,
  hint,
  error,
  children,
  optional,
  className,
  id: idProp,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  className?: string;
  /** Pass a stable id when something outside needs to link to this field —
   *  an error summary, for instance. Otherwise one is generated. */
  id?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}) {
  const auto = useId();
  const id = idProp ?? auto;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-bold text-ink">
        {label}
        {optional && <span className="ml-1.5 font-normal text-ink-faint">(optional)</span>}
      </label>
      {hint && (
        <p id={hintId} className="-mt-1 text-xs text-ink-soft">
          {hint}
        </p>
      )}
      {children({ id, "aria-describedby": [hintId, errId].filter(Boolean).join(" ") || undefined, "aria-invalid": error ? true : undefined })}
      {error && (
        <p id={errId} className="animate-rise text-xs font-bold text-kiln-deep">
          {error}
        </p>
      )}
    </div>
  );
}

export function ChoiceChip({
  checked,
  onChange,
  children,
  type = "checkbox",
  name,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  type?: "checkbox" | "radio";
  name?: string;
}) {
  return (
    <label
      className={cn(
        "press relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-bold select-none has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-cobalt-bright",
        checked
          ? "border-cobalt-bright bg-cobalt-bright text-white shadow-[var(--shadow-cobalt)]"
          : "border-grout-deep bg-white text-ink-mid hover:border-ink-faint hover:bg-tile-dim",
      )}
    >
      <input type={type} name={name} className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

/**
 * Filter pill for a horizontal rail. Selected state is carried by colour *and*
 * by aria-pressed, so colour is never the only signal.
 */
export function FilterChip({ active, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "press inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-bold whitespace-nowrap",
        active
          ? "bg-cobalt-bright text-white shadow-[var(--shadow-cobalt)]"
          : "border border-grout-deep bg-white text-ink-mid hover:border-ink-faint hover:bg-tile-dim",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * Segmented control with a sliding indicator (Basic / Standard / Premium).
 * The indicator is one element that translates, so the movement reads as the
 * same object relocating rather than two things blinking.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: Array<{ id: T; label: string; sub?: string }>;
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
}) {
  const index = Math.max(0, options.findIndex((o) => o.id === value));
  return (
    <div role="tablist" aria-label={label} className={cn("relative grid gap-1 rounded-[var(--radius-tile)] bg-grout p-1.5", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      <span
        aria-hidden
        className="absolute inset-y-1.5 left-1.5 rounded-xl bg-white shadow-[var(--shadow-tile)] transition-transform duration-[var(--dur-move)] ease-[var(--ease-spring)]"
        style={{
          width: `calc((100% - 0.75rem - ${(options.length - 1) * 0.25}rem) / ${options.length})`,
          transform: `translateX(calc(${index} * (100% + 0.25rem)))`,
        }}
      />
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={cn(
              "press-sm relative z-10 flex min-h-11 flex-col items-center justify-center rounded-xl px-2 text-xs font-bold transition-colors duration-[var(--dur-quick)]",
              active ? "text-cobalt" : "text-ink-soft hover:text-ink",
            )}
          >
            <span>{o.label}</span>
            {o.sub && <span className={cn("text-[10px] font-semibold", active ? "text-cobalt-lift" : "text-ink-faint")}>{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── Status ─────────────────────────────────────────────────────────────────

const STATUS: Record<JobStatus, { label: string; cls: string }> = {
  requested: { label: "Requested", cls: "bg-grout text-ink-mid border-grout-deep" },
  quoted: { label: "Accepted · awaiting payment", cls: "bg-cobalt-wash text-cobalt border-cobalt-edge" },
  declined: { label: "Declined", cls: "bg-grout text-ink-soft border-grout-deep" },
  cancelled: { label: "Withdrawn", cls: "bg-grout text-ink-soft border-grout-deep" },
  in_progress: { label: "Paid · in progress", cls: "bg-ochre-wash text-ochre-deep border-ochre/35" },
  completed: { label: "Done · awaiting check", cls: "bg-ochre-wash text-ochre-deep border-ochre/35" },
  confirmed: { label: "Confirmed · payout queued", cls: "bg-celadon-wash text-emerald-700 border-celadon/35" },
  disputed: { label: "Disputed", cls: "bg-kiln-wash text-kiln-deep border-kiln/30" },
  closed: { label: "Closed", cls: "bg-grout text-ink-soft border-grout-deep" },
};

export function StatusPill({ status, className }: { status: JobStatus; className?: string }) {
  const s = STATUS[status];
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold", s.cls, className)}>{s.label}</span>;
}

export function statusLabel(status: JobStatus) {
  return STATUS[status].label;
}

export function VerifiedBadge({ status, compact, variant = "id" }: { status: VerificationStatus; compact?: boolean; variant?: "id" | "top_rated" }) {
  if (status !== "verified") return null;

  if (variant === "top_rated") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-cobalt-edge bg-white/95 px-2.5 py-1 text-xs font-extrabold text-cobalt shadow-[var(--shadow-flush)] backdrop-blur-sm">
        <Star className="size-3 fill-cobalt-bright text-cobalt-bright" aria-hidden />
        Top rated
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-celadon/30 bg-celadon-wash px-2.5 py-1 text-xs font-bold text-emerald-700"
      title="Ghana Card checked by our team"
    >
      <BadgeCheck className="size-3.5" aria-hidden />
      {compact ? <span className="sr-only">Verified</span> : "Verified"}
    </span>
  );
}

// ── Ratings ────────────────────────────────────────────────────────────────

export function Stars({ value, count, size = "sm" }: { value: number | null; count?: number; size?: "sm" | "md" }) {
  if (value === null) return <span className="text-xs font-semibold text-ink-faint">New worker</span>;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", size === "md" ? "text-sm" : "text-xs")}>
      <span className="inline-flex items-center" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={cn(size === "md" ? "size-4" : "size-3", i <= Math.round(value) ? "fill-ochre text-ochre" : "fill-grout-deep text-grout-deep")} />
        ))}
      </span>
      <span className="font-extrabold text-ink">{value.toFixed(1)}</span>
      {count !== undefined && <span className="font-medium text-ink-faint">({count})</span>}
      <span className="sr-only">
        {value.toFixed(1)} out of 5{count !== undefined ? ` from ${count} reviews` : ""}
      </span>
    </span>
  );
}

export function StarInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-2 font-bold text-ink">{label}</legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <label key={i} className="cursor-pointer rounded-lg p-1 transition-transform active:scale-90 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-cobalt-bright">
            <input type="radio" name={name} value={i} checked={value === i} onChange={() => onChange(i)} className="sr-only" />
            <Star className={cn("size-8 transition-colors duration-[var(--dur-quick)]", i <= value ? "fill-ochre text-ochre" : "fill-transparent text-grout-deep hover:text-ink-faint")} aria-hidden />
            <span className="sr-only">
              {i} star{i > 1 ? "s" : ""}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ── People ─────────────────────────────────────────────────────────────────

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  id?: string;
  src?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const dims = { sm: "size-9 text-xs", md: "size-11 text-sm", lg: "size-14 text-base", xl: "size-20 text-xl" }[size];

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setImgError(true)}
        className={cn("shrink-0 rounded-full border-2 border-white object-cover shadow-[var(--shadow-flush)]", dims, className)}
      />
    );
  }

  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const bgClasses = [
    "bg-gradient-to-br from-cobalt-bright to-indigo-600",
    "bg-gradient-to-br from-teal-accent to-emerald-600",
    "bg-gradient-to-br from-cobalt to-cobalt-deep",
    "bg-gradient-to-br from-violet-600 to-fuchsia-600",
    "bg-gradient-to-br from-cyan-600 to-cobalt-bright",
  ];

  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full font-extrabold text-white shadow-[var(--shadow-flush)] select-none", dims, bgClasses[hash % bgClasses.length], className)} aria-hidden>
      {initials(name)}
    </span>
  );
}

// ── Dialog ─────────────────────────────────────────────────────────────────

export function Dialog({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={cn(
        "m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] overflow-auto rounded-[var(--radius-sheet)] bg-white p-0 text-ink shadow-[var(--shadow-lift)] backdrop:bg-ink/55 backdrop:backdrop-blur-sm",
        "open:animate-sheet",
        wide ? "max-w-2xl" : "max-w-lg",
      )}
    >
      {open && (
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id={titleId} className="display-narrow text-xl sm:text-2xl">
              {title}
            </h2>
            <button onClick={onClose} className="press -m-1 grid size-11 place-items-center rounded-full text-ink-soft hover:bg-grout hover:text-ink" aria-label="Close">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

// ── Misc ───────────────────────────────────────────────────────────────────

export function Gallery({ photos, className }: { photos: Photo[]; className?: string }) {
  if (!photos.length) return null;
  return (
    <ul className={cn("grid grid-cols-2 gap-[3px] overflow-hidden rounded-[var(--radius-card)] bg-grout-deep p-[3px] sm:grid-cols-3", className)}>
      {photos.map((p) => (
        <li key={p.id}>
          <PhotoTile photo={p} />
        </li>
      ))}
    </ul>
  );
}

export function DefinitionRow({ term, children }: { term: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
      <dt className="text-ink-soft">{term}</dt>
      <dd className="text-right font-bold">{children}</dd>
    </div>
  );
}
