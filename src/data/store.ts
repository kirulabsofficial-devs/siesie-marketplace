/**
 * Client-side stand-in for the backend. Every exported action maps to one API call the
 * real backend must provide (see README, "API contract"). State lives in localStorage so
 * the demo survives reloads; the escrow rules below are the ones the server must enforce.
 */
import { useSyncExternalStore } from "react";
import type {
  Customer,
  Db,
  DisputeReason,
  EscrowState,
  Job,
  JobEvent,
  Notice,
  Payment,
  Photo,
  Role,
  ServiceId,
  Settings,
  Worker,
  Session,
} from "./types";
import { api } from "./api";
import { createSeed, DB_VERSION } from "./seed";
import { commissionOn, money, reference, round2, uid } from "../lib/format";
import { DISPUTE_REASONS } from "../config";
import { validateWorkerProfile } from "../lib/validation";
import { LIVE_BACKEND } from "./runtime";
import { emptyLiveDb, liveSnapshot, liveAction, clearLiveImages } from "./supabaseStore";
import { requireSupabase } from "./supabase";
import { resolveLiveDispute, retryLivePayout, triggerLivePayouts } from "../payments/paystack";

const KEY = "siesie.db";

function load(): Db {
  if (LIVE_BACKEND) return emptyLiveDb();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Db;
      if (parsed.version === DB_VERSION) return parsed;
    }
  } catch {
    /* storage blocked or corrupt: fall through to a fresh seed */
  }
  return createSeed();
}

let db: Db = load();
// Never trust an account saved by an older browser-only prototype.
db.session = null;
// Preserve existing prototype data while pinning fees on previously agreed quotes.
db.jobs.forEach((job) => {
  if (job.quote && job.quote.commissionPct === undefined) job.quote.commissionPct = db.settings.commissionPct;
});
const listeners = new Set<() => void>();

function persist() {
  if (LIVE_BACKEND) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...db, session: null }));
  } catch {
    /* quota or private mode: state still lives in memory */
  }
}

function commit(mutator: (draft: Db) => void) {
  if (LIVE_BACKEND) throw new Error("This change must be saved to your account online.");
  const draft = structuredClone(db);
  mutator(draft);
  db = draft;
  persist();
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getDb() {
  return db;
}

/** Subscribes to the whole db (a new object per commit) and derives in render. */
export function useDb<T>(select: (d: Db) => T): T {
  return select(useSyncExternalStore(subscribe, getDb));
}

export function resetDemo() {
  if (LIVE_BACKEND) throw new Error("Demo resets are unavailable for live accounts.");
  try { localStorage.removeItem("siesie.chat.v1"); } catch { /* storage may be disabled */ }
  window.dispatchEvent(new Event("siesie:reset-chat"));
  const session = db.session;
  const currentCustomer = db.customers.find((c) => c.id === session?.userId);
  const currentWorker = db.workers.find((w) => w.id === session?.userId);
  db = { ...createSeed(), session };
  if (currentCustomer && !db.customers.some((c) => c.id === currentCustomer.id)) db.customers.push(currentCustomer);
  if (currentWorker && !db.workers.some((w) => w.id === currentWorker.id)) db.workers.push(currentWorker);
  persist();
  listeners.forEach((l) => l());
}

// ── Lookups ────────────────────────────────────────────────────────────────

export const findWorker = (d: Db, id: string) => d.workers.find((w) => w.id === id);
export const findCustomer = (d: Db, id: string) => d.customers.find((c) => c.id === id);
export const findJob = (d: Db, id: string) => d.jobs.find((j) => j.id === id);

export function escrowState(job: Job): EscrowState {
  switch (job.status) {
    case "requested":
    case "quoted":
    case "declined":
    case "cancelled":
      return "unpaid";
    case "in_progress":
    case "completed":
    case "confirmed":
      return "held";
    case "disputed":
      return "disputed";
    case "closed": {
      const r = job.dispute?.resolution;
      if (r?.outcome === "refund") return "refunded";
      if (r?.outcome === "split") return "split";
      return "released";
    }
  }
}

export interface WorkerStats {
  rating: number | null;
  reviews: number;
  jobsDone: number;
}

export function workerStats(d: Db, workerId: string): WorkerStats {
  if (LIVE_BACKEND) {
    const worker = findWorker(d, workerId);
    return { rating: worker?.rating ?? null, reviews: worker?.reviewCount ?? 0, jobsDone: worker?.jobsDone ?? 0 };
  }
  const done = d.jobs.filter((j) => j.workerId === workerId && (j.status === "closed" || j.status === "confirmed") && escrowState(j) !== "refunded");
  const rated = done.filter((j) => j.customerReview);
  const rating = rated.length ? rated.reduce((s, j) => s + j.customerReview!.rating, 0) / rated.length : null;
  return { rating: rating === null ? null : Math.round(rating * 10) / 10, reviews: rated.length, jobsDone: done.length };
}

export function currentUserName(d: Db) {
  const s = d.session;
  if (!s) return null;
  if (s.role === "customer") return findCustomer(d, s.userId)?.name ?? null;
  if (s.role === "worker") return findWorker(d, s.userId)?.name ?? null;
  return d.admins.find((a) => a.id === s.userId)?.name ?? null;
}

// ── Internal helpers ───────────────────────────────────────────────────────

function now() {
  return new Date().toISOString();
}

function mustJob(d: Db, id: string) {
  const j = findJob(d, id);
  if (!j) throw new ActionError(`Job ${id} doesn't exist.`);
  return j;
}

export class ActionError extends Error {}

function requireActor(d: Db, role: Role, userId?: string) {
  if (d.session?.role !== role || (userId && d.session.userId !== userId)) {
    throw new ActionError("Log in to the account responsible for this action.");
  }
}

function jobActor(d: Db, job: Job, role: "customer" | "worker") {
  requireActor(d, role, role === "customer" ? job.customerId : job.workerId);
}

function requirePrice(amount: number) {
  if (!Number.isFinite(amount) || amount < 0.01 || amount > 1_000_000) {
    throw new ActionError("Enter a price between GH₵ 0.01 and GH₵ 1,000,000.");
  }
}

export function jobCommissionPct(d: Db, job: Job) {
  return job.quote?.commissionPct ?? d.settings.commissionPct;
}

function guard(job: Job, allowed: Job["status"][], action: string) {
  if (!allowed.includes(job.status)) {
    throw new ActionError(`Can't ${action}: this job is ${job.status.replace("_", " ")}.`);
  }
}

function log(job: Job, by: JobEvent["by"], text: string) {
  job.events.push({ at: now(), by, text });
}

function notify(d: Db, to: string, text: string, jobId?: string) {
  const n: Notice = { id: uid("n"), to, text, jobId, at: now(), read: false };
  d.notices.unshift(n);
}

function payoutDestination(w: Worker) {
  const p = w.payout;
  return p.type === "momo" ? `MoMo ${p.number}` : `${p.bank} ••${p.number.slice(-4)}`;
}

function queuePayout(d: Db, job: Job, gross: number) {
  const { commission, net } = commissionOn(gross, jobCommissionPct(d, job));
  const w = findWorker(d, job.workerId)!;
  job.payout = {
    reference: reference("TRF"),
    gross,
    commission,
    net,
    destination: payoutDestination(w),
    status: "queued",
    queuedAt: now(),
  };
}

/**
 * Jobs whose inspection window has passed without a dispute are treated as confirmed.
 * On the server this is a scheduled job; here it runs on load and once a minute.
 */
export function sweepExpiredWindows() {
  if (LIVE_BACKEND) return;
  const t = Date.now();
  const due = db.jobs.filter((j) => j.status === "completed" && j.confirmBy && new Date(j.confirmBy).getTime() <= t);
  if (!due.length) return;
  commit((d) => {
    for (const id of due.map((j) => j.id)) {
      const job = mustJob(d, id);
      job.status = "confirmed";
      job.confirmedAt = job.confirmBy;
      job.autoConfirmed = true;
      queuePayout(d, job, job.payment!.amount);
      log(job, "system", "Inspection deadline passed with no dispute. Payout queued");
      notify(d, job.workerId, `The inspection window on “${job.title}” closed with no dispute. Your payout is queued.`, job.id);
    }
  });
}

// ── Session ────────────────────────────────────────────────────────────────

interface SessionResponse {
  session: Session | null;
  user: { id: string; role: Role; name: string; phone: string; area: string; services: ServiceId[]; joinedAt: string } | null;
  testMode: boolean;
}
let sessionState = { ready: false, pending: false, testMode: !LIVE_BACKEND, error: "" };
const sessionListeners = new Set<() => void>();
const sessionSubscribe = (fn: () => void) => { sessionListeners.add(fn); return () => { sessionListeners.delete(fn); }; };
function setSessionState(next: Partial<typeof sessionState>) { sessionState = { ...sessionState, ...next }; sessionListeners.forEach((fn) => fn()); }
export const useSessionState = () => useSyncExternalStore(sessionSubscribe, () => sessionState);
let sessionGeneration = 0;
let liveRefresh: { generation: number; promise: Promise<void> } | null = null;
function applySession(result: SessionResponse) {
  const changed = db.session?.userId !== result.session?.userId;
  commit((d) => {
    const u = result.user;
    if (u?.role === "customer" && !d.customers.some((c) => c.id === u.id)) d.customers.push({ id: u.id, name: u.name, phone: u.phone, area: u.area, joinedAt: u.joinedAt });
    if (u?.role === "worker" && !d.workers.some((w) => w.id === u.id)) d.workers.push({
      id: u.id, name: u.name, phone: u.phone, baseArea: u.area, areas: [u.area], services: u.services,
      bio: "", pricing: { mode: "quote", from: 100, to: 500, unit: "per job" }, availability: { days: [], note: "" },
      verification: "pending", payout: { type: "momo", network: "mtn", number: u.phone, name: u.name }, portfolio: [], joinedAt: u.joinedAt, yearsExperience: 0,
    });
    d.session = result.session;
  });
  setSessionState({ ready: true, testMode: result.testMode, error: "" });
  if (changed) window.dispatchEvent(new Event("siesie:account-changed"));
}
export async function refreshSession() {
  if (sessionState.pending) return;
  const generation = sessionGeneration;
  if (LIVE_BACKEND) {
    if (liveRefresh?.generation === generation) return liveRefresh.promise;
    const promise = (async () => { try {
      const next = await liveSnapshot();
      if (generation !== sessionGeneration) return;
      const changed = db.session?.userId !== next.session?.userId;
      db = next;
      listeners.forEach((fn) => fn());
      setSessionState({ ready: true, testMode: false, error: "" });
      if (changed) window.dispatchEvent(new Event("siesie:account-changed"));
    } catch (error) {
      if (generation !== sessionGeneration) return;
      setSessionState({ ready: true, error: (error as Error).message });
    }
    })();
    liveRefresh = { generation, promise };
    try { await promise; } finally { if (liveRefresh?.promise === promise) liveRefresh = null; }
    return;
  }
  try { const result = await api<SessionResponse>("/session"); if (generation === sessionGeneration) applySession(result); }
  catch (error) { if (generation === sessionGeneration) setSessionState({ ready: true, error: (error as Error).message }); }
}
async function sessionAction(path: string, input: unknown) {
  if (sessionState.pending) throw new ActionError("Please wait for the account change to finish.");
  sessionGeneration++;
  setSessionState({ pending: true, error: "" });
  try {
    const result = await api<SessionResponse>(path, input);
    applySession(result);
    return result;
  } finally { setSessionState({ pending: false }); }
}
export async function signIn(role: Role, userId: string) {
  if (LIVE_BACKEND) throw new Error("Log in with your own account.");
  await sessionAction("/test/session", { role, userId });
}
export async function signInWithCode(phone: string, code: string) {
  if (LIVE_BACKEND) throw new Error("Use the secure account login.");
  if (sessionState.pending) throw new ActionError("Please wait for the account change to finish.");
  sessionGeneration++;
  setSessionState({ pending: true });
  try {
    const result = await api<SessionResponse & { needsRegistration?: boolean }>("/test/login", { phone, code });
    if (!result.needsRegistration) applySession(result);
    return result.needsRegistration ? null : result.session;
  } finally { setSessionState({ pending: false }); }
}
export async function signOut() {
  if (sessionState.pending) return;
  sessionGeneration++;
  setSessionState({ pending: true });
  try {
    if (LIVE_BACKEND) {
      const { error } = await requireSupabase().auth.signOut();
      if (error) throw error;
      clearLiveState();
      setSessionState({ ready: true });
      window.dispatchEvent(new Event("siesie:logout"));
      return;
    }
    await api("/session/logout", {});
    window.dispatchEvent(new Event("siesie:logout"));
    applySession({ session: null, user: null, testMode: sessionState.testMode });
  } catch (error) { window.dispatchEvent(new CustomEvent("siesie:error", { detail: (error as Error).message })); }
  finally { setSessionState({ pending: false }); }
}
window.addEventListener("siesie:session-expired", () => {
  sessionGeneration++;
  if (LIVE_BACKEND) {
    clearLiveState();
    setSessionState({ ready: true, error: "Your session has ended. Please log in again." });
    void requireSupabase().auth.signOut({ scope: "local" });
    return;
  }
  applySession({ session: null, user: null, testMode: sessionState.testMode });
});

export function findAccountByPhone(d: Db, phoneDigits: string): { role: Role; id: string } | null {
  const norm = (p: string) => p.replace(/\D/g, "").replace(/^233/, "0");
  const target = norm(phoneDigits);
  const c = d.customers.find((x) => norm(x.phone) === target);
  if (c) return { role: "customer", id: c.id };
  const w = d.workers.find((x) => norm(x.phone) === target);
  if (w) return { role: "worker", id: w.id };
  const a = d.admins.find((x) => norm(x.phone) === target);
  if (a) return { role: "admin", id: a.id };
  return null;
}

export async function registerCustomer(input: Omit<Customer, "id" | "joinedAt">) {
  if (LIVE_BACKEND) throw new Error("Create your account using the secure sign-up form.");
  const result = await sessionAction("/test/register", { ...input, role: "customer", code: "123456" });
  return result.session!.userId;
}

export function markNoticesRead(userId: string) {
  if (LIVE_BACKEND) return remoteAction("read_notices", { userId });
  commit((d) => {
    d.notices.forEach((n) => {
      if (n.to === userId) n.read = true;
    });
  });
}

// ── Customer actions ───────────────────────────────────────────────────────

export interface BookingInput {
  customerId: string;
  workerId: string;
  service: ServiceId;
  title: string;
  scope: string;
  address: string;
  area: string;
  preferredDate: string;
  photos: Photo[];
}

/** POST /jobs */
export function requestBooking(input: BookingInput) {
  const id = `SS-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
  if (LIVE_BACKEND) return remoteAction<string>("request_booking", { ...input, id });
  commit((d) => {
    requireActor(d, "customer", input.customerId);
    const worker = findWorker(d, input.workerId);
    if (!worker || worker.verification !== "verified") throw new ActionError("Choose a verified worker.");
    if (!worker.services.includes(input.service) || !worker.areas.includes(input.area)) throw new ActionError("Choose a service and area this worker covers.");
    if (input.title.trim().length < 4 || input.scope.trim().length < 20 || input.address.trim().length < 4) throw new ActionError("Add a job title, details and address.");
    if (!Number.isFinite(Date.parse(input.preferredDate)) || Date.parse(input.preferredDate) < new Date().setHours(0, 0, 0, 0)) throw new ActionError("Choose today or a later date.");
    const job: Job = { ...input, id, status: "requested", createdAt: now(), events: [] };
    log(job, "customer", "Booking requested");
    d.jobs.push(job);
    const c = findCustomer(d, input.customerId)!;
    notify(d, input.workerId, `New request from ${c.name.split(" ")[0]}: ${input.title}`, id);
  });
  return id;
}

/** POST /jobs/:id/cancel — only before money moves. */
export function cancelRequest(jobId: string) {
  if (LIVE_BACKEND) return remoteAction("cancel", { jobId });
  commit((d) => {
    const job = mustJob(d, jobId);
    jobActor(d, job, "customer");
    guard(job, ["requested", "quoted"], "cancel");
    job.status = "cancelled";
    log(job, "customer", "Request withdrawn");
    notify(d, job.workerId, `The customer withdrew “${job.title}”.`, jobId);
  });
}

/**
 * Called after the payment provider's webhook confirms `charge.success`.
 * The frontend must never mark a job paid on its own in production.
 */
export function recordPayment(jobId: string, payment: Omit<Payment, "paidAt">) {
  if (LIVE_BACKEND) throw new Error("Payments must be confirmed by the payment provider.");
  commit((d) => {
    const job = mustJob(d, jobId);
    jobActor(d, job, "customer");
    requirePrice(payment.amount);
    if (Math.abs(payment.amount - round2(payment.amount)) > 1e-8) throw new ActionError("Payments must be recorded to the nearest pesewa.");
    if (!payment.reference.trim() || d.jobs.some((j) => j.payment?.reference === payment.reference)) throw new ActionError("This payment reference has already been used or is missing.");
    guard(job, ["quoted"], "record payment");
    if (!job.quote || round2(payment.amount) !== round2(job.quote.amount)) {
      throw new ActionError("Payment amount doesn't match the agreed price.");
    }
    job.payment = { ...payment, paidAt: now() };
    job.status = "in_progress";
    log(job, "customer", `Paid ${money(payment.amount)}. Funds held by platform`);
    notify(d, job.workerId, `Payment secured for “${job.title}”. You can start the job.`, jobId);
  });
}

/** POST /jobs/:id/confirm */
export function confirmCompletion(jobId: string) {
  // The payout is sent straight away; the scheduled run retries if this nudge fails.
  if (LIVE_BACKEND) return remoteAction("confirm", { jobId }).then(() => { void triggerLivePayouts().then(refreshSession); });
  commit((d) => {
    const job = mustJob(d, jobId);
    jobActor(d, job, "customer");
    guard(job, ["completed"], "confirm");
    job.status = "confirmed";
    job.confirmedAt = now();
    queuePayout(d, job, job.payment!.amount);
    log(job, "customer", "Confirmed the work. Payout queued");
    notify(d, job.workerId, `The customer confirmed “${job.title}”. Your payout of ${money(job.payout!.net)} is queued.`, jobId);
  });
}

/** POST /jobs/:id/disputes */
export function openDispute(jobId: string, reason: DisputeReason, details: string, evidence: Photo[]) {
  if (LIVE_BACKEND) return remoteAction("dispute", { jobId, reason, details, evidence });
  commit((d) => {
    const job = mustJob(d, jobId);
    jobActor(d, job, "customer");
    if (!Object.hasOwn(DISPUTE_REASONS, reason) || details.trim().length < 15) throw new ActionError("Choose a reason and explain the problem.");
    guard(job, ["in_progress", "completed"], "raise a dispute");
    job.status = "disputed";
    job.dispute = { reason, details, evidence, openedAt: now() };
    log(job, "customer", `Raised a dispute: ${DISPUTE_REASONS[reason].toLowerCase()}`);
    notify(d, job.workerId, `The customer raised a dispute on “${job.title}”. Funds are frozen until it's resolved. Add your side.`, jobId);
  });
}

/** POST /jobs/:id/reviews */
export function leaveReview(jobId: string, by: "customer" | "worker", rating: number, text: string) {
  if (LIVE_BACKEND) return remoteAction("review", { jobId, by, rating, text });
  commit((d) => {
    const job = mustJob(d, jobId);
    jobActor(d, job, by);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ActionError("Choose a rating from 1 to 5.");
    guard(job, ["confirmed", "closed"], "leave a review");
    const review = { rating, text: text.trim(), at: now() };
    if (by === "customer") {
      if (job.customerReview) throw new ActionError("You've already reviewed this job.");
      job.customerReview = review;
    } else {
      if (job.workerReview) throw new ActionError("You've already rated this customer.");
      job.workerReview = review;
    }
    log(job, by, `Left a ${rating}-star review`);
  });
}

// ── Worker actions ─────────────────────────────────────────────────────────

/** POST /jobs/:id/accept */
export function acceptRequest(jobId: string, amount: number, date: string, note: string) {
  if (LIVE_BACKEND) return remoteAction("accept", { jobId, amount, date, note });
  commit((d) => {
    const job = mustJob(d, jobId);
    jobActor(d, job, "worker");
    if (findWorker(d, job.workerId)?.verification !== "verified") throw new ActionError("Your identity must be verified before accepting jobs.");
    requirePrice(amount);
    if (!Number.isFinite(Date.parse(date)) || Date.parse(date) < new Date().setHours(0, 0, 0, 0)) throw new ActionError("Choose today or a later start date.");
    guard(job, ["requested"], "accept");
    if (!(amount > 0)) throw new ActionError("Enter a price above zero.");
    job.quote = { amount: round2(amount), date, note: note.trim(), at: now(), commissionPct: d.settings.commissionPct };
    job.status = "quoted";
    log(job, "worker", `Accepted at ${money(amount)}`);
    const w = findWorker(d, job.workerId)!;
    notify(d, job.customerId, `${w.name.split(" ")[0]} accepted “${job.title}” at ${money(amount)}. Pay to confirm the booking.`, jobId);
  });
}

/** POST /jobs/:id/decline */
export function declineRequest(jobId: string, reason: string) {
  if (LIVE_BACKEND) return remoteAction("decline", { jobId, reason });
  commit((d) => {
    const job = mustJob(d, jobId);
    jobActor(d, job, "worker");
    guard(job, ["requested"], "decline");
    job.status = "declined";
    job.declineReason = reason.trim();
    log(job, "worker", "Declined the request");
    const w = findWorker(d, job.workerId)!;
    notify(d, job.customerId, `${w.name.split(" ")[0]} can't take “${job.title}”. Try another worker.`, jobId);
  });
}

/** POST /jobs/:id/complete */
export function markComplete(jobId: string, note: string, photos: Photo[]) {
  if (LIVE_BACKEND) return remoteAction("complete", { jobId, note, photos });
  commit((d) => {
    const job = mustJob(d, jobId);
    jobActor(d, job, "worker");
    guard(job, ["in_progress"], "mark complete");
    job.status = "completed";
    job.completedAt = now();
    job.completionNote = note.trim();
    job.completionPhotos = photos;
    job.confirmBy = new Date(Date.now() + d.settings.confirmWindowHours * 3600_000).toISOString();
    log(job, "worker", "Marked the job complete");
    notify(d, job.customerId, `“${job.title}” is marked complete. Check the work within ${d.settings.confirmWindowHours} hours.`, jobId);
  });
}

/** POST /jobs/:id/disputes/response */
export function respondToDispute(jobId: string, text: string, evidence: Photo[]) {
  if (LIVE_BACKEND) return remoteAction("dispute_response", { jobId, text, evidence });
  commit((d) => {
    const job = mustJob(d, jobId);
    jobActor(d, job, "worker");
    if (text.trim().length < 15) throw new ActionError("Explain your side in at least 15 characters.");
    guard(job, ["disputed"], "respond");
    job.dispute!.workerResponse = { text: text.trim(), evidence, at: now() };
    log(job, "worker", "Responded to the dispute");
  });
}

export type WorkerProfileInput = Pick<
  Worker,
  "name" | "phone" | "services" | "baseArea" | "areas" | "bio" | "pricing" | "availability" | "payout" | "yearsExperience"
> & { ghanaCardNumber: string; frontPhoto?: string; selfie?: string };

/** POST /workers (registration + verification submission) */
export async function registerWorker(input: WorkerProfileInput) {
  if (LIVE_BACKEND) return remoteAction<string>("register_worker", { ...input });
    const error = validateWorkerProfile(input);
    if (error) throw new ActionError(error);
    if (!/^GHA-\d{9}-\d$/.test(input.ghanaCardNumber)) throw new ActionError("Use the Ghana Card format GHA-123456789-0.");
    if (!input.frontPhoto || !input.selfie) throw new ActionError("Add both an ID photo and a portrait for review.");
    const result = await sessionAction("/test/register", { role: "worker", name: input.name, phone: input.phone, area: input.baseArea, services: input.services, code: "123456" });
    const id = result.session!.userId;
  commit((d) => {
    const { ghanaCardNumber, frontPhoto, selfie, ...rest } = input;
    d.workers = d.workers.filter((w) => w.id !== id);
    d.workers.push({
      ...rest,
      id,
      verification: "pending",
      ghanaCard: { number: ghanaCardNumber, submittedAt: now(), frontPhoto, selfie },
      portfolio: [],
      joinedAt: now(),
    });
    d.session = { role: "worker", userId: id };
  });
  return id;
}

/** PATCH /workers/:id */
export function updateWorker(workerId: string, patch: Partial<Pick<Worker, "services" | "areas" | "bio" | "pricing" | "availability" | "payout" | "baseArea">>) {
  if (LIVE_BACKEND) return remoteAction("update_worker", { workerId, ...patch });
  commit((d) => {
    requireActor(d, "worker", workerId);
    const w = findWorker(d, workerId);
    if (!w) throw new ActionError("Worker not found.");
    const error = validateWorkerProfile({ ...w, ...patch });
    if (error) throw new ActionError(error);
    Object.assign(w, patch);
  });
}

export function addPortfolioPhoto(workerId: string, p: Photo) {
  if (LIVE_BACKEND) return remoteAction("portfolio", { workerId, photo: p });
  commit((d) => {
    requireActor(d, "worker", workerId);
    findWorker(d, workerId)!.portfolio.unshift(p);
  });
}

// ── Admin actions ──────────────────────────────────────────────────────────

/** POST /admin/workers/:id/verification */
export function reviewVerification(workerId: string, approve: boolean, note: string) {
  if (LIVE_BACKEND) return remoteAction("verify_worker", { workerId, approve, note });
  commit((d) => {
    requireActor(d, "admin");
    if (!approve && note.trim().length < 10) throw new ActionError("Explain what the worker needs to correct.");
    const w = findWorker(d, workerId);
    if (!w) throw new ActionError("Worker not found.");
    if (w.verification !== "pending") throw new ActionError("This submission has already been reviewed.");
    if (approve && (!w.ghanaCard?.frontPhoto || !w.ghanaCard?.selfie)) throw new ActionError("Both an ID photo and a portrait are required before approval.");
    w.verification = approve ? "verified" : "rejected";
    w.verificationNote = note.trim() || undefined;
    notify(
      d,
      workerId,
      approve ? "You're verified. Your profile is now visible to customers." : `Verification wasn't approved: ${note.trim() || "see details"}. Update your documents and resubmit.`,
    );
  });
}

export function resubmitVerification(workerId: string, ghanaCardNumber: string, documents?: { frontPhoto?: string; selfie?: string }) {
  if (LIVE_BACKEND) return remoteAction("resubmit_verification", { workerId, ghanaCardNumber, ...documents });
  commit((d) => {
    requireActor(d, "worker", workerId);
    const w = findWorker(d, workerId)!;
    if (w.verification !== "rejected" && w.verification !== "not_submitted") throw new ActionError("Only rejected submissions can be resubmitted.");
    if (!/^GHA-\d{9}-\d$/.test(ghanaCardNumber)) throw new ActionError("Use the Ghana Card format GHA-123456789-0.");
    w.verification = "pending";
    w.verificationNote = undefined;
    w.ghanaCard = { ...(w.ghanaCard ?? {}), ...documents, number: ghanaCardNumber, submittedAt: now() };
  });
}

/**
 * Test builds only: an admin records each release by hand. Live payouts are sent
 * automatically; admins only retry failed ones (see retryPayout).
 */
export function releasePayout(jobId: string, transferRef: string) {
  if (LIVE_BACKEND) throw new Error("Live payouts are sent automatically through Paystack.");
  commit((d) => {
    requireActor(d, "admin");
    const job = mustJob(d, jobId);
    guard(job, ["confirmed"], "release");
    if (!job.payout || job.payout.status !== "queued") throw new ActionError("No payout is queued for this job.");
    if (!transferRef.trim() || d.jobs.some((j) => j.payout?.status === "sent" && j.payout.reference === transferRef)) throw new ActionError("A unique transfer reference is required.");
    job.payout!.status = "sent";
    job.payout!.sentAt = now();
    job.payout!.reference = transferRef;
    job.status = "closed";
    log(job, "admin", `Payout of ${money(job.payout!.net)} sent to ${job.payout!.destination}`);
    notify(d, job.workerId, `${money(job.payout!.net)} sent to ${job.payout!.destination} for “${job.title}”.`, jobId);
  });
}

/** Live: sends a failed payout back to Paystack under a new transfer reference. */
export async function retryPayout(jobId: string) {
  if (!LIVE_BACKEND) throw new Error("Test payouts are released by hand.");
  await retryLivePayout(jobId);
  await refreshSession();
}

/** POST /admin/disputes/:jobId/resolve. Live: refunds and payouts go through Paystack. */
export async function resolveDispute(jobId: string, toWorker: number, note: string, transferRef: string) {
  if (LIVE_BACKEND) {
    await resolveLiveDispute(jobId, round2(toWorker), note.trim());
    await refreshSession();
    return;
  }
  commit((d) => {
    requireActor(d, "admin");
    const job = mustJob(d, jobId);
    guard(job, ["disputed"], "resolve");
    const total = job.payment!.amount;
    if (!Number.isFinite(toWorker) || toWorker < 0 || toWorker > total) throw new ActionError("The worker allocation must be between zero and the held amount.");
    if (note.trim().length < 15) throw new ActionError("Explain the decision in at least 15 characters.");
    if (toWorker > 0 && (!transferRef.trim() || d.jobs.some((j) => j.payout?.status === "sent" && j.payout.reference === transferRef))) throw new ActionError("A unique transfer reference is required.");
    const w = round2(Math.min(Math.max(toWorker, 0), total));
    const c = round2(total - w);
    const outcome = c === 0 ? "release" : w === 0 ? "refund" : "split";
    job.dispute!.resolution = { outcome, toWorker: w, toCustomer: c, note: note.trim(), at: now() };
    if (w > 0) {
      queuePayout(d, job, w);
      job.payout!.status = "sent";
      job.payout!.sentAt = now();
      job.payout!.reference = transferRef;
    }
    if (c > 0) {
      job.refund = { reference: reference("RFD"), amount: c, destination: job.payment!.payer, at: now() };
    }
    job.status = "closed";
    const summary = outcome === "release" ? `full release of ${money(w)}` : outcome === "refund" ? `full refund of ${money(c)}` : `split ${money(w)} to worker, ${money(c)} refunded`;
    log(job, "admin", `Dispute resolved: ${summary}`);
    notify(d, job.customerId, `Your dispute on “${job.title}” is resolved: ${summary}.`, jobId);
    notify(d, job.workerId, `The dispute on “${job.title}” is resolved: ${summary}.`, jobId);
  });
}

/** PUT /admin/settings */
export function updateSettings(s: Settings) {
  if (LIVE_BACKEND) return remoteAction("settings", { ...s });
  commit((d) => {
    requireActor(d, "admin");
    if (!Number.isFinite(s.commissionPct) || s.commissionPct < 0 || s.commissionPct > 30) throw new ActionError("Set a commission between 0% and 30%.");
    if (!Number.isInteger(s.confirmWindowHours) || s.confirmWindowHours < 24 || s.confirmWindowHours > 168) throw new ActionError("Choose an inspection window from 24 to 168 whole hours.");
    d.jobs.forEach((job) => {
      if (job.quote && job.quote.commissionPct === undefined) job.quote.commissionPct = d.settings.commissionPct;
    });
    d.settings = { ...s };
  });
}

export function clearLiveState() {
  if (!LIVE_BACKEND) return;
  sessionGeneration++;
  db = emptyLiveDb();
  clearLiveImages();
  setSessionState({ ready: false, error: "" });
  listeners.forEach((fn) => fn());
  window.dispatchEvent(new Event("siesie:account-changed"));
}
async function remoteAction<T = void>(action: string, input: Record<string, unknown>): Promise<T> {
  const result = await liveAction<T>(action, input);
  if (liveRefresh) await liveRefresh.promise;
  await refreshSession();
  if (sessionState.error) window.dispatchEvent(new CustomEvent("siesie:error", { detail: "Your change was saved, but the latest details could not be loaded. Refresh to see them." }));
  return result;
}
