import { useState } from "react";
import { Link, useParams } from "react-router";
import { BRAND, DISPUTE_REASONS } from "../../config";
import { findCustomer, findWorker, jobCommissionPct, leaveReview, useDb } from "../../data/store";
import { MessageLink } from "../../components/MessageLink";
import { JobDetails, Receipt, ReviewForm, Timeline } from "../../components/JobParts";
import { JobMoneyTrack } from "../../components/MoneyTrack";
import { Button, Gallery, PageHeader, Stars, StatusPill, Tile } from "../../components/ui";
import { useAction } from "../../components/Toast";
import { commissionOn, dateTime, money, phone, weekday } from "../../lib/format";
import { useNow, useTitle } from "../../lib/hooks";
import { NotFound } from "../NotFound";
import { AcceptDialog, CompleteDialog, DeclineDialog, DisputeResponseForm } from "./dialogs";

export function WorkerJob() {
  const { id } = useParams();
  const db = useDb((d) => d);
  const job = db.jobs.find((j) => j.id === id && j.workerId === db.session?.userId);
  const worker = job && findWorker(db, job.workerId);
  const customer = job && findCustomer(db, job.customerId);
  const [dialog, setDialog] = useState<"accept" | "decline" | "complete" | null>(null);
  const run = useAction();
  useTitle(`${job?.title ?? "Job"} · ${BRAND.name}`);
  useNow();
  if (!job || !worker || !customer) return <NotFound />;
  const amount = job.payment?.amount ?? job.quote?.amount ?? 0;
  const { commission, net } = commissionOn(amount, jobCommissionPct(db, job));
  return <>
    <PageHeader title={job.title} lead={<><span className="figure">{job.id}</span> · {customer.name}</>} back={<Link to="/work/jobs" className="mb-3 inline-block font-bold text-cobalt">← All jobs</Link>} actions={<StatusPill status={job.status} />} />
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] lg:items-start">
      <div className="flex min-w-0 flex-col gap-5">
        <Tile className="p-5 sm:p-6">
          <JobMoneyTrack job={job} worker={worker} perspective="worker" confirmWindowHours={db.settings.confirmWindowHours} />
          {job.status === "requested" && <div className="mt-5 flex flex-wrap gap-2"><Button disabled={worker.verification !== "verified"} onClick={() => setDialog("accept")}>Accept and set price</Button><Button variant="secondary" onClick={() => setDialog("decline")}>Decline</Button></div>}
          {job.quote && <p className="mt-4">Agreed start: <strong>{weekday(job.quote.date)}</strong>. {job.quote.note}</p>}
          {job.status === "in_progress" && <Button className="mt-5" onClick={() => setDialog("complete")}>Mark job complete</Button>}
          {job.status === "confirmed" && <p className="mt-4 font-bold text-celadon">Your payout of {money(job.payout?.net ?? net)} is queued for admin release.</p>}
          {job.declineReason && <p className="mt-3">Reason: {job.declineReason}</p>}
        </Tile>
        {job.completedAt && <Tile className="p-5"><h2 className="text-lg font-bold">Work submitted</h2><p className="text-sm text-ink-soft">{dateTime(job.completedAt)}</p><p className="mt-3 whitespace-pre-line">{job.completionNote || "Marked complete."}</p><Gallery className="mt-3" photos={job.completionPhotos ?? []} /></Tile>}
        {job.dispute && <Tile className="p-5 ring-2 ring-kiln/30"><h2 className="text-xl font-bold">{job.dispute.resolution ? "Dispute decision" : "Payment on hold"}</h2><p className="mt-3 font-bold">{DISPUTE_REASONS[job.dispute.reason]}</p><p className="mt-2 whitespace-pre-line">{job.dispute.details}</p><Gallery photos={job.dispute.evidence} className="mt-3" />
          {job.dispute.workerResponse && <div className="mt-5 border-t border-grout pt-4"><h3 className="font-bold">Your response</h3><p className="mt-2 whitespace-pre-line">{job.dispute.workerResponse.text}</p><Gallery photos={job.dispute.workerResponse.evidence} className="mt-3" /></div>}
          {job.status === "disputed" && !job.dispute.workerResponse && <div className="mt-5"><DisputeResponseForm job={job} /></div>}
          {job.dispute.resolution && <p className="mt-4 rounded bg-tile-dim p-4">{job.dispute.resolution.note}<br />Refund to customer: {money(job.dispute.resolution.toCustomer)}. Your payout after fees: {money(job.payout?.net ?? 0)}.</p>}
        </Tile>}
        {(job.status === "confirmed" || job.status === "closed") && <Tile className="p-5"><h2 className="mb-4 text-lg font-bold">Rate your customer</h2>{job.workerReview ? <><Stars value={job.workerReview.rating} /><p className="mt-2">{job.workerReview.text}</p></> : <ReviewForm who={customer.name} onSubmit={(rating, text) => run(() => leaveReview(job.id, "worker", rating, text), "Review saved.")} />}</Tile>}
        <JobDetails job={job} showAddress={!!job.payment} /><Timeline job={job} />
      </div>
      <aside className="flex min-w-0 flex-col gap-5">
        <Tile className="p-5"><h2 className="font-bold">{customer.name}</h2><p className="text-ink-soft">{job.area}</p><MessageLink peerId={customer.id} perspective="worker" className="mt-3 w-full">Message customer</MessageLink>{job.payment ? <a className="mt-3 block font-bold text-cobalt" href={`tel:${customer.phone}`}>Call {phone(customer.phone)}</a> : <p className="mt-3 text-sm text-ink-soft">Contact details appear after payment.</p>}</Tile>
        {!!amount && !job.payout && <Tile className="p-5"><h2 className="font-bold">Your expected payout</h2><p className="figure mt-2 text-2xl font-bold">{money(net)}</p><p className="mt-2 text-sm text-ink-soft">{money(amount)} less {money(commission)} commission ({jobCommissionPct(db, job)}%). Subject to any dispute decision.</p></Tile>}
        <Receipt job={job} perspective="worker" />
      </aside>
    </div>
    <AcceptDialog job={job} worker={worker} customerName={customer.name} open={dialog === "accept"} onClose={() => setDialog(null)} />
    <DeclineDialog job={job} open={dialog === "decline"} onClose={() => setDialog(null)} />
    <CompleteDialog job={job} customerName={customer.name} open={dialog === "complete"} onClose={() => setDialog(null)} />
  </>;
}
