import type { DisputeReason, MomoNetwork, ServiceId } from "./data/types";

/**
 * Working name. "Siesie" is Twi for to fix, to tidy, to put in order, which covers all
 * three service lines. Change it here and in index.html.
 */
export const BRAND = {
  name: "Siesie",
  supportPhone: "030 000 0000",
  supportEmail: "help@siesie.example",
};

export const SERVICES: Record<ServiceId, { label: string; worker: string; blurb: string; examples: string[] }> = {
  tiling: {
    label: "Tiling",
    worker: "Tiler",
    blurb: "Floors, walls, bathrooms, kitchen backsplashes, and re-grouting.",
    examples: ["Bathroom floor and walls", "Kitchen backsplash", "Porch and veranda", "Replace cracked tiles"],
  },
  cleaning: {
    label: "Cleaning",
    worker: "Cleaner",
    blurb: "Move-in and move-out cleans, deep cleans, and post-construction dust.",
    examples: ["Post-construction clean", "Move-out deep clean", "Weekly home clean", "Sofa and carpet wash"],
  },
  maintenance: {
    label: "Home maintenance",
    worker: "Handyman",
    blurb: "Leaks, sockets, door locks, ceiling boards, and small repairs.",
    examples: ["Fix leaking pipe", "Replace sockets and switches", "Hang doors and fix locks", "Ceiling board repair"],
  },
};

export const SERVICE_IDS = Object.keys(SERVICES) as ServiceId[];

export const AREAS = [
  "Adenta",
  "Airport Residential",
  "Dansoman",
  "East Legon",
  "Haatso",
  "Kasoa",
  "Kumasi – Ahodwo",
  "Kumasi – Asokwa",
  "Madina",
  "Osu",
  "Spintex",
  "Tema Comm. 25",
  "Tema Comm. 18",
  "Weija",
];

export const MOMO_NETWORKS: Record<MomoNetwork, { label: string; prefixes: string[] }> = {
  mtn: { label: "MTN Mobile Money", prefixes: ["024", "054", "055", "059", "025", "053"] },
  telecel: { label: "Telecel Cash", prefixes: ["020", "050"] },
  airteltigo: { label: "AirtelTigo Money", prefixes: ["026", "027", "056", "057"] },
};

export const BANKS = ["GCB Bank", "Ecobank Ghana", "Fidelity Bank", "Stanbic Bank", "Absa Bank Ghana", "CalBank"];

export const DISPUTE_REASONS: Record<DisputeReason, string> = {
  unfinished: "The job isn't finished",
  poor_quality: "The work is poor quality",
  damage: "Something was damaged",
  no_show: "The worker didn't show up",
  other: "Something else",
};

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Test-mode OTP. The real flow sends an SMS from the backend. */
export const DEMO_OTP = "123456";
