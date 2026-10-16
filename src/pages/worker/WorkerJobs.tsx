import type { Job } from "../../data/types";
import { BRAND } from "../../config";
import { findCustomer, useDb } from "../../data/store";
import { JobGroup, JobRow } from "../../components/JobRow";
import { EmptyState, PageHeader } from "../../components/ui";
import { firstName, money, timeLeft } from "../../lib/format";
import { useNow, useTitle } from "../../lib/hooks";
import { useReveal } from "../../lib/motion";

export function WorkerJobs() {
  useTitle(`Jobs · ${BRAND.name}`);
  useNow();
  const userId = useDb((d) => d.session!.userId);
  const jobs = useDb((d) => d.jobs.filter((j) => j.workerId === userId && j.status !== "requested").sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  const customerName = useDb((d) => (id: string) => findCustomer(d, id)?.name ?? "Customer");

  const groups: Array<{ title: string; match: (j: Job) => boolean; urgent?: boolean }> = [
    { title: "Disputes", match: (j) => j.status === "disputed", urgent: true },
    { title: "Paid, ready to start", match: (j) => j.status === "in_progress", urgent: true },
    { title: "Waiting on the customer", match: (j) => j.status === "quoted" || j.status === "completed" },
    { title: "Confirmed, payout on its way", match: (j) => j.status === "confirmed" },
    { title: "Finished", match: (j) => j.status === "closed" },
    { title: "Declined or withdrawn", match: (j) => j.status === "declined" || j.status === "cancelled" },
  ];

  const hint = (j: Job) => {
    const c = firstName(customerName(j.customerId));
    switch (j.status) {
      case "disputed":
        return j.dispute?.workerResponse ? "Your side is in. Waiting for a decision." : "Add your side of the dispute";
      case "in_progress":
        return "Payment held. Mark complete when you're done.";
      case "quoted":
        return `Waiting for ${c} to pay ${money(j.quote!.amount)}`;
      case "completed": {
        const left = j.confirmBy ? timeLeft(j.confirmBy) : null;
        return `${c} is checking the work${left ? ` (${left})` : ""}`;
      }
      case "confirmed":
        return j.payout ? `${money(j.payout.net)} to ${j.payout.destination}` : undefined;
      case "closed":
        return j.payout?.sentAt ? `You received ${money(j.payout.net)}` : j.dispute?.resolution?.outcome === "refund" ? "Refunded to the customer" : undefined;
      default:
        return undefined;
    }
  };

  const ref = useReveal<HTMLDivElement>([jobs.length]);

  return (
    <div ref={ref}>
      <PageHeader title="Jobs" lead="Every job you have accepted, grouped by what it is waiting on." />
      {jobs.length === 0 ? (
        <EmptyState title="No jobs yet." body="Accepted requests appear here once you've sent a price." />
      ) : (
        groups.map((g) => {
          const list = jobs.filter(g.match);
          return (
            <JobGroup key={g.title} title={g.title} count={list.length}>
              {list.map((j, i) => (
                <li key={j.id} data-reveal style={{ ["--i" as string]: Math.min(i, 6) }}>
                  <JobRow job={j} href={`/work/jobs/${j.id}`} counterpart={customerName(j.customerId)} hint={hint(j)} urgent={g.urgent && !(j.status === "disputed" && j.dispute?.workerResponse)} />
                </li>
              ))}
            </JobGroup>
          );
        })
      )}
    </div>
  );
}
