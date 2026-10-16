import { useState } from "react";
import { Link } from "react-router";
import { ArrowDownToLine, Clock3, Wallet } from "lucide-react";
import { jobCommissionPct, useDb } from "../../data/store";
import { EmptyState, Field, PageHeader, StatCard, Tile } from "../../components/ui";
import { commissionOn, date, money } from "../../lib/format";
import { useTitle } from "../../lib/hooks";
import { useReveal } from "../../lib/motion";

export function WorkerEarnings() {
  useTitle("Earnings · Siesie");
  const db = useDb((d) => d);
  const [period, setPeriod] = useState("all");

  const jobs = db.jobs.filter((j) => j.workerId === db.session?.userId && j.payment);
  const sent = jobs.filter((j) => j.payout?.status === "sent" && (period === "all" || Date.parse(j.payout.sentAt!) >= Date.now() - Number(period) * 86400_000));
  const queued = jobs.filter((j) => j.payout?.status === "queued");
  const pending = jobs.filter((j) => ["in_progress", "completed"].includes(j.status));
  const records = [...jobs]
    .filter((j) => j.payout && (j.payout.status === "queued" || sent.includes(j)))
    .sort((a, b) => (b.payout!.sentAt ?? b.payout!.queuedAt).localeCompare(a.payout!.sentAt ?? a.payout!.queuedAt));

  const ref = useReveal<HTMLDivElement>([period, records.length]);

  const cards = [
    { label: "Paid to you", value: sent.reduce((n, j) => n + j.payout!.net, 0), tone: "released" as const, icon: <ArrowDownToLine className="size-4.5" aria-hidden /> },
    { label: "Queued for release · all time", value: queued.reduce((n, j) => n + j.payout!.net, 0), tone: "held" as const, icon: <Clock3 className="size-4.5" aria-hidden /> },
    { label: "Expected from ongoing jobs", value: pending.reduce((n, j) => n + commissionOn(j.payment!.amount, jobCommissionPct(db, j)).net, 0), tone: "cobalt" as const, icon: <Wallet className="size-4.5" aria-hidden /> },
  ];

  return (
    <div ref={ref}>
      <PageHeader title="Earnings" lead="Follow each payment from held funds to your mobile money wallet or bank account." />

      <Field label="Paid out during" className="mb-5 max-w-xs">
        {(p) => (
          <select {...p} className="field" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="all">All time</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        )}
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c, i) => (
          <div key={c.label} data-reveal="pop" style={{ ["--i" as string]: i }} className="h-full">
            <StatCard label={c.label} value={money(c.value)} tone={c.tone} icon={c.icon} />
          </div>
        ))}
      </div>

      <h2 className="display-narrow mt-8 mb-3 text-xl">Payout history</h2>

      {!records.length ? (
        <EmptyState title="No payouts in this period." body="Confirmed jobs appear here as soon as a payout is queued." />
      ) : (
        <ul className="flex flex-col gap-3">
          {records.map((j, i) => (
            <li key={j.id} data-reveal style={{ ["--i" as string]: Math.min(i, 8) }}>
              <Tile className="card-press flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="min-w-0">
                  <Link className="font-bold text-cobalt hover:underline" to={`/work/jobs/${j.id}`}>
                    {j.title}
                  </Link>
                  <p className="mt-1 text-sm text-ink-soft">
                    {date(j.payout!.sentAt ?? j.payout!.queuedAt)} · {j.payout!.destination}
                  </p>
                  <p className="figure mt-1 text-xs break-all text-ink-faint">{j.payout!.reference}</p>
                </div>
                <div className="text-right">
                  <p className="figure text-lg font-bold text-ink">{money(j.payout!.net)}</p>
                  <p
                    className={cnStatus(j.payout!.status)}
                  >
                    {j.payout!.status === "sent" ? "Paid out" : "Queued"}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">Fee {money(j.payout!.commission)}</p>
                </div>
              </Tile>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-5 text-sm text-ink-soft">Disputed funds stay frozen and are excluded from expected earnings. Refunds are shown on the relevant job.</p>
    </div>
  );
}

function cnStatus(status: "sent" | "queued") {
  return status === "sent"
    ? "mt-1 inline-flex rounded-full bg-celadon-wash px-2 py-0.5 text-xs font-bold text-emerald-700"
    : "mt-1 inline-flex rounded-full bg-ochre-wash px-2 py-0.5 text-xs font-bold text-ochre-deep";
}
