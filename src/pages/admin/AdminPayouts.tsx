import { useState } from "react";
import { useDb, releasePayout, findWorker } from "../../data/store";
import { Button, DefinitionRow, Dialog, EmptyState, PageHeader, Tile } from "../../components/ui";
import { Receipt } from "../../components/JobParts";
import { useAction, useToast } from "../../components/Toast";
import { simulateTransfer, TEST_MODE } from "../../payments/paystack";
import { dateTime, money } from "../../lib/format";
import { useTitle } from "../../lib/hooks";
import { useReveal } from "../../lib/motion";
import { FlaskConical } from "lucide-react";

export function AdminPayouts() {
  useTitle("Payouts to release · Siesie");
  const db = useDb((d) => d);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useAction();
  const toast = useToast();
  const jobs = db.jobs.filter((j) => j.status === "confirmed" && j.payout?.status === "queued").sort((a, b) => a.payout!.queuedAt.localeCompare(b.payout!.queuedAt));
  const job = jobs.find((j) => j.id === selected);
  const listRef = useReveal<HTMLDivElement>([jobs.length]);
  async function release() {
    if (!job || busy) return;
    setBusy(true);
    try {
      const ref = await simulateTransfer();
      if (await run(() => releasePayout(job.id, ref), "Test payout recorded.")) setSelected(null);
    } catch (e) { toast(e instanceof Error ? e.message : "Transfer failed. Try again.", "error"); }
    finally { setBusy(false); }
  }
  return <div ref={listRef}>
    <PageHeader title="Payouts to release" lead={`${jobs.length} queued payouts · ${money(jobs.reduce((s, j) => s + j.payout!.net, 0))} to workers. Review the destination before releasing each payment.`} />
    <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-ochre/40 bg-ochre-wash px-3.5 py-2 text-sm font-bold text-ochre-deep"><FlaskConical className="size-4 shrink-0" aria-hidden />{TEST_MODE ? "Test mode: releases simulate a transfer. No money is sent." : "Payouts are unavailable until payment processing is connected."}</p>
    {!jobs.length ? <EmptyState title="No payouts waiting." body="Customer confirmations and expired inspection windows add jobs to this queue." /> : <div className="grid gap-4 xl:grid-cols-2">{jobs.map((j, i) => <Tile className="flex flex-col p-5 sm:p-6" key={j.id} data-reveal="pop" style={{ ["--i" as string]: Math.min(i, 8) }}>
      <p className="figure text-xs text-ink-faint">{j.id}</p><h2 className="display-narrow mt-1 text-lg">{j.title}</h2><p className="mt-1 text-ink-soft">{findWorker(db, j.workerId)?.name}</p>
      <dl className="mt-4 divide-y divide-grout"><DefinitionRow term="Agreed amount">{money(j.payout!.gross)}</DefinitionRow><DefinitionRow term="Commission">{money(j.payout!.commission)}</DefinitionRow><DefinitionRow term="Send to worker">{money(j.payout!.net)}</DefinitionRow><DefinitionRow term="Destination">{j.payout!.destination}</DefinitionRow></dl>
      <p className="mt-3 text-sm text-ink-soft">{j.autoConfirmed ? "Inspection window elapsed" : "Confirmed by customer"} · {dateTime(j.confirmedAt ?? j.payout!.queuedAt)}</p><Button className="mt-5 self-start" onClick={() => setSelected(j.id)}>Review payout</Button>
    </Tile>)}</div>}
    <Dialog open={!!job} onClose={() => { if (!busy) setSelected(null); }} title="Review payout">
      {job && <><p className="mb-4">Release <strong>{money(job.payout!.net)}</strong> to <strong>{job.payout!.destination}</strong> for {job.title}.</p><Receipt job={job} perspective="admin" /><Button className="mt-5 w-full" busy={busy} disabled={!TEST_MODE} onClick={release}>{TEST_MODE ? "Simulate payout release" : "Payouts unavailable"}</Button></>}
    </Dialog>
  </div>;
}
