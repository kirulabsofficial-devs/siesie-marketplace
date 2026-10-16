import type { Job } from "../../data/types";
import { BRAND } from "../../config";
import { findWorker, useDb } from "../../data/store";
import { JobGroup, JobRow } from "../../components/JobRow";
import { EmptyState, LinkButton, PageHeader } from "../../components/ui";
import { firstName, money, timeLeft } from "../../lib/format";
import { useNow, useTitle } from "../../lib/hooks";
import { useReveal } from "../../lib/motion";

export function CustomerJobs() {
  useTitle(`My jobs · ${BRAND.name}`);
  useNow();
  const ref = useReveal<HTMLDivElement>();
  const userId = useDb((d) => d.session!.userId);
  const jobs = useDb((d) => d.jobs.filter((j) => j.customerId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  const workerName = useDb((d) => (id: string) => findWorker(d, id)?.name ?? "Worker");

  const needsYou = jobs.filter((j) => j.status === "quoted" || j.status === "completed" || (j.status === "confirmed" && !j.customerReview) || (j.status === "closed" && !j.customerReview && j.dispute?.resolution?.outcome !== "refund"));
  const active = jobs.filter((j) => !needsYou.includes(j) && ["requested", "in_progress", "confirmed", "disputed"].includes(j.status));
  const past = jobs.filter((j) => !needsYou.includes(j) && !active.includes(j));

  const hint = (j: Job) => {
    const w = firstName(workerName(j.workerId));
    switch (j.status) {
      case "quoted":
        return `${w} accepted at ${money(j.quote!.amount)}. Pay to confirm.`;
      case "completed": {
        const left = j.confirmBy ? timeLeft(j.confirmBy) : null;
        return `${w} says it's done. Check the work${left ? ` (${left})` : ""}.`;
      }
      case "confirmed":
      case "closed":
        return j.customerReview ? undefined : `Rate ${w}`;
      case "requested":
        return `Waiting for ${w} to reply`;
      case "in_progress":
        return `${w} is on the job`;
      case "disputed":
        return "Our team is reviewing the dispute";
      default:
        return undefined;
    }
  };

  const row = (j: Job, urgent = false, i = 0) => (
    <li key={j.id} data-reveal style={{ ["--i" as string]: Math.min(i, 6) }}>
      <JobRow job={j} href={`/jobs/${j.id}`} counterpart={workerName(j.workerId)} hint={hint(j)} urgent={urgent} />
    </li>
  );

  return (
    <div ref={ref} className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader title="My jobs" lead="Everything you have booked, with the money state on each one." actions={<LinkButton to="/search">Book a worker</LinkButton>} />
      {jobs.length === 0 ? (
        <EmptyState title="No bookings yet." body="Find a tiler, cleaner or handyman and send a request. You don't pay until they accept." action={<LinkButton to="/search">Find a worker</LinkButton>} />
      ) : (
        <>
          <JobGroup title="Needs you" count={needsYou.length}>
            {needsYou.map((j, i) => row(j, j.status === "quoted" || j.status === "completed", i))}
          </JobGroup>
          <JobGroup title="In progress" count={active.length}>
            {active.map((j, i) => row(j, false, i))}
          </JobGroup>
          <JobGroup title="Past" count={past.length}>
            {past.map((j, i) => row(j, false, i))}
          </JobGroup>
        </>
      )}
    </div>
  );
}
