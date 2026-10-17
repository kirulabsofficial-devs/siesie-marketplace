export type ServiceId = "tiling" | "cleaning" | "maintenance";

export type Role = "customer" | "worker" | "admin";

export type VerificationStatus = "not_submitted" | "pending" | "verified" | "rejected";

export type MomoNetwork = "mtn" | "telecel" | "airteltigo";

export type PayoutAccount =
  | { type: "momo"; network: MomoNetwork; number: string; name: string }
  | { type: "bank"; bank: string; number: string; name: string };

/** Placeholder for an uploaded photo. `src` is a data URL when the user uploaded one. */
export interface Photo {
  id: string;
  caption: string;
  pattern?: TilePattern;
  src?: string;
}

export type TilePattern = "herringbone" | "checker" | "subway" | "hex" | "terrazzo" | "grid" | "pipes";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  area: string;
  joinedAt: string;
}

export interface Worker {
  id: string;
  name: string;
  phone: string;
  services: ServiceId[];
  baseArea: string;
  areas: string[];
  bio: string;
  pricing: { mode: "fixed" | "quote"; from: number; to: number; unit: string };
  availability: { days: number[]; note: string };
  verification: VerificationStatus;
  verificationNote?: string;
  ghanaCard?: { number: string; submittedAt: string; frontPhoto?: string; selfie?: string };
  payout: PayoutAccount;
  portfolio: Photo[];
  joinedAt: string;
  yearsExperience: number;
  rating?: number | null;
  reviewCount?: number;
  jobsDone?: number;
}

export interface Admin {
  id: string;
  name: string;
  phone: string;
}

export type JobStatus =
  | "requested" // customer asked, worker has not answered
  | "quoted" // worker accepted with a price and date; customer pays to confirm
  | "declined" // worker declined the request
  | "cancelled" // customer withdrew before paying
  | "in_progress" // paid, funds held
  | "completed" // worker marked it done; customer inspection window is open
  | "confirmed" // customer confirmed (or window lapsed); payout queued for admin release
  | "disputed" // customer raised a dispute; funds frozen
  | "closed"; // money has left the platform: released, refunded, or split

export type EscrowState = "unpaid" | "held" | "disputed" | "released" | "refunded" | "split";

export interface JobEvent {
  at: string;
  by: Role | "system";
  text: string;
}

export interface Payment {
  reference: string;
  amount: number;
  channel: "momo" | "card";
  network?: MomoNetwork;
  payer: string; // masked phone or card
  paidAt: string;
}

export interface Payout {
  reference: string;
  gross: number;
  commission: number;
  net: number;
  destination: string;
  /** Live payouts pass through "sending" while Paystack works on the transfer, or "failed" until an admin retries. */
  status: "queued" | "sending" | "sent" | "failed";
  queuedAt: string;
  sentAt?: string;
  failure?: string;
}

export interface Refund {
  reference: string;
  amount: number;
  destination: string;
  at: string;
  /** Paystack's refund progress. Test-mode refunds have none. */
  status?: "pending" | "processing" | "processed" | "failed" | "check";
}

export interface Dispute {
  reason: DisputeReason;
  details: string;
  evidence: Photo[];
  openedAt: string;
  workerResponse?: { text: string; evidence: Photo[]; at: string };
  resolution?: {
    outcome: "release" | "refund" | "split";
    toWorker: number;
    toCustomer: number;
    note: string;
    at: string;
  };
}

export type DisputeReason = "unfinished" | "poor_quality" | "damage" | "no_show" | "other";

export interface Review {
  rating: number;
  text: string;
  at: string;
}

export interface Job {
  id: string;
  customerId: string;
  workerId: string;
  service: ServiceId;
  title: string;
  scope: string;
  address: string;
  area: string;
  preferredDate: string;
  photos: Photo[];
  status: JobStatus;
  quote?: { amount: number; date: string; note: string; at: string; commissionPct?: number };
  declineReason?: string;
  payment?: Payment;
  completedAt?: string;
  completionNote?: string;
  completionPhotos?: Photo[];
  confirmBy?: string;
  confirmedAt?: string;
  autoConfirmed?: boolean;
  dispute?: Dispute;
  payout?: Payout;
  refund?: Refund;
  customerReview?: Review; // customer rating the worker
  workerReview?: Review; // worker rating the customer
  createdAt: string;
  events: JobEvent[];
}

export interface Settings {
  commissionPct: number;
  confirmWindowHours: number;
}

export interface Session {
  role: Role;
  userId: string;
}

export interface Notice {
  id: string;
  to: string; // user id
  text: string;
  jobId?: string;
  at: string;
  read: boolean;
}

export interface Db {
  version: number;
  customers: Customer[];
  workers: Worker[];
  admins: Admin[];
  jobs: Job[];
  notices: Notice[];
  settings: Settings;
  session: Session | null;
}
