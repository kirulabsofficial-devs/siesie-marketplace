import { useState } from "react";
import { useDb, releasePayout, retryPayout, findWorker } from "../../data/store";
import { Button, DefinitionRow, Dialog, EmptyState, PageHeader, Tile } from "../../components/ui";
import { Receipt } from "../../components/JobParts";
import { useAction, useToast } from "../../components/Toast";
import { simulateTransfer, TEST_MODE } from "../../payments/paystack";
import { dateTime, money } from "../../lib/format";
import { useTitle } from "../../lib/hooks";
import { useReveal } from "../../lib/motion";
import { FlaskConical } from "lucide-react";
import type { Job } from "../../data/types";

// Live payouts send themselves through Paystack; this page shows the ones still in flight
// and lets an admin retry a failed transfer once the cause is fixed.
const LIVE_STATUS: Record<"queued" | "sending" | "failed", { label: string; tone: string }> = {
  queued: { label: "Waiting to send", tone: "bg-ochre-wash text-ochre-deep" },
  sending: { label: "Sending through Paystack", tone: "bg-cobalt-wash text-cobalt" },
  failed: { label: "Transfer failed", tone: "bg-kiln-wash text-kiln-deep" },
};

export function AdminPayouts() {
  useTitle("Payouts · Siesie");
  const db = useDb((d) => d);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useAction();
  const toast = useToast();
  const jobs = db.jobs
    .filter((j) => (TEST_MODE ? j.status === "confirmed" && j.payout?.status === "queued" : j.payout && j.payout.status !== "sent"))
    .sort((a, b) => a.payout!.queuedAt.localeCompare(b.payout!.queuedAt));
  const job = jobs.find((j) => j.id === selected);
  const listRef = useReveal<HTMLDivElement>([jobs.length]);
  async function release() {
    if (!job || busy) return;
    setBusy(true);
    try {
      if (!TEST_MODE) {
        if (await run(() => retryPayout(job.id), "Payout sent back to Paystack.")) setSelected(null);
        return;
      }
      const ref = await simulateTransfer();
      if (await run(() => releasePayout(job.id, ref), "Test payout recorded.")) setSelected(null);
    } catch (e) { toast(e instanceof Error ? e.message : "Transfer failed. Try again.", "error"); }
    finally { setBusy(false); }
  }
  const failed = jobs.filter((j) => j.payout!.status === "failed").length;
  const lead = TEST_MODE
    ? `${jobs.length} queued payouts · ${money(jobs.reduce((s, j) => s + j.payout!.net, 0))} to workers. Review the destination before releasing each payment.`
    : `${jobs.length} payouts in progress · ${money(jobs.reduce((s, j) => s + j.payout!.net, 0))} to workers. Paystack sends each one automatically.${failed ? ` ${failed} failed and need a retry.` : ""}`;
  return <div ref={listRef}>
    <PageHeader title={TEST_MODE ? "Payouts to release" : "Payouts"} lead={lead} />
    {TEST_MODE && <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-ochre/40 bg-ochre-wash px-3.5 py-2 text-sm font-bold text-ochre-deep"><FlaskConical className="size-4 shrink-0" aria-hidden />Test mode: releases simulate a transfer. No money is sent.</p>}
    {!jobs.length ? <EmptyState title={TEST_MODE ? "No payouts waiting." : "Every payout has been sent."} body={TEST_MODE ? "Customer confirmations and expired inspection windows add jobs to this queue." : "Confirmed jobs appear here only while Paystack is sending the money, or if a transfer fails."} /> : <div className="grid gap-4 xl:grid-cols-2">{jobs.map((j, i) => <Tile className="flex flex-col p-5 sm:p-6" key={j.id} data-reveal="pop" style={{ ["--i" as string]: Math.min(i, 8) }}>
      <p className="figure text-xs text-ink-faint">{j.id}</p><h2 className="display-narrow mt-1 text-lg">{j.title}</h2><p className="mt-1 text-ink-soft">{findWorker(db, j.workerId)?.name}</p>
      {!TEST_MODE && <LiveStatus job={j} />}
      <dl className="mt-4 divide-y divide-grout"><DefinitionRow term="Agreed amount">{money(j.payout!.gross)}</DefinitionRow><DefinitionRow term="Commission">{money(j.payout!.commission)}</DefinitionRow><DefinitionRow term="Send to worker">{money(j.payout!.net)}</DefinitionRow><DefinitionRow term="Destination">{j.payout!.destination}</DefinitionRow></dl>
      <p className="mt-3 text-sm text-ink-soft">{j.dispute?.resolution ? "Dispute decision" : j.autoConfirmed ? "Inspection window elapsed" : "Confirmed by customer"} · {dateTime(j.confirmedAt ?? j.payout!.queuedAt)}</p>
      {(TEST_MODE || j.payout!.status === "failed") && <Button className="mt-5 self-start" onClick={() => setSelected(j.id)}>{TEST_MODE ? "Review payout" : "Review and retry"}</Button>}
    </Tile>)}</div>}
    <Dialog open={!!job} onClose={() => { if (!busy) setSelected(null); }} title={TEST_MODE ? "Review payout" : "Retry payout"}>
      {job && <>
        <p className="mb-4">{TEST_MODE ? "Release" : "Send"} <strong>{money(job.payout!.net)}</strong> to <strong>{job.payout!.destination}</strong> for {job.title}{TEST_MODE ? "." : " again."}</p>
        {!TEST_MODE && job.payout!.failure && <p className="mb-4 rounded-[var(--radius-tile)] bg-kiln-wash p-3 text-[0.9375rem] text-kiln-deep"><strong>Last attempt:</strong> {job.payout!.failure} Fix the cause first, such as the worker's payout details or your Paystack balance.</p>}
        <Receipt job={job} perspective="admin" />
        <Button className="mt-5 w-full" busy={busy} onClick={release}>{TEST_MODE ? "Simulate payout release" : "Retry payout"}</Button>
      </>}
    </Dialog>
  </div>;
}

function LiveStatus({ job }: { job: Job }) {
  const status = LIVE_STATUS[job.payout!.status as keyof typeof LIVE_STATUS];
  if (!status) return null;
  return <div className="mt-3">
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${status.tone}`}>{status.label}</span>
    {job.payout!.status === "failed" && job.payout!.failure && <p className="mt-2 text-sm text-kiln-deep">{job.payout!.failure}</p>}
  </div>;
}
