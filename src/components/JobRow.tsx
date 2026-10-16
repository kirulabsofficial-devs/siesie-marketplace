import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import type { Job } from "../data/types";
import { SERVICES } from "../config";
import { escrowState } from "../data/store";
import { MoneyGlyph } from "./MoneyTrack";
import { StatusPill } from "./ui";
import { ServiceIcon } from "./ServiceRail";
import { money } from "../lib/format";
import { cn } from "../lib/cn";

export function JobRow({ job, href, counterpart, hint, urgent }: { job: Job; href: string; counterpart: string; hint?: string; urgent?: boolean }) {
  const amount = job.payment?.amount ?? job.quote?.amount;
  return (
    <Link
      to={href}
      className={cn(
        "card-press group relative grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2.5 overflow-hidden rounded-[var(--radius-card)] border bg-white p-4 shadow-[var(--shadow-tile)] sm:grid-cols-[1fr_auto_auto] sm:p-5",
        urgent ? "border-cobalt-edge" : "border-slate-100 hover:border-cobalt-edge",
      )}
    >
      {/* Urgent rows get an edge mark rather than a full ring, so a list of
          them still reads as a list instead of a wall of outlines. */}
      {urgent && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-cobalt-bright" />}

      <div className={cn("min-w-0", urgent && "pl-2")}>
        <p className="truncate text-[1.0625rem] font-bold text-ink transition-colors group-hover:text-cobalt-bright">{job.title}</p>
        <p className="mt-0.5 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-1.5"><ServiceIcon service={job.service} size={15} />{SERVICES[job.service].label}</span> · {counterpart} · <span className="figure">{job.id}</span>
        </p>
        {hint && <p className={cn("mt-1.5 text-[0.9375rem] font-bold", urgent ? "text-cobalt" : "text-ink-mid")}>{hint}</p>}
      </div>

      <div className="col-span-2 row-start-2 flex flex-wrap items-center gap-3 sm:col-span-1 sm:row-start-auto sm:flex-col sm:items-end sm:gap-1.5">
        <StatusPill status={job.status} />
        {amount !== undefined && (
          <span className="inline-flex items-center gap-2 text-sm">
            <MoneyGlyph state={escrowState(job)} />
            <span className="figure font-bold text-ink">{money(amount)}</span>
          </span>
        )}
      </div>

      <ChevronRight className="col-start-2 row-start-1 size-5 text-ink-faint transition-transform duration-[var(--dur-quick)] group-hover:translate-x-0.5 sm:col-start-3" aria-hidden />
    </Link>
  );
}

export function JobGroup({ title, children, count }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="display-narrow mb-3 flex items-baseline gap-2 text-base">
        {title}
        <span className="figure text-sm font-normal text-ink-soft">{count}</span>
      </h2>
      <ul className="grid gap-3">{children}</ul>
    </section>
  );
}
