import { useState } from "react";
import { Link } from "react-router";
import { useDb } from "../../data/store";
import { DISPUTE_REASONS } from "../../config";
import { ChoiceChip, EmptyState, PageHeader, Tile } from "../../components/ui";
import { dateTime } from "../../lib/format";
import { useTitle } from "../../lib/hooks";
import { useReveal } from "../../lib/motion";
import { ArrowRight } from "lucide-react";
import { AdminJobRow } from "./shared";

export function AdminDisputes() {
  useTitle("Disputes · Siesie");
  const [resolved, setResolved] = useState(false);
  const jobs = useDb((d) => d.jobs.filter((j) => j.dispute && (resolved ? !!j.dispute.resolution : j.status === "disputed")).sort((a, b) => a.dispute!.openedAt.localeCompare(b.dispute!.openedAt)));
  const listRef = useReveal<HTMLDivElement>([resolved, jobs.length]);
  return <div ref={listRef}>
    <PageHeader title="Disputes" lead="Work through the oldest cases first. Funds stay frozen until a decision is recorded." />
    <div className="mb-6 flex gap-2"><ChoiceChip type="radio" name="cases" checked={!resolved} onChange={() => setResolved(false)}>Open cases</ChoiceChip><ChoiceChip type="radio" name="cases" checked={resolved} onChange={() => setResolved(true)}>Resolved cases</ChoiceChip></div>
    {!jobs.length ? <EmptyState title={resolved ? "No resolved cases." : "No open disputes."} body="Reported problems appear here with the customer's explanation and supporting photos." /> : <div className="flex flex-col gap-4">{jobs.map((j, i) => <Tile className="px-5 pb-5" key={j.id} data-reveal style={{ ["--i" as string]: Math.min(i, 8) }}><AdminJobRow job={j} href={`/admin/disputes/${j.id}`} /><p className="mt-3 inline-flex rounded-full bg-kiln-wash px-2.5 py-1 text-sm font-bold text-kiln-deep">{DISPUTE_REASONS[j.dispute!.reason]}</p><p className="mt-2 line-clamp-2 text-ink-soft">{j.dispute!.details}</p><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-ink-soft">Opened {dateTime(j.dispute!.openedAt)} · {j.dispute!.resolution ? "Decision recorded" : j.dispute!.workerResponse ? "Worker has responded" : "Awaiting worker response"}</p><Link className="press group inline-flex min-h-10 items-center gap-1.5 rounded-full bg-cobalt-wash px-4 text-sm font-bold text-cobalt hover:bg-cobalt-bright hover:text-white" to={`/admin/disputes/${j.id}`}>{resolved ? "View decision" : "Review case"}<ArrowRight className="size-4 transition-transform duration-[var(--dur-quick)] group-hover:translate-x-0.5" aria-hidden /></Link></div></Tile>)}</div>}
  </div>;
}
