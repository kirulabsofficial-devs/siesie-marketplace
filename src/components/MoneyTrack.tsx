import { Check, Lock, Pause, Undo2, Wallet } from "lucide-react";
import type { EscrowState, Job, Worker } from "../data/types";
import { BRAND } from "../config";
import { escrowState } from "../data/store";
import { cn } from "../lib/cn";
import { date, firstName, money, timeLeft } from "../lib/format";

/**
 * The signature element: where the money is right now.
 * Three empty tile slots (customer, held, worker) and a glazed tile that is set into
 * whichever slot currently holds the funds. Colour encodes escrow state and nothing else.
 */

type Station = 0 | 1 | 2;

const STATE_STYLE: Record<EscrowState, { fill: string; rail: string; icon: typeof Lock; label: string }> = {
  unpaid: { fill: "bg-tile border-2 border-ink text-ink", rail: "bg-transparent", icon: Wallet, label: "Not paid" },
  held: { fill: "bg-ochre text-ink border-2 border-ochre", rail: "bg-ochre", icon: Lock, label: "Held" },
  disputed: { fill: "bg-kiln text-tile border-2 border-kiln", rail: "bg-kiln", icon: Pause, label: "Frozen" },
  released: { fill: "bg-celadon text-tile border-2 border-celadon", rail: "bg-celadon", icon: Check, label: "Released" },
  refunded: { fill: "bg-cobalt text-tile border-2 border-cobalt", rail: "bg-transparent", icon: Undo2, label: "Refunded" },
  split: { fill: "bg-celadon text-tile border-2 border-celadon", rail: "bg-celadon", icon: Check, label: "Split" },
};

const LEFT = ["0%", "50%", "100%"];

export interface MoneyTrackProps {
  state: EscrowState;
  amount: number;
  workerName: string;
  customerLabel?: string;
  /** Amounts after a split resolution. */
  split?: { toWorker: number; toCustomer: number };
  caption?: React.ReactNode;
  size?: "md" | "lg";
  onCobalt?: boolean;
  className?: string;
}

export function MoneyTrack({ state, amount, workerName, customerLabel = "You", split, caption, size = "md", onCobalt, className }: MoneyTrackProps) {
  const style = STATE_STYLE[state];
  const station: Station = state === "unpaid" || state === "refunded" ? 0 : state === "released" || state === "split" ? 2 : 1;
  const slot = size === "lg" ? "size-14 sm:size-16" : "size-12";
  const Icon = style.icon;
  const muted = onCobalt ? "text-tile/70" : "text-ink-soft";
  const strong = onCobalt ? "text-tile" : "text-ink";

  const stationAmount = (i: Station) => {
    if (state === "split" && split) {
      if (i === 0) return money(split.toCustomer);
      if (i === 2) return money(split.toWorker);
      return null;
    }
    return i === station ? money(amount) : null;
  };

  const names = [customerLabel, `Held by ${BRAND.name}`, firstName(workerName)];

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn("relative", size === "lg" ? "mx-7 sm:mx-8" : "mx-6")}
        role="img"
        aria-label={`Money: ${style.label.toLowerCase()}, ${
          state === "split" && split ? `${money(split.toWorker)} to ${workerName}, ${money(split.toCustomer)} refunded` : `${money(amount)} ${station === 0 ? "with the customer" : station === 1 ? `held by ${BRAND.name}` : `with ${workerName}`}`
        }`}
      >
        <div className={cn("relative", size === "lg" ? "h-14 sm:h-16" : "h-12")}>
          {/* grout line */}
          <div className={cn("absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full", onCobalt ? "bg-tile/25" : "bg-grout-deep")} />
          {/* path the money has travelled */}
          <div
            className={cn("absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full transition-[width,background-color] duration-700 ease-[var(--ease-set)]", style.rail)}
            style={{ width: LEFT[station] }}
          />
          {/* empty slots */}
          {LEFT.map((left, i) => (
            <div
              key={i}
              className={cn(
                "absolute top-0 -translate-x-1/2 rounded-[var(--radius-tile)] border-2 border-dashed",
                slot,
                onCobalt ? "border-tile/35 bg-cobalt" : "border-grout-deep bg-tile-dim",
              )}
              style={{ left }}
            />
          ))}
          {/* the glazed tile(s) */}
          {state === "split" ? (
            <>
              <Token left={LEFT[0]} slot={slot} fill={STATE_STYLE.refunded.fill} Icon={Undo2} />
              <Token left={LEFT[2]} slot={slot} fill={style.fill} Icon={Check} />
            </>
          ) : (
            <Token left={LEFT[station]} slot={slot} fill={style.fill} Icon={Icon} />
          )}
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2 text-sm leading-tight">
        {names.map((name, i) => {
          const amt = stationAmount(i as Station);
          return (
            <div key={i} className={cn(i === 0 ? "text-left" : i === 1 ? "text-center" : "text-right")}>
              <div className={cn(amt ? strong : muted, amt && "font-bold")}>{name}</div>
              <div className={cn("figure mt-0.5 text-[0.8125rem]", strong, !amt && "invisible")} aria-hidden={!amt}>
                {amt ?? "—"}
              </div>
            </div>
          );
        })}
      </div>
      {caption && <p className={cn("mt-3 text-[0.9375rem]", onCobalt ? "text-tile/85" : "text-ink-soft")}>{caption}</p>}
    </div>
  );
}

function Token({ left, slot, fill, Icon }: { left: string; slot: string; fill: string; Icon: typeof Lock }) {
  return (
    <div
      className={cn(
        "absolute top-0 grid -translate-x-1/2 place-items-center rounded-[var(--radius-tile)] shadow-[var(--shadow-tile)]",
        "transition-[left,background-color,border-color,color] duration-700 ease-[var(--ease-set)]",
        slot,
        fill,
      )}
      style={{ left }}
    >
      <Icon className="size-5" strokeWidth={2.5} aria-hidden />
    </div>
  );
}

/** Three tiny slots for tables and list rows. */
export function MoneyGlyph({ state, className }: { state: EscrowState; className?: string }) {
  const style = STATE_STYLE[state];
  const filled: Station[] = state === "unpaid" ? [] : state === "refunded" ? [0] : state === "released" ? [2] : state === "split" ? [0, 2] : [1];
  const color = (i: Station) => {
    if (!filled.includes(i)) return "bg-tile border border-grout-deep";
    if (state === "split" && i === 0) return "bg-cobalt";
    return style.fill.split(" ")[0];
  };
  return (
    <span className={cn("inline-flex items-center gap-[3px]", className)} role="img" aria-label={`Money ${style.label.toLowerCase()}`}>
      {([0, 1, 2] as Station[]).map((i) => (
        <span key={i} className={cn("size-2.5 rounded-[2px]", color(i))} />
      ))}
    </span>
  );
}

export const ESCROW_LABEL: Record<EscrowState, string> = {
  unpaid: "Not paid",
  held: "Held",
  disputed: "Frozen",
  released: "Released",
  refunded: "Refunded",
  split: "Split",
};

/** Builds the track for a real job, with a caption written for whoever is looking. */
export function JobMoneyTrack({ job, worker, perspective, confirmWindowHours }: { job: Job; worker: Worker; perspective: "customer" | "worker" | "admin"; confirmWindowHours: number }) {
  const state = escrowState(job);
  const w = firstName(worker.name);
  const amount = job.payment?.amount ?? job.quote?.amount ?? 0;
  const r = job.dispute?.resolution;
  const left = job.confirmBy ? timeLeft(job.confirmBy) : null;
  const windowHours = job.confirmBy && job.completedAt ? Math.round((Date.parse(job.confirmBy) - Date.parse(job.completedAt)) / 3600_000) : confirmWindowHours;

  let caption: React.ReactNode = null;
  const you = perspective === "customer";
  switch (job.status) {
    case "requested":
      caption = you ? `Nothing is paid until ${w} accepts and you agree on the price.` : "Nothing is paid until you accept and the customer pays.";
      break;
    case "quoted":
      caption = you
        ? `When you pay, ${BRAND.name} holds the money. ${w} is paid only after you confirm the work.`
        : "Waiting for the customer to pay. Don't start until the money shows as held.";
      break;
    case "declined":
    case "cancelled":
      caption = "No money moved on this booking.";
      break;
    case "in_progress":
      caption = you
        ? `Paid ${date(job.payment!.paidAt)}. ${w} sees the money is secured but can't receive it until you confirm.`
        : "The customer's payment is secured. It's released to you after they confirm the work.";
      break;
    case "completed":
      caption = you
        ? `${w} says the job is done. Check the work${left ? ` (${left})` : ""}. If you don't respond within ${windowHours} hours, the payout is queued for admin release.`
        : `Waiting for the customer to check the work${left ? ` (${left})` : ""}. If they don't raise a problem, your payout is queued for admin release.`;
      break;
    case "confirmed":
      caption = job.autoConfirmed
        ? `The ${windowHours}-hour window closed with no dispute. The payout to ${you || perspective === "admin" ? w : "you"} is queued for admin release.`
        : `Confirmed ${date(job.confirmedAt!)}. The payout to ${you || perspective === "admin" ? w : "you"} is queued for admin release.`;
      break;
    case "disputed":
      caption = `Frozen while ${BRAND.name} reviews both sides. Nobody can move this money until the dispute is resolved.`;
      break;
    case "closed":
      if (r?.outcome === "refund") caption = `Refunded in full on ${date(r.at)}.`;
      else if (r?.outcome === "split") caption = `Dispute settled on ${date(r.at)}: part paid to ${w}, part refunded.`;
      else caption = job.payout?.sentAt ? `Released on ${date(job.payout.sentAt)}.` : "Released.";
      if (perspective === "worker" && job.payout) caption = <>{caption} You received <span className="figure font-bold text-ink">{money(job.payout.net)}</span> after the {money(job.payout.commission)} platform fee.</>;
      break;
  }

  return (
    <MoneyTrack
      state={state}
      amount={amount}
      workerName={perspective === "worker" ? "You" : worker.name}
      customerLabel={perspective === "customer" ? "You" : "Customer"}
      split={r?.outcome === "split" ? { toWorker: r.toWorker, toCustomer: r.toCustomer } : undefined}
      caption={caption}
    />
  );
}
