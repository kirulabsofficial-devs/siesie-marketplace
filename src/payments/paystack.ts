/**
 * Payment seam. The demo simulates Paystack; production swaps these two functions for
 * calls to our own backend, which talks to Paystack with the secret key.
 *
 * Collection (customer pays):
 *   1. Frontend: POST /api/payments/initialize { jobId }            -> { accessCode, reference }
 *      Server calls Paystack POST /transaction/initialize with amount in pesewas,
 *      currency "GHS", channels ["mobile_money", "card"], metadata { jobId }.
 *   2. Frontend: new PaystackPop().resumeTransaction(accessCode)   (@paystack/inline-js)
 *   3. Server: webhook `charge.success` -> verify signature + amount -> job.status = in_progress.
 *      The frontend only polls GET /api/jobs/:id; it never marks a job paid itself.
 *
 * Payout (worker gets paid):
 *   Server: Paystack POST /transferrecipient (type "mobile_money" or "ghipss") once per worker,
 *   then POST /transfer { amount: net, recipient, reference } when an admin releases.
 *   Webhooks `transfer.success` / `transfer.failed` / `transfer.reversed` update payout.status.
 *
 * Paystack has no native escrow. "Held" is a state in our database, not in Paystack.
 */
import type { MomoNetwork } from "../data/types";
import { MOMO_NETWORKS } from "../config";
import { reference } from "../lib/format";
import { LIVE_BACKEND } from "../data/runtime";

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
