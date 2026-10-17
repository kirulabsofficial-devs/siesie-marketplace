import { useState } from "react";
import { Link, useParams } from "react-router";
import { findCustomer, findWorker, jobCommissionPct, resolveDispute, useDb } from "../../data/store";
import { Button, DefinitionRow, Dialog, Field, PageHeader, StatusPill, Tile } from "../../components/ui";
import { JobDetails, Receipt, Timeline } from "../../components/JobParts";
import { useAction, useToast } from "../../components/Toast";
import { simulateTransfer } from "../../payments/paystack";
import { commissionOn, money, round2 } from "../../lib/format";
import { useTitle } from "../../lib/hooks";
import { NotFound } from "../NotFound";
import { DisputeEvidence } from "./shared";
import { LIVE_BACKEND } from "../../data/runtime";

export function AdminDispute() {
  const { id } = useParams();
  const db = useDb((d) => d);
  const job = db.jobs.find((j) => j.id === id && j.dispute);
  const [outcome, setOutcome] = useState("refund");
  const [split, setSplit] = useState("");
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = useAction();
  const toast = useToast();
  useTitle(`${job?.title ?? "Dispute"} · Siesie admin`);
  if (!job || !job.payment) return <NotFound />;
  const total = job.payment.amount;
  const workerGross = outcome === "refund" ? 0 : outcome === "release" ? total : Number(split);
  const valid = Number.isFinite(workerGross) && workerGross >= 0 && workerGross <= total && (outcome !== "split" || (split.trim() !== "" && workerGross > 0 && workerGross < total)) && note.trim().length >= 15;
  const { commission, net } = commissionOn(valid ? round2(workerGross) : 0, jobCommissionPct(db, job));
  const refund = round2(total - workerGross);
  const customer = findCustomer(db, job.customerId);
  const worker = findWorker(db, job.workerId);
  async function resolve() {
    if (!job || busy || !valid) return;
    setBusy(true);
    try {
      if (LIVE_BACKEND) {
        if (await run(() => resolveDispute(job.id, workerGross, note, ""), "Decision recorded. Paystack is moving the money.")) setReviewing(false);
        return;
      }
      const ref = workerGross > 0 ? await simulateTransfer() : "";
      if (await run(() => resolveDispute(job.id, workerGross, note, ref), "Test resolution recorded.")) setReviewing(false);
    } catch (e) { toast(e instanceof Error ? e.message : "Unable to record this decision.", "error"); }
    finally { setBusy(false); }
  }
  const allocation = <dl className="divide-y divide-grout"><DefinitionRow term="Held amount">{money(total)}</DefinitionRow><DefinitionRow term="Refund to customer">{money(Number.isFinite(refund) ? refund : 0)}</DefinitionRow><DefinitionRow term="Worker allocation">{money(Number.isFinite(workerGross) ? workerGross : 0)}</DefinitionRow><DefinitionRow term="Platform fee">{money(commission)}</DefinitionRow><DefinitionRow term="Worker receives">{money(net)}</DefinitionRow></dl>;
  return <>
    <PageHeader title={job.title} lead={`${job.id} · ${customer?.name} and ${worker?.name}`} back={<Link to="/admin/disputes" className="mb-3 inline-block font-bold text-cobalt">← All disputes</Link>} actions={<StatusPill status={job.status} />} />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] xl:items-start">
      <div className="flex min-w-0 flex-col gap-5"><DisputeEvidence job={job} /><JobDetails job={job} showAddress /><Timeline job={job} /></div>
      <aside className="flex min-w-0 flex-col gap-5">
        <Tile className="p-5"><h2 className="font-bold">Contact both parties</h2><a className="mt-3 block text-cobalt underline" href={`tel:${customer?.phone}`}>{customer?.name} · customer</a><a className="mt-2 block text-cobalt underline" href={`tel:${worker?.phone}`}>{worker?.name} · worker</a></Tile>
        {job.dispute!.resolution ? <Tile className="p-5"><h2 className="text-lg font-bold">Decision recorded</h2><p className="mt-3 whitespace-pre-line">{job.dispute!.resolution.note}</p><dl className="mt-4 divide-y divide-grout"><DefinitionRow term="Customer refund">{money(job.dispute!.resolution.toCustomer)}</DefinitionRow><DefinitionRow term="Worker allocation">{money(job.dispute!.resolution.toWorker)}</DefinitionRow></dl></Tile> : <Tile className="p-5"><h2 className="text-xl font-bold">Resolve this dispute</h2><p className="mt-2 text-sm text-ink-soft">{LIVE_BACKEND ? "Refunds go back to the customer's original payment through Paystack. The worker's share, less commission, is sent automatically." : "Test mode. Refunds and transfers are simulated."}</p><form className="mt-5 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (valid) setReviewing(true); }}>
          <Field label="Decision">{(p) => <select {...p} className="field" value={outcome} onChange={(e) => setOutcome(e.target.value)}><option value="refund">Full refund to customer</option><option value="release">Full release to worker</option><option value="split">Split payment</option></select>}</Field>
          {outcome === "split" && <Field label="Worker allocation before fee (GH₵)">{(p) => <input {...p} className="field figure" type="number" min="0.01" max={total - 0.01} step="0.01" value={split} onChange={(e) => setSplit(e.target.value)} required />}</Field>}
          <Field label="Reason for the decision" hint="Shared with both parties. Explain the evidence and allocation.">{(p) => <textarea {...p} className="field" minLength={15} maxLength={1200} value={note} onChange={(e) => setNote(e.target.value)} required />}</Field>
          {allocation}<Button type="submit" disabled={!valid}>Review decision</Button>
        </form></Tile>}
        <Receipt job={job} perspective="admin" />
      </aside>
    </div>
    <Dialog open={reviewing} onClose={() => { if (!busy) setReviewing(false); }} title="Confirm dispute decision">
      <p className="mb-3 whitespace-pre-line">{note}</p>{allocation}<p className="mt-4 text-sm text-ink-soft">{LIVE_BACKEND ? "This closes the case. Paystack refunds the customer and sends the worker's share. Real money moves and you can't undo it." : "This closes the case and records the simulated refund and payout."}</p><Button className="mt-5" busy={busy} onClick={resolve}>{LIVE_BACKEND ? "Confirm and move the money" : "Record test resolution"}</Button>
    </Dialog>
  </>;
}
