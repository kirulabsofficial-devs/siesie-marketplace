/*
 * Paystack money flows shared by the payment Edge Functions.
 *
 * Plain TypeScript with no Deno or npm imports, so tests can run it in Node against
 * a real database and a fake Paystack. Every database change goes through the
 * service-role `siesie_payments` function; this file only talks to Paystack and
 * reports what Paystack said.
 *
 *   Customer pays   startCheckout -> Paystack checkout page -> charge.success webhook
 *                   (or the customer's return) -> applyCharge verifies and records it.
 *   Worker is paid  processPayouts claims confirmed jobs and transfers the net amount.
 *                   Siesie's commission stays in the Paystack balance.
 *   Refunds         applyCharge refunds payments a booking can't take; resolveDispute
 *                   refunds the customer's share of a dispute.
 */

export type Rpc = (action: string, input: Record<string, unknown>) => Promise<any>;
export type PaystackCall = (method: "GET" | "POST", path: string, body?: Record<string, unknown>) => Promise<any>;
export interface Deps {
  rpc: Rpc;
  paystack: PaystackCall;
  log?: (message: string) => void;
}

/** `ambiguous` means Paystack may have acted on the request even though no clear answer came back. */
export class PaystackError extends Error {
  status: number;
  ambiguous: boolean;
  constructor(message: string, status: number, ambiguous: boolean) {
    super(message);
    this.status = status;
    this.ambiguous = ambiguous;
  }
}

export function paystackApi(secret: string, fetchImpl: typeof fetch = fetch): PaystackCall {
  return async (method, path, body) => {
    let res: Response;
    try {
      res = await fetchImpl(`https://api.paystack.co${path}`, {
        method,
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new PaystackError("Paystack could not be reached.", 0, true);
    }
    const json = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: unknown } | null;
    if (!res.ok || !json?.status) throw new PaystackError(json?.message || `Paystack returned ${res.status}.`, res.status, !json || res.status === 429 || res.status >= 500);
    return json.data;
  };
}

export const toPesewas = (cedis: number) => Math.round(cedis * 100);

/** Paystack signs each webhook body with HMAC SHA-512 keyed by the secret key. */
export async function signatureValid(secret: string, rawBody: string, signature: string | null) {
  if (!signature || !/^[0-9a-f]{128}$/i.test(signature)) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody)));
  const expected = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  const given = signature.toLowerCase();
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

const CHECKOUT_REFERENCE = /^sie_[0-9a-f]{32}$/;
const NETWORKS: Record<string, string> = { mtn: "mtn", vod: "telecel", telecel: "telecel", atl: "airteltigo", tgo: "airteltigo", airteltigo: "airteltigo" };

function chargeInput(tx: any) {
  const momo = tx.channel === "mobile_money";
  const auth = tx.authorization ?? {};
  const last = String(auth.last4 ?? "").replace(/\D/g, "");
  return {
    reference: tx.reference,
    amount: Number(tx.amount) / 100,
    currency: tx.currency,
    channel: momo ? "momo" : "card",
    network: momo ? NETWORKS[String(auth.bank ?? "").toLowerCase()] : undefined,
    payer: momo ? (last ? `MoMo ••• ${last.slice(-3)}` : "Mobile money") : last ? `Card ••${last.slice(-4)}` : "Card",
    paidAt: tx.paid_at ?? tx.paidAt ?? undefined,
  };
}

/** Asks Paystack about a checkout and applies the answer. Safe to call any number of times. */
export async function applyCharge(deps: Deps, reference: string): Promise<{ outcome: string }> {
  if (!CHECKOUT_REFERENCE.test(reference)) return { outcome: "unknown" };
  let tx: any;
  try {
    tx = await deps.paystack("GET", `/transaction/verify/${reference}`);
  } catch (error) {
    if (error instanceof PaystackError && !error.ambiguous) return { outcome: "not_paid" };
    throw error;
  }
  if (tx?.status !== "success" || tx.reference !== reference) return { outcome: "not_paid" };
  const result = await deps.rpc("charge_success", chargeInput(tx));
  if (result?.outcome === "refund") await refund(deps, reference);
  return { outcome: String(result?.outcome ?? "unknown") };
}

const refundStatus = (status: unknown) =>
  status === "processed" || status === "processing" || status === "failed" ? status : status === "needs-attention" ? "check" : "pending";

/** Refunds a Paystack payment, in full unless an amount is given. Never retried automatically. */
export async function refund(deps: Deps, reference: string, amount?: number) {
  try {
    const data = await deps.paystack("POST", "/refund", amount === undefined ? { transaction: reference } : { transaction: reference, amount: toPesewas(amount) });
    await deps.rpc("refund_update", { reference, status: refundStatus(data?.status), refundId: data?.id != null ? String(data.id) : undefined });
  } catch (error) {
    if (!(error instanceof PaystackError)) throw error;
    await deps.rpc("refund_update", {
      reference,
      status: error.ambiguous ? "check" : "failed",
      failure: error.ambiguous ? "Paystack did not answer. Check the Paystack dashboard before refunding again." : error.message,
    });
  }
}

function failureText(data: any): string | undefined {
  const reason = data?.reason ?? data?.failures ?? data?.gateway_response;
  if (typeof reason === "string" && reason.trim()) return reason.slice(0, 300);
  return reason ? JSON.stringify(reason).slice(0, 300) : undefined;
}

/** Returns the HTTP status for Paystack. Anything other than 200 makes Paystack retry later. */
export async function handleWebhook(deps: Deps, secret: string, rawBody: string, signature: string | null): Promise<number> {
  if (!(await signatureValid(secret, rawBody, signature))) return 401;
  let event: { event?: unknown; data?: any };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return 400;
  }
  const name = String(event.event ?? "");
  const data = event.data ?? {};
  if (name === "charge.success") {
    // The event is only a prompt: the charge is re-verified with Paystack before use.
    await applyCharge(deps, String(data.reference ?? ""));
  } else if (name === "transfer.success" || name === "transfer.failed" || name === "transfer.reversed") {
    await deps.rpc("transfer_update", {
      reference: String(data.reference ?? ""),
      status: name.slice("transfer.".length),
      transferCode: typeof data.transfer_code === "string" ? data.transfer_code : undefined,
      failure: failureText(data),
    });
  } else if (name.startsWith("refund.")) {
    const reference = data.transaction_reference ?? data.transaction?.reference;
    if (typeof reference === "string") {
      await deps.rpc("refund_update", { reference, status: refundStatus(name.slice("refund.".length)), refundId: data.id != null ? String(data.id) : undefined, failure: failureText(data) });
    }
  }
  return 200;
}

interface PayoutDetails {
  type?: string;
  network?: string;
  bank?: string;
  number?: string;
  name?: string;
}
interface Claim {
  jobId: string;
  workerId: string;
  reference: string;
  amount: number;
  stale: boolean;
  payout: PayoutDetails;
  recipient: string | null;
}
export interface Bank {
  name: string;
  code: string;
}

const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(bank|ghana|gh|limited|ltd|plc|company)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

const MOMO_CODES: Record<string, string[]> = { mtn: ["MTN"], telecel: ["VOD", "TELECEL"], airteltigo: ["ATL", "AIRTELTIGO", "TGO"] };

export function momoCode(network: string, banks: Bank[]): string | null {
  const wanted = MOMO_CODES[network] ?? [];
  const found = banks.find((b) => wanted.includes(String(b.code).toUpperCase()) || wanted.some((w) => normalise(b.name).includes(w.toLowerCase())));
  return found?.code ?? (banks.length ? null : (wanted[0] ?? null));
}

/** Matches a bank name typed by a worker, like "GCB Bank", to Paystack's GHIPSS list. */
export function bankCode(name: string, banks: Bank[]): string | null {
  const want = normalise(name);
  if (!want) return null;
  const exact = banks.filter((b) => normalise(b.name) === want);
  if (exact.length === 1) return exact[0].code;
  const partial = banks.filter((b) => {
    const n = normalise(b.name);
    return n && (n.includes(want) || want.includes(n));
  });
  return partial.length === 1 ? partial[0].code : null;
}

async function createRecipient(deps: Deps, claim: Claim) {
  const p = claim.payout ?? {};
  const name = String(p.name ?? "").trim();
  const number = String(p.number ?? "").replace(/[^\d+]/g, "");
  if (!name || !number || (p.type !== "momo" && p.type !== "bank")) throw new Error("The worker's payout details are incomplete.");
  const momo = p.type === "momo";
  const banks = ((await deps.paystack("GET", `/bank?currency=GHS&type=${momo ? "mobile_money" : "ghipss"}&perPage=200`)) ?? []) as Bank[];
  const code = momo ? momoCode(String(p.network), banks) : bankCode(String(p.bank ?? ""), banks);
  if (!code) throw new Error(momo ? "Paystack does not list this mobile money network for transfers." : `Paystack does not list “${p.bank}” for transfers. Ask the worker to check their bank name.`);
  const data = await deps.paystack("POST", "/transferrecipient", {
    type: momo ? "mobile_money" : "ghipss",
    name,
    account_number: momo ? number.replace(/^\+?233/, "0") : number,
    bank_code: code,
    currency: "GHS",
  });
  const recipient = String(data?.recipient_code ?? "");
  if (!recipient) throw new Error("Paystack did not return a transfer recipient.");
  await deps.rpc("save_recipient", { workerId: claim.workerId, payout: p, code: recipient });
  return recipient;
}

type PayoutOutcome = "sent" | "processing" | "failed";

async function fail(deps: Deps, reference: string, failure: string, status: "failed" | "reversed" = "failed"): Promise<PayoutOutcome> {
  await deps.rpc("transfer_update", { reference, status, failure });
  return "failed";
}

async function record(deps: Deps, reference: string, transfer: any): Promise<PayoutOutcome> {
  const status = String(transfer?.status ?? "");
  const transferCode = typeof transfer?.transfer_code === "string" ? transfer.transfer_code : undefined;
  if (status === "otp") return fail(deps, reference, "Paystack asked for an OTP. Turn off OTP for transfers in Paystack, then retry this payout.");
  if (status === "success") {
    await deps.rpc("transfer_update", { reference, status: "success", transferCode });
    return "sent";
  }
  if (["failed", "reversed", "abandoned", "blocked", "rejected"].includes(status)) {
    return fail(deps, reference, failureText(transfer) ?? `Paystack marked the transfer ${status}.`, status === "reversed" ? "reversed" : "failed");
  }
  await deps.rpc("transfer_update", { reference, status: "processing", transferCode });
  return "processing";
}

async function sendPayout(deps: Deps, claim: Claim): Promise<PayoutOutcome> {
  if (claim.stale) {
    // An earlier run sent this transfer but never heard back. Ask before sending again.
    try {
      return await record(deps, claim.reference, await deps.paystack("GET", `/transfer/verify/${claim.reference}`));
    } catch (error) {
      if (!(error instanceof PaystackError) || error.ambiguous) throw error;
      // Paystack has no transfer with this reference, so sending it now cannot pay twice.
    }
  }
  let recipient = claim.recipient;
  if (!recipient) {
    try {
      recipient = await createRecipient(deps, claim);
    } catch (error) {
      if (error instanceof PaystackError && error.ambiguous) throw error;
      return fail(deps, claim.reference, error instanceof Error ? error.message : "The payout details could not be used.");
    }
  }
  try {
    const transfer = await deps.paystack("POST", "/transfer", {
      source: "balance",
      amount: toPesewas(claim.amount),
      recipient,
      reference: claim.reference,
      currency: "GHS",
      reason: `Siesie payout for ${claim.jobId}`,
    });
    return await record(deps, claim.reference, transfer);
  } catch (error) {
    // Without a clear answer the payout stays "sending"; the next run checks with Paystack first.
    if (!(error instanceof PaystackError) || error.ambiguous) throw error;
    return fail(deps, claim.reference, error.message);
  }
}

/** Confirms expired inspection windows, then sends every payout that is due. */
export async function processPayouts(deps: Deps) {
  const confirmed = Number(await deps.rpc("confirm_due", {})) || 0;
  const claims = ((await deps.rpc("claim_payouts", { limit: 20 })) ?? []) as Claim[];
  const summary = { confirmed, claimed: claims.length, sent: 0, processing: 0, failed: 0, unresolved: 0 };
  for (const claim of claims) {
    try {
      summary[await sendPayout(deps, claim)]++;
    } catch (error) {
      summary.unresolved++;
      deps.log?.(`Payout ${claim.reference} is unresolved: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return summary;
}

export async function startCheckout(deps: Deps, input: { jobId: string; userId: string; email: string; origin: string }) {
  const { reference, amount } = await deps.rpc("begin_checkout", { jobId: input.jobId, userId: input.userId });
  const back = `${input.origin}/jobs/${encodeURIComponent(input.jobId)}`;
  const data = await deps.paystack("POST", "/transaction/initialize", {
    email: input.email,
    amount: toPesewas(Number(amount)),
    currency: "GHS",
    reference,
    callback_url: `${back}?payment=${reference}`,
    channels: ["mobile_money", "card"],
    metadata: { jobId: input.jobId, cancel_action: back },
  });
  const url = String(data?.authorization_url ?? "");
  if (!url.startsWith("https://")) throw new PaystackError("Paystack did not return a checkout page.", 502, false);
  return { url, reference: String(reference) };
}

export async function retryPayout(deps: Deps, input: { jobId: string; adminId: string }) {
  await deps.rpc("retry_payout", input);
  return processPayouts(deps);
}

export async function resolveDispute(deps: Deps, input: { jobId: string; adminId: string; toWorker: number; note: string }) {
  const result = await deps.rpc("resolve_dispute", input);
  if (result?.refund) await refund(deps, String(result.refund.reference), result.refund.full ? undefined : Number(result.refund.amount));
  const payouts = result?.payout ? await processPayouts(deps) : null;
  return { refunded: !!result?.refund, payouts };
}
