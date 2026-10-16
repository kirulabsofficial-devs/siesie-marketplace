import { Link } from "react-router";
import { BRAND } from "../config";
import { cn } from "../lib/cn";

/** The supplied symbol in kente colours, with a monochrome option for watermarks. */
export function BrandMark({ className, onCobalt }: { className?: string; onCobalt?: boolean }) {
  return (
    <span className={cn("brand-mark", onCobalt && "brand-mark-light", className)} aria-hidden="true" />
  );
}

export function Brand({ to = "/", onCobalt, suffix }: { to?: string; onCobalt?: boolean; suffix?: string }) {
  return (
    <Link to={to} aria-label={`${BRAND.name}${suffix ? ` ${suffix}` : ""} home`} className={cn("brand-lockup", onCobalt && "brand-lockup-light")}>
      <span className="brand-signature" aria-hidden="true">
        <BrandMark onCobalt={onCobalt} />
        <span className="brand-wordmark">{BRAND.name}</span>
      </span>
      {suffix && <span className={cn("rounded-full border px-2 py-0.5 text-xs font-bold", onCobalt ? "border-tile/40 text-tile/85" : "border-grout-deep text-ink-soft")}>{suffix}</span>}
    </Link>
  );
}
