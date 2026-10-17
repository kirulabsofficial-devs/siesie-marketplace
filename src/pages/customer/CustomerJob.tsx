import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft, Phone } from "lucide-react";
import { BRAND, DISPUTE_REASONS } from "../../config";
import { cancelRequest, confirmCompletion, findCustomer, findJob, findWorker, leaveReview, openDispute, recordPayment, refreshSession, useDb, workerStats } from "../../data/store";
import { JobMoneyTrack } from "../../components/MoneyTrack";
import { DisputeDialog, JobDetails, Receipt, ReviewForm, Timeline } from "../../components/JobParts";
import { PaystackCheckout } from "../../components/PaystackCheckout";
import { Avatar, Button, Dialog, Gallery, LinkButton, Stars, StatusPill, Tile, VerifiedBadge } from "../../components/ui";
import { MessageLink } from "../../components/MessageLink";
import { useAction, useToast } from "../../components/Toast";
import { LIVE_BACKEND } from "../../data/runtime";
import { verifyLiveCheckout } from "../../payments/paystack";
import { date, dateTime, firstName, money, phone, timeLeft, weekday } from "../../lib/format";
import { useNow, useTitle } from "../../lib/hooks";
import { NotFound } from "../NotFound";

export function CustomerJob() {
  const { id = "" } = useParams();
  const run = useAction();
  useNow();
  const session = useDb((d) => d.session!);
  const job = useDb((d) => findJob(d, id));
  const worker = useDb((d) => (job ? findWorker(d, job.workerId) : undefined));
  const customer = useDb((d) => findCustomer(d, session.userId));
  const stats = useDb((d) => (job ? workerStats(d, job.workerId) : null));
  const settings = useDb((d) => d.settings);
  const [paying, setPaying] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const returning = usePaymentReturn(job?.status);
  useTitle(`${job?.title ?? "Job"} · ${BRAND.name}`);

  if (!job || !worker || !customer || job.customerId !== session.userId) return <NotFound />;
  const w = firstName(worker.name);
  const amount = job.payment?.amount ?? job.quote?.amount ?? 0;
  const paid = !!job.payment;

  let panel: React.ReactNode = null;
  switch (job.status) {
    case "requested":
      panel = (
        <ActionPanel title={`Waiting for ${w} to reply`}>
          <p>
            {w} will accept with a price and date, or decline. You'll see the update here. Nothing is charged until you pay.
          </p>
          <Button variant="secondary" className="mt-4" onClick={() => run(() => cancelRequest(job.id), "Request withdrawn.")}>
            Withdraw request
          </Button>
        </ActionPanel>
      );
      break;
    case "quoted":
      panel = returning ? (
        <ActionPanel title={returning.waiting ? "Waiting for Paystack" : "Confirming your payment"} tone="cobalt">
          {returning.waiting ? (
            <>
              <p>Paystack hasn't confirmed this payment yet. If money left your account, you don't need to pay again. It will show here once Paystack confirms.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={returning.checkAgain}>Check again</Button>
                <Button variant="ghost" onClick={returning.dismiss}>Back to payment options</Button>
              </div>
            </>
          ) : (
            <p>Paystack is confirming your payment of <span className="figure font-bold">{money(job.quote!.amount)}</span>. This usually takes a few seconds. If you paid with mobile money, approve the prompt on your phone.</p>
          )}
        </ActionPanel>
      ) : (
        <ActionPanel title={`${w} accepted your request`} tone="cobalt">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-ink-soft">Price</p>
              <p className="figure text-3xl font-bold">{money(job.quote!.amount)}</p>
            </div>
            <div>
              <p className="text-sm text-ink-soft">Date</p>
              <p className="text-xl font-bold">{weekday(job.quote!.date)}</p>
            </div>
          </div>
          {job.quote!.note && <p className="mt-3 rounded-[var(--radius-tile)] bg-tile p-3 text-[0.9375rem]">“{job.quote!.note}”</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="lg" onClick={() => setPaying(true)}>
              Pay {money(job.quote!.amount)}
            </Button>
            <Button variant="ghost" size="lg" onClick={() => run(() => cancelRequest(job.id), "Booking declined. No money moved.")}>
              Decline this price
            </Button>
          </div>
          <p className="mt-3 text-sm text-ink-soft">Paying confirms the booking. {w} is paid only after you confirm the job is done.</p>
        </ActionPanel>
      );
      break;
    case "declined":
      panel = (
        <ActionPanel title={`${w} can't take this job`}>
          {job.declineReason && <p className="mb-3">“{job.declineReason}”</p>}
          <LinkButton to={`/search?service=${job.service}&area=${encodeURIComponent(job.area)}`}>Find another worker</LinkButton>
        </ActionPanel>
      );
      break;
    case "cancelled":
      panel = <ActionPanel title="You withdrew this request">No money moved.</ActionPanel>;
      break;
    case "in_progress":
      panel = (
        <ActionPanel title={`${w} is doing the job`}>
          <p>
            {w} can see your payment is secured. When {w} marks the job complete, you'll see an update here and have {settings.confirmWindowHours} hours to check it.
          </p>
          <p className="mt-2 text-ink-soft">If {w} doesn't show up or stops before finishing, report it and the money stays frozen.</p>
          <Button variant="danger" className="mt-4" onClick={() => setDisputing(true)}>
            Report a problem
          </Button>
        </ActionPanel>
      );
      break;
    case "completed": {
      const left = job.confirmBy ? timeLeft(job.confirmBy) : null;
      panel = (
        <ActionPanel title={`${w} says the job is done`} tone="cobalt">
          {job.completionNote && <p className="rounded-[var(--radius-tile)] bg-tile p-3">“{job.completionNote}”</p>}
          {job.completionPhotos && <Gallery photos={job.completionPhotos} className="mt-3" />}
          <p className="mt-4">
            Check the work in person before you confirm.{" "}
            {left && (
              <>
                <span className="figure font-bold">{left}</span> to respond. {LIVE_BACKEND ? `After that, ${w} is paid automatically.` : "After that the payout is queued for admin release."}
              </>
            )}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="lg" onClick={() => setConfirming(true)}>
              Confirm and release payment
            </Button>
            <Button variant="danger" size="lg" onClick={() => setDisputing(true)}>
              Report a problem
            </Button>
          </div>
        </ActionPanel>
      );
      break;
    }
    case "confirmed":
      panel = job.customerReview ? (
        <ActionPanel title="Thanks for confirming">
          {job.autoConfirmed ? "The inspection window closed with no problem reported." : `You confirmed on ${date(job.confirmedAt!)}.`} {BRAND.name} is sending {w}'s payout.
        </ActionPanel>
      ) : (
        <ActionPanel title={`Rate ${w}`}>
          <p className="mb-4 text-ink-soft">Your review shows on {w}'s profile and helps other customers choose.</p>
          <ReviewForm who={w} onSubmit={(r, t) => run(() => leaveReview(job.id, "customer", r, t), "Review posted.")} />
        </ActionPanel>
      );
      break;
    case "disputed":
      panel = (
        <ActionPanel title="Dispute under review" tone="kiln">
          <p>
            <span className="font-bold">{DISPUTE_REASONS[job.dispute!.reason]}.</span> {job.dispute!.details}
          </p>
          {job.dispute!.evidence.length > 0 && <Gallery photos={job.dispute!.evidence} className="mt-3" />}
          <p className="mt-2 text-sm text-ink-soft">Reported {dateTime(job.dispute!.openedAt)}</p>
          {job.dispute!.workerResponse ? (
            <div className="mt-4 border-t border-kiln/20 pt-4">
              <p className="font-bold">{w}'s response</p>
              <p className="mt-1">{job.dispute!.workerResponse.text}</p>
            </div>
          ) : (
            <p className="mt-4 border-t border-kiln/20 pt-4 text-ink-soft">{w} has been asked to respond.</p>
          )}
          <p className="mt-4">Our team will call you both, then release the money to {w}, refund you, or split it. The decision and amounts will show here.</p>
        </ActionPanel>
      );
      break;
    case "closed": {
      const r = job.dispute?.resolution;
      panel = (
        <ActionPanel title={r ? "Dispute settled" : "Job closed"}>
          {r && (
            <p className="mb-3">
              {r.note}{" "}
              {r.toCustomer > 0 &&
                (job.refund?.status && job.refund.status !== "processed" ? (
                  <>Your refund of <span className="figure font-bold">{money(r.toCustomer)}</span> is on its way to the account you paid from.</>
                ) : (
                  <>You were refunded <span className="figure font-bold">{money(r.toCustomer)}</span>.</>
                ))}
            </p>
          )}
          {!job.customerReview && r?.outcome !== "refund" ? (
            <ReviewForm who={w} onSubmit={(rt, t) => run(() => leaveReview(job.id, "customer", rt, t), "Review posted.")} />
          ) : job.customerReview ? (
            <p className="text-ink-soft">
              You rated {w} {job.customerReview.rating} out of 5{job.customerReview.text ? `: “${job.customerReview.text}”` : "."}
            </p>
          ) : null}
        </ActionPanel>
      );
      break;
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <Link to="/jobs" className="inline-flex items-center gap-1.5 font-bold text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        My jobs
      </Link>
      <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="display-narrow text-[1.75rem] sm:text-[2.25rem]">{job.title}</h1>
          <p className="mt-1 text-ink-soft">
            <span className="figure">{job.id}</span> · requested {date(job.createdAt)}
          </p>
        </div>
        <StatusPill status={job.status} className="mt-2" />
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-start">
        <div className="flex flex-col gap-5">
          {panel}
          {job.status !== "declined" && job.status !== "cancelled" && (
            <Tile className="p-5 sm:p-6">
              <JobMoneyTrack job={job} worker={worker} perspective="customer" confirmWindowHours={settings.confirmWindowHours} />
            </Tile>
          )}
          <JobDetails job={job} showAddress />
          <Timeline job={job} />
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-6">
          <Tile className="p-5">
            <div className="flex gap-3">
              <Avatar name={worker.name} />
              <div>
                <Link to={`/workers/${worker.id}`} className="font-bold hover:underline">
                  {worker.name}
                </Link>
                <div>
                  <VerifiedBadge status={worker.verification} />
                </div>
                {stats && <Stars value={stats.rating} count={stats.reviews} />}
              </div>
            </div>
            <MessageLink peerId={worker.id} className="mt-4 w-full" />
            {paid ? (
              <a href={`tel:${worker.phone}`} className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-tile)] border-2 border-ink/80 font-bold hover:bg-tile-dim">
                <Phone className="size-4" aria-hidden />
                Call {w} · <span className="figure">{phone(worker.phone)}</span>
              </a>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">Phone numbers are shared after you pay.</p>
            )}
          </Tile>
          <Receipt job={job} perspective="customer" />
        </aside>
      </div>

      {/* Stays mounted while `paying` so its success step survives the status change. */}
      {(job.status === "quoted" || paying) && (
        <PaystackCheckout
          jobId={job.id}
          open={paying}
          onClose={() => setPaying(false)}
          amount={amount}
          jobTitle={job.title}
          workerName={worker.name}
          defaultPhone={customer.phone}
          onPaid={(r) => recordPayment(job.id, { ...r, amount })}
        />
      )}

      <DisputeDialog
        open={disputing}
        onClose={() => setDisputing(false)}
        amount={amount}
        workerName={w}
        onSubmit={async (reason, details, evidence) => {
          if (await run(() => openDispute(job.id, reason, details, evidence), "Problem reported. The payment is frozen.")) setDisputing(false);
        }}
      />

      <Dialog open={confirming} onClose={() => setConfirming(false)} title="Release the payment?">
        <p>
          This confirms {w} finished the job and releases <span className="figure font-bold">{money(amount)}</span> for payout. You can't undo it.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            onClick={async () => {
              if (await run(() => confirmCompletion(job.id), `Confirmed. ${w}'s payout is on its way.`)) setConfirming(false);
            }}
          >
            Yes, release {money(amount)}
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Not yet
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

/**
 * Live: Paystack sends the customer back to /jobs/:id?payment=<reference>. Ask the server
 * to verify it and poll until the booking shows as paid, then drop the parameter.
 */
function usePaymentReturn(status: string | undefined) {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const reference = LIVE_BACKEND ? params.get("payment") : null;
  const [round, setRound] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const dismiss = () => setParams((p) => { p.delete("payment"); return p; }, { replace: true });

  useEffect(() => {
    if (!reference || !status) return;
    if (status !== "quoted") {
      if (status === "in_progress") toast("Payment received. Siesie is holding it until you confirm the work.");
      dismiss();
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let tries = 0;
    setWaiting(false);
    const check = async () => {
      tries++;
      try { await verifyLiveCheckout(reference); } catch { /* the webhook may still deliver it */ }
      await refreshSession();
      if (cancelled) return;
      if (tries >= 12) setWaiting(true);
      else timer = setTimeout(check, 5000);
    };
    timer = setTimeout(check, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [reference, status, round]);

  return reference && status === "quoted" ? { waiting, checkAgain: () => setRound((n) => n + 1), dismiss } : null;
}

function ActionPanel({ title, children, tone = "plain" }: { title: string; children: React.ReactNode; tone?: "plain" | "cobalt" | "kiln" }) {
  const cls = tone === "cobalt" ? "bg-cobalt-wash ring-2 ring-cobalt" : tone === "kiln" ? "bg-kiln-wash ring-2 ring-kiln/40" : "bg-tile";
  return (
    <section className={`rounded-[var(--radius-tile)] p-5 shadow-[var(--shadow-tile)] sm:p-6 ${cls}`} aria-labelledby="action-h">
      <h2 id="action-h" className="display-narrow mb-3 text-xl sm:text-2xl">
        {title}
      </h2>
      <div className="text-[1.0625rem]">{children}</div>
    </section>
  );
}
