import { Link } from "react-router";
import type { Job } from "../../data/types";
import { findCustomer, findWorker, useDb } from "../../data/store";
import { Gallery, StatCard, StatusPill, Tile } from "../../components/ui";
import { DISPUTE_REASONS } from "../../config";
import { dateTime, money } from "../../lib/format";

export interface MetricItem {
  label: string;
  value: string;
  note?: string;
  tone?: "neutral" | "cobalt" | "held" | "released" | "alert";
  icon?: React.ReactNode;
}

export function Metrics({ items }: { items: MetricItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, i) => (
        <div key={item.label} data-reveal="pop" style={{ ["--i" as string]: i }} className="h-full">
          <StatCard label={item.label} value={item.value} note={item.note} tone={item.tone} icon={item.icon} />
        </div>
      ))}
    </div>
  );
}

export function AdminJobRow({ job, href }: { job: Job; href?: string }) {
  const names = useDb((d) => ({ customer: findCustomer(d, job.customerId)?.name, worker: findWorker(d, job.workerId)?.name }));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-grout py-4 last:border-0">
      <div className="min-w-0">
        <p className="font-bold">
          {href ? (
            <Link to={href} className="text-cobalt transition-colors hover:text-cobalt-bright hover:underline">
              {job.title}
            </Link>
          ) : (
            job.title
          )}
        </p>
        <p className="text-sm text-ink-soft">
          {names.customer} → {names.worker}
        </p>
        <p className="figure mt-1 text-xs text-ink-faint">{job.id}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="figure font-bold text-ink">{money(job.payment?.amount ?? job.quote?.amount ?? 0)}</span>
        <StatusPill status={job.status} />
      </div>
    </div>
  );
}

export function DisputeEvidence({ job }: { job: Job }) {
  const d = job.dispute;
  if (!d) return null;
  return (
    <div className="flex flex-col gap-5">
      <Tile className="p-5">
        <h2 className="display-narrow text-lg">Customer's report</h2>
        <p className="mt-2 inline-flex rounded-full bg-kiln-wash px-2.5 py-1 text-sm font-bold text-kiln-deep">{DISPUTE_REASONS[d.reason]}</p>
        <p className="mt-1.5 text-xs text-ink-soft">{dateTime(d.openedAt)}</p>
        <p className="mt-4 whitespace-pre-line text-ink-mid">{d.details}</p>
        <Gallery className="mt-4" photos={d.evidence} />
        {!d.evidence.length && <p className="mt-3 text-sm text-ink-soft">No photos provided.</p>}
      </Tile>

      <Tile className="p-5">
        <h2 className="display-narrow text-lg">Worker's response</h2>
        {d.workerResponse ? (
          <>
            <p className="mt-1.5 text-xs text-ink-soft">{dateTime(d.workerResponse.at)}</p>
            <p className="mt-4 whitespace-pre-line text-ink-mid">{d.workerResponse.text}</p>
            <Gallery className="mt-4" photos={d.workerResponse.evidence} />
          </>
        ) : (
          <p className="mt-3 text-ink-soft">The worker has not responded yet. Review the available evidence and contact both parties before deciding.</p>
        )}
      </Tile>

      {job.completedAt && (
        <Tile className="p-5">
          <h2 className="display-narrow text-lg">Completion record</h2>
          <p className="mt-3 text-ink-mid">{job.completionNote || "No completion note."}</p>
          <Gallery className="mt-4" photos={job.completionPhotos ?? []} />
        </Tile>
      )}
    </div>
  );
}
