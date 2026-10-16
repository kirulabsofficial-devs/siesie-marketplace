import { useState } from "react";
import { Link } from "react-router";
import { CalendarDays, Clock3, MapPin, ShieldAlert, ShieldCheck, Star, Wallet } from "lucide-react";
import type { Job, Worker } from "../../data/types";
import { BRAND, SERVICES } from "../../config";
import { findCustomer, findWorker, jobCommissionPct, resubmitVerification, useDb, workerStats } from "../../data/store";
import { Button, EmptyState, Field, Gallery, StatCard, Stars, Tile } from "../../components/ui";
import { JobGroup, JobRow } from "../../components/JobRow";
import { useAction } from "../../components/Toast";
import { ago, commissionOn, firstName, money, weekday } from "../../lib/format";
import { useTitle } from "../../lib/hooks";
import { useReveal } from "../../lib/motion";
import { AcceptDialog, DeclineDialog } from "./dialogs";

export function WorkerRequests() {
  useTitle(`Requests · ${BRAND.name}`);
  const userId = useDb((d) => d.session!.userId);
  const worker = useDb((d) => findWorker(d, userId))!;
  const stats = useDb((d) => workerStats(d, userId));
  const db = useDb((d) => d);
  const jobs = useDb((d) => d.jobs.filter((j) => j.workerId === userId));
  const customerName = useDb((d) => (id: string) => findCustomer(d, id)?.name ?? "Customer");

  const requests = jobs.filter((j) => j.status === "requested").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const awaitingPay = jobs.filter((j) => j.status === "quoted");
  const toDo = jobs.filter((j) => j.status === "in_progress");

  const net = (j: Job) => commissionOn(j.payment!.amount, jobCommissionPct(db, j)).net;
  const held = jobs.filter((j) => j.status === "in_progress" || j.status === "completed").reduce((s, j) => s + net(j), 0);
  const queued = jobs.filter((j) => j.status === "confirmed").reduce((s, j) => s + (j.payout?.net ?? 0), 0);
  const monthAgo = Date.now() - 30 * 86400_000;
  const paidOut = jobs.filter((j) => j.payout?.sentAt && new Date(j.payout.sentAt).getTime() > monthAgo).reduce((s, j) => s + j.payout!.net, 0);

  const ref = useReveal<HTMLDivElement>([requests.length, toDo.length, awaitingPay.length]);

  return (
    <div ref={ref}>
      <VerificationBanner worker={worker} />

      <header data-reveal="fade">
        <p className="text-sm font-semibold text-ink-soft">Hi {firstName(worker.name)}</p>
        <h1 className="display mt-1 text-[1.875rem] sm:text-[2.5rem]">Your requests</h1>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div data-reveal="pop" style={{ ["--i" as string]: 0 }} className="h-full">
          <StatCard label="Held for jobs in progress" value={money(held)} tone="held" icon={<Clock3 className="size-4.5" aria-hidden />} />
        </div>
        <div data-reveal="pop" style={{ ["--i" as string]: 1 }} className="h-full">
          <StatCard label="Confirmed, being sent" value={money(queued)} tone="held" icon={<Wallet className="size-4.5" aria-hidden />} />
        </div>
        <div data-reveal="pop" style={{ ["--i" as string]: 2 }} className="h-full">
          <StatCard label="Paid to you, last 30 days" value={money(paidOut)} tone="released" icon={<ShieldCheck className="size-4.5" aria-hidden />} />
        </div>
        <div data-reveal="pop" style={{ ["--i" as string]: 3 }} className="h-full">
          <StatCard label="Your rating" value={<Stars value={stats.rating} count={stats.reviews} size="md" />} tone="cobalt" icon={<Star className="size-4.5" aria-hidden />} />
        </div>
      </div>

      <section className="mt-10" aria-labelledby="req-h">
        <h2 id="req-h" className="display-narrow mb-3 flex items-baseline gap-2 text-xl">
          New requests <span className="figure text-base font-normal text-ink-soft">{requests.length}</span>
        </h2>
        {requests.length === 0 ? (
          <EmptyState title="No new requests." body="Requests from customers show up here. Keep your areas and availability up to date so the right jobs find you." />
        ) : (
          <ul className="grid gap-4">
            {requests.map((j, i) => (
              <li key={j.id} data-reveal style={{ ["--i" as string]: Math.min(i, 6) }}>
                <RequestCard job={j} worker={worker} customerName={customerName(j.customerId)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-10">
        <JobGroup title="Paid, ready to start" count={toDo.length}>
          {toDo.map((j) => (
            <li key={j.id}>
              <JobRow job={j} href={`/work/jobs/${j.id}`} counterpart={customerName(j.customerId)} hint="Payment held. Mark complete when you're done." urgent />
            </li>
          ))}
        </JobGroup>
        <JobGroup title="Waiting for the customer to pay" count={awaitingPay.length}>
          {awaitingPay.map((j) => (
            <li key={j.id}>
              <JobRow job={j} href={`/work/jobs/${j.id}`} counterpart={customerName(j.customerId)} hint="Don't start until the payment shows as held" />
            </li>
          ))}
        </JobGroup>
      </div>
    </div>
  );
}

function RequestCard({ job, worker, customerName }: { job: Job; worker: Worker; customerName: string }) {
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const pending = worker.verification !== "verified";
  return (
    <Tile as="article" className="card-press p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="display-narrow text-lg">
            <Link to={`/work/jobs/${job.id}`} className="hover:text-cobalt-bright">
              {job.title}
            </Link>
          </h3>
          <p className="mt-0.5 text-sm text-ink-soft">
            {SERVICES[job.service].label} · from {firstName(customerName)} · {ago(job.createdAt)}
          </p>
        </div>
        <span className="eyebrow shrink-0 rounded-full bg-cobalt-wash px-2.5 py-1 text-cobalt">New</span>
      </div>

      <p className="mt-3 line-clamp-3 text-[1.0625rem] text-ink-mid">{job.scope}</p>
      {job.photos.length > 0 && <Gallery photos={job.photos} className="mt-3 max-w-md" />}

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.9375rem] text-ink-mid">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-4 text-ink-faint" aria-hidden />
          {job.area}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-4 text-ink-faint" aria-hidden />
          Wants {weekday(job.preferredDate)}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-grout pt-4">
        <Button onClick={() => setAccepting(true)} disabled={pending}>
          Accept and set price
        </Button>
        <Button variant="secondary" onClick={() => setDeclining(true)} disabled={pending}>
          Decline
        </Button>
      </div>

      <AcceptDialog job={job} worker={worker} customerName={customerName} open={accepting} onClose={() => setAccepting(false)} />
      <DeclineDialog job={job} open={declining} onClose={() => setDeclining(false)} />
    </Tile>
  );
}

function VerificationBanner({ worker }: { worker: Worker }) {
  const run = useAction();
  const [card, setCard] = useState(worker.ghanaCard?.number ?? "");
  if (worker.verification === "verified") return null;

  if (worker.verification === "pending") {
    return (
      <div className="animate-rise mb-8 flex items-start gap-3 rounded-[var(--radius-card)] border border-ochre/40 bg-ochre-wash p-5">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ochre-deep" aria-hidden />
        <div>
          <p className="font-bold text-ink">We're checking your Ghana Card</p>
          <p className="mt-1 text-sm text-ink-mid">You'll see an update here when you're verified. Until then, customers can't find your profile or send you requests.</p>
        </div>
      </div>
    );
  }

  const valid = /^GHA-\d{9}-\d$/i.test(card.trim());
  return (
    <div className="animate-rise mb-8 rounded-[var(--radius-card)] border border-kiln/35 bg-kiln-wash p-5">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-kiln-deep" aria-hidden />
        <div>
          <p className="font-bold text-ink">Your verification wasn't approved</p>
          {worker.verificationNote && <p className="mt-1 text-sm text-ink-mid">{worker.verificationNote}</p>}
          <Link className="mt-3 inline-block text-sm font-bold text-cobalt underline underline-offset-4" to="/work/profile">
            Update identity photos and profile
          </Link>
        </div>
      </div>
      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) run(() => resubmitVerification(worker.id, card.trim().toUpperCase()), "Resubmitted. We'll check it again.");
        }}
      >
        <Field label="Ghana Card number" className="flex-1" error={card && !valid ? "Use the format GHA-123456789-0." : null}>
          {(p) => <input {...p} className="field figure" value={card} onChange={(e) => setCard(e.target.value)} />}
        </Field>
        <Button type="submit" disabled={!valid}>
          Resubmit for checking
        </Button>
      </form>
    </div>
  );
}
