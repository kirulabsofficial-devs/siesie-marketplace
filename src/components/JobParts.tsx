import { useState } from "react";
import type { DisputeReason, Job, Photo } from "../data/types";
import { BRAND, DISPUTE_REASONS, MOMO_NETWORKS, SERVICES } from "../config";
import { Button, DefinitionRow, Dialog, Field, Gallery, StarInput, Tile } from "./ui";
import { PhotoPicker } from "./PhotoPicker";
import { dateTime, money, weekday } from "../lib/format";
import { cn } from "../lib/cn";

export function JobDetails({ job, showAddress }: { job: Job; showAddress: boolean }) {
  return (
    <Tile className="p-5 sm:p-6">
      <h2 className="text-lg font-bold">Job details</h2>
      <p className="mt-3 whitespace-pre-line text-[1.0625rem] leading-relaxed">{job.scope}</p>
      {job.photos.length > 0 && <Gallery photos={job.photos} className="mt-4" />}
      <dl className="mt-4 divide-y divide-grout border-t border-grout">
        <DefinitionRow term="Service">{SERVICES[job.service].label}</DefinitionRow>
        <DefinitionRow term="Preferred date">{weekday(job.preferredDate)}</DefinitionRow>
        <DefinitionRow term={showAddress ? "Address" : "Area"}>{showAddress ? job.address : job.area}</DefinitionRow>
      </dl>
      {!showAddress && <p className="mt-2 text-sm text-ink-soft">The full address is shared once the customer pays.</p>}
    </Tile>
  );
}

export function Timeline({ job }: { job: Job }) {
  const events = [...job.events].reverse();
  return (
    <Tile className="p-5 sm:p-6">
      <h2 className="text-lg font-bold">History</h2>
      <ol className="mt-4 flex flex-col">
        {events.map((e, i) => (
          <li key={i} className="relative flex gap-4 pb-4 last:pb-0">
            <span className="relative flex w-3 shrink-0 justify-center" aria-hidden>
              <span className={cn("mt-1.5 size-2.5 rounded-[2px]", i === 0 ? "bg-ink" : "bg-grout-deep")} />
              {i < events.length - 1 && <span className="absolute bottom-[-2px] top-5 w-[2px] bg-grout" />}
            </span>
            <div>
              <p className={cn("text-[0.9375rem]", i === 0 && "font-bold")}>{e.text}</p>
              <p className="text-xs text-ink-soft">
                {dateTime(e.at)} · {e.by === "system" ? BRAND.name : e.by === "admin" ? `${BRAND.name} team` : e.by === "customer" ? "Customer" : "Worker"}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Tile>
  );
}

export function Receipt({ job, perspective }: { job: Job; perspective: "customer" | "worker" | "admin" }) {
  const p = job.payment;
  if (!p) return null;
  const channel = p.channel === "momo" && p.network ? MOMO_NETWORKS[p.network].label : "Card";
  return (
    <Tile className="p-5">
      <h2 className="font-bold">Payment record</h2>
      <dl className="mt-2 divide-y divide-grout text-[0.9375rem]">
        <DefinitionRow term="Paid">
          <span className="figure">{money(p.amount)}</span>
        </DefinitionRow>
        {perspective !== "worker" && (
          <DefinitionRow term="From">
            {channel} <span className="figure font-normal text-ink-soft">{p.payer}</span>
          </DefinitionRow>
        )}
        <DefinitionRow term="On">{dateTime(p.paidAt)}</DefinitionRow>
        <DefinitionRow term="Reference">
          <span className="figure text-sm">{p.reference}</span>
        </DefinitionRow>
        {job.payout && perspective !== "customer" && (
          <>
            <DefinitionRow term={`Fee`}>
              <span className="figure">− {money(job.payout.commission)}</span>
            </DefinitionRow>
            <DefinitionRow term={{ queued: "Payout queued", sending: "Payout sending", sent: "Paid out", failed: "Payout delayed" }[job.payout.status]}>
              <span className="figure">{money(job.payout.net)}</span>
            </DefinitionRow>
            <DefinitionRow term="To">{job.payout.destination}</DefinitionRow>
            {job.payout.sentAt && (
              <DefinitionRow term="Transfer">
                <span className="figure text-sm">{job.payout.reference}</span>
              </DefinitionRow>
            )}
          </>
        )}
        {job.payout && perspective === "customer" && job.payout.status === "sent" && (
          <DefinitionRow term="Released to worker">
            <span className="figure">{money(job.payout.gross)}</span>
          </DefinitionRow>
        )}
        {job.refund && (
          <>
          <DefinitionRow term="Refunded">
            <span className="figure">{money(job.refund.amount)}</span>
          </DefinitionRow>
          <DefinitionRow term="Refund date">{dateTime(job.refund.at)}</DefinitionRow>
          {job.refund.status && job.refund.status !== "processed" && (
            <DefinitionRow term="Refund status">{job.refund.status === "failed" || job.refund.status === "check" ? "Being checked by Siesie" : "On its way"}</DefinitionRow>
          )}
          {perspective !== "worker" && <DefinitionRow term="Refund destination">{job.refund.destination}</DefinitionRow>}
          <DefinitionRow term="Refund reference"><span className="figure text-sm">{job.refund.reference}</span></DefinitionRow>
          </>
        )}
      </dl>
    </Tile>
  );
}

export function ReviewForm({ who, onSubmit }: { who: string; onSubmit: (rating: number, text: string) => void }) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) return setErr("Choose a star rating.");
        onSubmit(rating, text);
      }}
    >
      <StarInput label={`How was ${who}?`} value={rating} onChange={(v) => (setRating(v), setErr(null))} />
      {err && <p className="-mt-2 text-sm font-bold text-kiln-deep">{err}</p>}
      <Field label="What should others know?" optional>
        {(p) => <textarea {...p} className="field !min-h-24" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Were they on time? Is the work neat? Would you book again?" />}
      </Field>
      <Button type="submit" className="self-start">
        Post review
      </Button>
    </form>
  );
}

export function DisputeDialog({ open, onClose, onSubmit, amount, workerName }: { open: boolean; onClose: () => void; onSubmit: (r: DisputeReason, details: string, evidence: Photo[]) => void; amount: number; workerName: string }) {
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [details, setDetails] = useState("");
  const [evidence, setEvidence] = useState<Photo[]>([]);
  const [tried, setTried] = useState(false);
  const errReason = tried && !reason ? "Choose what went wrong." : null;
  const errDetails = tried && details.trim().length < 15 ? "Describe the problem so our team can check it." : null;

  return (
    <Dialog open={open} onClose={onClose} title="Report a problem" wide>
      <form
        className="flex flex-col gap-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setTried(true);
          if (!reason || details.trim().length < 15) return;
          onSubmit(reason, details, evidence);
        }}
      >
        <p className="rounded-[var(--radius-tile)] bg-kiln-wash p-3 text-[0.9375rem]">
          The <span className="figure font-bold">{money(amount)}</span> stays frozen. {workerName} can't receive it and you can't be refunded until our team decides. They'll look at your photos and {workerName}'s side.
        </p>
        <fieldset>
          <legend className="mb-2 font-bold">What went wrong?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(DISPUTE_REASONS) as DisputeReason[]).map((r) => (
              <label
                key={r}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center rounded-[var(--radius-tile)] border-2 px-3 font-bold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-cobalt-bright",
                  reason === r ? "border-kiln bg-kiln-wash text-kiln-deep" : "border-grout-deep hover:border-ink-soft",
                )}
              >
                <input type="radio" name="reason" className="sr-only" checked={reason === r} onChange={() => setReason(r)} />
                {DISPUTE_REASONS[r]}
              </label>
            ))}
          </div>
          {errReason && <p className="mt-2 text-sm font-bold text-kiln-deep">{errReason}</p>}
        </fieldset>
        <Field label="Describe the problem" error={errDetails}>
          {(p) => <textarea {...p} className="field" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1200} placeholder="Which part isn't right, and what did you agree with the worker?" />}
        </Field>
        <div>
          <p className="mb-2 font-bold">
            Photos <span className="font-normal text-ink-soft">(strongly recommended)</span>
          </p>
          <PhotoPicker value={evidence} onChange={setEvidence} max={6} />
        </div>
        <div className="flex flex-wrap gap-2 border-t border-grout pt-4">
          <Button type="submit" variant="danger" className="!bg-kiln !text-tile hover:!bg-kiln/90">
            Report problem and freeze payment
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
