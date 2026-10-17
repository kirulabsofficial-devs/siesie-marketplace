/**
 * Payment seam. The test builds simulate Paystack; the live build calls the payment
 * Edge Functions in supabase/functions, which hold the secret key.
 *
 * Collection (customer pays):
 *   1. startLiveCheckout -> paystack-checkout initializes the transaction in pesewas and
 *      returns Paystack's checkout page, which takes mobile money or a card.
 *   2. Paystack sends the customer back to /jobs/:id?payment=<reference>. The job page
 *      asks paystack-checkout to verify that reference; the `charge.success` webhook does
 *      the same. Either way the server re-verifies with Paystack before marking it paid.
 *
 * Payout (worker gets paid):
 *   paystack-payouts runs every 10 minutes and straight after a customer confirms. It
 *   transfers the payout's net amount; the commission stays in Siesie's Paystack balance.
 *   Webhooks `transfer.success` / `transfer.failed` / `transfer.reversed` update payout.status.
 *
 * Paystack has no native escrow. "Held" is a state in our database, not in Paystack.
 */
import type { MomoNetwork } from "../data/types";
import { MOMO_NETWORKS } from "../config";
import { reference } from "../lib/format";
import { LIVE_BACKEND } from "../data/runtime";
import { requireSupabase } from "../data/supabase";

export const TEST_MODE = !LIVE_BACKEND;

export function detectNetwork(phoneNumber: string): MomoNetwork | null {
  const d = phoneNumber.replace(/\D/g, "").replace(/^233/, "0");
  const prefix = d.slice(0, 3);
  for (const [id, n] of Object.entries(MOMO_NETWORKS) as [MomoNetwork, (typeof MOMO_NETWORKS)[MomoNetwork]][]) {
    if (n.prefixes.includes(prefix)) return id;
  }
  return null;
}

export function isValidGhanaMobile(phoneNumber: string) {
  const d = phoneNumber.replace(/\D/g, "").replace(/^233/, "0");
  return /^0[235]\d{8}$/.test(d);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ChargeResult {
  reference: string;
  channel: "momo" | "card";
  network?: MomoNetwork;
  payer: string;
}

/** Simulates the MoMo prompt round-trip. `approve=false` simulates the customer declining on their phone. */
export async function simulateCharge(input: { channel: "momo"; phone: string; network: MomoNetwork; approve: boolean } | { channel: "card"; last4: string }): Promise<ChargeResult> {
  if (LIVE_BACKEND) throw new Error("Live payments have not been activated. No money was taken.");
  await wait(input.channel === "momo" ? 2200 : 1400);
  if (input.channel === "momo") {
    if (!input.approve) throw new Error("The payment was declined on the phone. No money was taken.");
    const d = input.phone.replace(/\D/g, "");
    return { reference: reference("PSK"), channel: "momo", network: input.network, payer: `${d.slice(0, 3)} ••• ${d.slice(-3)}` };
  }
  return { reference: reference("PSK"), channel: "card", payer: `Card ••${input.last4}` };
}

export async function simulateTransfer(): Promise<string> {
  if (LIVE_BACKEND) throw new Error("Live payouts have not been activated. No money was sent.");
  await wait(900);
  return reference("TRF");
}

// ── Live ────────────────────────────────────────────────────────────────────

async function invoke<T>(name: string, body: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await requireSupabase().functions.invoke(name, { body });
  if (error) {
    const reply = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(typeof reply?.error === "string" ? reply.error : fallback);
  }
  return data as T;
}

/** Sends the customer to Paystack's checkout page. Paystack brings them back to the job. */
export async function startLiveCheckout(jobId: string) {
  const { url } = await invoke<{ url: string }>("paystack-checkout", { jobId }, "Payment couldn't start. No money was taken. Please try again.");
  if (!/^https:\/\/([a-z0-9-]+\.)*paystack\.(com|co)\//.test(url)) throw new Error("Payment couldn't start. No money was taken. Please try again.");
  window.location.assign(url);
}

/** Asks the server to check a checkout with Paystack. Returns "recorded", "handled", "not_paid", "refund" or "unknown". */
export async function verifyLiveCheckout(reference: string) {
  const { outcome } = await invoke<{ outcome: string }>("paystack-checkout", { verify: reference }, "We couldn't check the payment yet.");
  return outcome;
}

/** Nudges the payout queue. Best effort: the scheduled run catches anything this misses. */
export function triggerLivePayouts() {
  return invoke("paystack-payouts", { action: "process" }, "").then(() => undefined, () => undefined);
}

export const retryLivePayout = (jobId: string) => invoke("paystack-payouts", { action: "retry", jobId }, "The payout couldn't be retried. Please try again.");

export const resolveLiveDispute = (jobId: string, toWorker: number, note: string) =>
  invoke("paystack-payouts", { action: "resolve", jobId, toWorker, note }, "We couldn't confirm the decision was recorded. Refresh to check before trying again.");
