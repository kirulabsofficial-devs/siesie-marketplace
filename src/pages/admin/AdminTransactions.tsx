import { useState } from "react";
import { Link } from "react-router";
import { escrowState, findCustomer, findWorker, useDb } from "../../data/store";
import { EmptyState, Field, PageHeader, Tile } from "../../components/ui";
import { Receipt, Timeline } from "../../components/JobParts";
import { dateTime, money } from "../../lib/format";
import { useTitle } from "../../lib/hooks";
import { useReveal } from "../../lib/motion";
import { ChevronDown } from "lucide-react";
import { Metrics } from "./shared";

export function AdminTransactions() {
  useTitle("Transactions · Siesie");
  const db = useDb((d) => d);
  const [query, setQuery] = useState("");
  const [state, setState] = useState("all");
  const [since, setSince] = useState("all");
  const paid = db.jobs.filter((j) => j.payment);
  const jobs = paid.filter((j) => {
    const text = [j.id, j.title, j.payment!.reference, j.payout?.reference, j.refund?.reference, findCustomer(db, j.customerId)?.name, findWorker(db, j.workerId)?.name].join(" ").toLowerCase();
    return text.includes(query.trim().toLowerCase()) && (state === "all" || escrowState(j) === state) && (since === "all" || Date.parse(j.payment!.paidAt) >= Date.now() - Number(since) * 86400_000);
  }).sort((a, b) => b.payment!.paidAt.localeCompare(a.payment!.paidAt));
  const listRef = useReveal<HTMLDivElement>([query, state, since, jobs.length]);
  return <div ref={listRef}>
    <PageHeader title="Transactions" lead="Trace collections, held funds, payouts and refunds. Open a record for its receipt and history." />
    <div className="mb-6 grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
      <Field label="Search transactions">{(p) => <input {...p} className="field" type="search" placeholder="Name, job or reference" value={query} onChange={(e) => setQuery(e.target.value)} />}</Field>
      <Field label="Payment state">{(p) => <select {...p} className="field" value={state} onChange={(e) => setState(e.target.value)}>{["all", "held", "disputed", "released", "refunded", "split"].map((s) => <option key={s} value={s}>{s === "all" ? "All states" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}</select>}</Field>
      <Field label="Collection date">{(p) => <select {...p} className="field" value={since} onChange={(e) => setSince(e.target.value)}><option value="all">All time</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select>}</Field>
    </div>
    <Metrics items={[
      { label: "Matching collections", value: money(jobs.reduce((s, j) => s + j.payment!.amount, 0)), note: `${jobs.length} payment records` },
      { label: "Paid to workers", value: money(jobs.reduce((s, j) => s + (j.payout?.status === "sent" ? j.payout.net : 0), 0)) },
      { label: "Refunded to customers", value: money(jobs.reduce((s, j) => s + (j.refund?.amount ?? 0), 0)) },
      { label: "Commission collected", value: money(jobs.reduce((s, j) => s + (j.payout?.status === "sent" ? j.payout.commission : 0), 0)) },
    ]} />
    <div className="mt-6 flex flex-col gap-3">
      {!jobs.length && <EmptyState title="No matching transactions." body="Try another name, reference or payment state." />}
      {jobs.map((j, i) => <Tile key={j.id} as="div" className="overflow-hidden" data-reveal style={{ ["--i" as string]: Math.min(i, 8) }}>
        <details className="group">
          {/* list-none kills the native triangle; the chevron on the right is
              the affordance and it rotates to show the open state. */}
          <summary className="flex cursor-pointer list-none items-start gap-3 p-5 transition-colors hover:bg-tile-dim [&::-webkit-details-marker]:hidden">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-bold text-ink">{j.title}</span>
                <span className="figure font-bold text-cobalt">{money(j.payment!.amount)}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-sm text-ink-soft">
                <span>{findCustomer(db, j.customerId)?.name} → {findWorker(db, j.workerId)?.name}</span>
                <span className="font-bold capitalize">{escrowState(j)}</span>
              </div>
              <p className="figure mt-2 text-xs break-all text-ink-faint">{j.id} · {j.payment!.reference} · {dateTime(j.payment!.paidAt)}</p>
            </div>
            <ChevronDown className="mt-0.5 size-5 shrink-0 text-ink-faint transition-transform duration-[var(--dur-move)] group-open:rotate-180" aria-hidden />
          </summary>
          <div className="grid gap-4 border-t border-grout bg-tile-dim p-4 lg:grid-cols-2"><Receipt job={j} perspective="admin" /><Timeline job={j} />{j.dispute && <Link to={`/admin/disputes/${j.id}`} className="press inline-flex min-h-11 items-center self-start rounded-full bg-cobalt-wash px-4 text-sm font-bold text-cobalt hover:bg-cobalt-bright hover:text-white">View dispute record</Link>}</div>
        </details>
      </Tile>)}
    </div>
  </div>;
}
