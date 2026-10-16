import { Link } from "react-router";
import { ArrowRight, BadgeCheck, Banknote, Coins, Scale, Send, Wallet } from "lucide-react";
import { escrowState, useDb } from "../../data/store";
import { PageHeader, Tile } from "../../components/ui";
import { money } from "../../lib/format";
import { useTitle } from "../../lib/hooks";
import { useReveal } from "../../lib/motion";
import { AdminJobRow, Metrics } from "./shared";

export function AdminOverview() {
  useTitle("Platform overview · Siesie");
  const db = useDb((d) => d);
  const paid = db.jobs.filter((j) => j.payment);
  const sum = (states: string[]) => paid.filter((j) => states.includes(escrowState(j))).reduce((s, j) => s + j.payment!.amount, 0);

  const tasks = [
    { title: "Verify workers", body: "Check identity submissions before profiles go live.", count: db.workers.filter((w) => w.verification === "pending").length, href: "/admin/verifications", icon: BadgeCheck, urgent: false },
    { title: "Release payouts", body: "Confirmed work is ready for its final payment.", count: db.jobs.filter((j) => j.status === "confirmed").length, href: "/admin/payouts", icon: Send, urgent: false },
    { title: "Resolve disputes", body: "Review both sides while payments stay frozen.", count: db.jobs.filter((j) => j.status === "disputed").length, href: "/admin/disputes", icon: Scale, urgent: true },
  ];

  const ref = useReveal<HTMLDivElement>();

  const counts = [
    { n: db.workers.filter((w) => w.verification === "verified").length, label: "verified workers" },
    { n: db.customers.length, label: "customers" },
    { n: db.jobs.filter((j) => ["confirmed", "closed"].includes(j.status) && escrowState(j) !== "refunded").length, label: "completed jobs" },
  ];

  return (
    <div ref={ref}>
      <PageHeader title="Platform overview" lead="All-time activity across tiling, cleaning and home maintenance. Figures come from this prototype's saved records." />

      <Metrics
        items={[
          { label: "Payments collected · GMV", value: money(sum(["held", "disputed", "released", "refunded", "split"])), note: "Gross collections before refunds and fees", tone: "cobalt", icon: <Banknote className="size-4.5" aria-hidden /> },
          { label: "Held for jobs", value: money(sum(["held"])), note: "Includes confirmed payouts awaiting release", tone: "held", icon: <Wallet className="size-4.5" aria-hidden /> },
          { label: "Frozen in disputes", value: money(sum(["disputed"])), tone: "alert", icon: <Scale className="size-4.5" aria-hidden /> },
          { label: "Commission earned", value: money(paid.reduce((s, j) => s + (j.payout?.status === "sent" ? j.payout.commission : 0), 0)), note: "Fees on completed transfers only", tone: "released", icon: <Coins className="size-4.5" aria-hidden /> },
        ]}
      />

      <dl data-reveal="fade" className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        {counts.map((c) => (
          <div key={c.label} className="flex items-baseline gap-1.5">
            <dt className="sr-only">{c.label}</dt>
            <dd className="figure font-bold text-ink">{c.n}</dd>
            <span className="text-ink-soft">{c.label}</span>
          </div>
        ))}
      </dl>

      <h2 className="display-narrow mt-9 mb-4 text-xl">Needs attention</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {tasks.map((task, i) => (
          <Link
            key={task.href}
            to={task.href}
            data-reveal="pop"
            style={{ ["--i" as string]: i }}
            className="card-press group flex flex-col rounded-[var(--radius-card)] border border-slate-100 bg-white p-5 shadow-[var(--shadow-tile)] hover:border-cobalt-edge"
          >
            <div className="flex items-start justify-between gap-3">
              <span className={task.urgent && task.count ? "grid size-10 place-items-center rounded-xl bg-kiln-wash text-kiln-deep" : "grid size-10 place-items-center rounded-xl bg-cobalt-wash text-cobalt"}>
                <task.icon className="size-5" aria-hidden />
              </span>
              <span className={task.urgent && task.count ? "figure rounded-full bg-kiln-deep px-2.5 py-0.5 font-bold text-white" : "figure rounded-full bg-cobalt-wash px-2.5 py-0.5 font-bold text-cobalt"}>{task.count}</span>
            </div>
            <h3 className="display-narrow mt-3 text-lg">{task.title}</h3>
            <p className="mt-1.5 flex-1 text-sm text-ink-soft">{task.body}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-cobalt">
              Open queue
              <ArrowRight className="size-4 transition-transform duration-[var(--dur-quick)] group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        ))}
      </div>

      <Tile data-reveal className="mt-8 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="display-narrow text-xl">Recent jobs</h2>
          <Link to="/admin/transactions" className="press -mr-2 inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-bold text-cobalt hover:bg-cobalt-wash">
            All transactions
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        {[...db.jobs]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 6)
          .map((j) => (
            <AdminJobRow key={j.id} job={j} href={j.status === "disputed" ? `/admin/disputes/${j.id}` : undefined} />
          ))}
      </Tile>
    </div>
  );
}
