import { useState } from "react";
import type { Job, Photo, Worker } from "../../data/types";
import { acceptRequest, declineRequest, markComplete, respondToDispute, useDb } from "../../data/store";
import { Button, ChoiceChip, Dialog, Field } from "../../components/ui";
import { PhotoPicker } from "../../components/PhotoPicker";
import { useAction } from "../../components/Toast";
import { commissionOn, firstName, money } from "../../lib/format";

function dateInput(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const use = d < today ? today : d;
  use.setMinutes(use.getMinutes() - use.getTimezoneOffset());
  return use.toISOString().slice(0, 10);
}

export function AcceptDialog({ job, worker, customerName, open, onClose }: { job: Job; worker: Worker; customerName: string; open: boolean; onClose: () => void }) {
  const run = useAction();
  const pct = useDb((d) => d.settings.commissionPct);
  const [amount, setAmount] = useState(worker.pricing.mode === "fixed" && worker.pricing.from === worker.pricing.to ? String(worker.pricing.from) : "");
  const [date, setDate] = useState(dateInput(job.preferredDate));
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const value = Number(amount.replace(/,/g, ""));
  const valid = value > 0 && Number.isFinite(value);
  const { commission, net } = commissionOn(valid ? value : 0, pct);
  const c = firstName(customerName);

  return (
    <Dialog open={open} onClose={onClose} title="Accept this job">
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setTried(true);
          if (!valid || !date) return;
          if (await run(() => acceptRequest(job.id, value, new Date(`${date}T08:00:00`).toISOString(), note), `Sent to ${c}. You'll be told when the payment is held.`)) onClose();
        }}
      >
        <Field label="Your price for the whole job" hint={`Your rate: ${money(worker.pricing.from, { whole: true })}–${worker.pricing.to} ${worker.pricing.unit}. Include labour and anything you'll supply.`} error={tried && !valid ? "Enter a price." : null}>
          {(p) => (
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-ink-soft">GH₵</span>
              <input {...p} className="field figure !pl-14 text-xl" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} autoFocus />
            </div>
          )}
        </Field>
        {valid && (
          <p className="-mt-2 rounded-[var(--radius-tile)] bg-tile-dim px-3 py-2 text-[0.9375rem]">
            {c} pays <span className="figure font-bold">{money(value)}</span>. After the {pct}% fee (<span className="figure">{money(commission)}</span>) you receive{" "}
            <span className="figure font-bold text-celadon">{money(net)}</span>.
          </p>
        )}
        <Field label="Date you'll start" error={tried && !date ? "Pick a date." : null}>
          {(p) => <input {...p} type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label={`Note to ${c}`} optional hint="What's included, how long it takes, what they should prepare.">
          {(p) => <textarea {...p} className="field !min-h-24" value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} />}
        </Field>
        <div className="flex flex-wrap gap-2 border-t border-grout pt-4">
          <Button type="submit">Send price to {c}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
        <p className="-mt-2 text-sm text-ink-soft">Don't buy materials or travel until the job shows “Payment held”.</p>
      </form>
    </Dialog>
  );
}

const DECLINE_REASONS = ["I'm fully booked on that date", "It's outside my area", "It's not work I do", "The job is too big for me"];

export function DeclineDialog({ job, open, onClose }: { job: Job; open: boolean; onClose: () => void }) {
  const run = useAction();
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onClose={onClose} title="Decline this request">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => declineRequest(job.id, reason), "Request declined.")) onClose();
        }}
      >
        <fieldset>
          <legend className="mb-2 font-bold">Tell the customer why</legend>
          <div className="flex flex-wrap gap-2">
            {DECLINE_REASONS.map((r) => (
              <ChoiceChip key={r} type="radio" name="decline" checked={reason === r} onChange={() => setReason(r)}>
                {r}
              </ChoiceChip>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-2 border-t border-grout pt-4">
          <Button type="submit" variant="danger">
            Decline request
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Keep it
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function CompleteDialog({ job, customerName, open, onClose }: { job: Job; customerName: string; open: boolean; onClose: () => void }) {
  const run = useAction();
  const hours = useDb((d) => d.settings.confirmWindowHours);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const c = firstName(customerName);
  return (
    <Dialog open={open} onClose={onClose} title="Mark the job complete" wide>
      <form
        className="flex flex-col gap-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => markComplete(job.id, note, photos), `Marked complete. ${c} has ${hours} hours to check.`)) onClose();
        }}
      >
        <p>
          {c} is notified to check the work. If there's no problem reported within {hours} hours, your payout is queued for admin release.
        </p>
        <Field label="What did you do?" optional hint="Mention anything left over, like spare tiles or what to avoid while grout dries.">
          {(p) => <textarea {...p} className="field !min-h-24" value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} />}
        </Field>
        <div>
          <p className="font-bold">Photos of the finished work</p>
          <p className="mb-3 text-sm text-ink-soft">These protect you if the customer disputes the job.</p>
          <PhotoPicker value={photos} onChange={setPhotos} max={6} />
        </div>
        <div className="flex flex-wrap gap-2 border-t border-grout pt-4">
          <Button type="submit">Mark complete</Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Not finished yet
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function DisputeResponseForm({ job }: { job: Job }) {
  const run = useAction();
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [tried, setTried] = useState(false);
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setTried(true);
        if (text.trim().length < 15) return;
        run(() => respondToDispute(job.id, text, photos), "Your side has been added. Our team will call you.");
      }}
    >
      <Field label="Your side" error={tried && text.trim().length < 15 ? "Explain what happened so our team can decide fairly." : null}>
        {(p) => <textarea {...p} className="field" value={text} onChange={(e) => setText(e.target.value)} maxLength={1200} />}
      </Field>
      <PhotoPicker value={photos} onChange={setPhotos} max={6} label="Add photos" />
      <Button type="submit" className="self-start">
        Send my response
      </Button>
    </form>
  );
}
