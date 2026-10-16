import type { Worker } from "../data/types";
import { AREAS, BANKS, MOMO_NETWORKS, SERVICE_IDS } from "../config";
import { isValidGhanaMobile } from "../payments/paystack";

export type ProfileFields = Pick<Worker, "name" | "phone" | "services" | "baseArea" | "areas" | "bio" | "pricing" | "availability" | "payout" | "yearsExperience">;

export function validateWorkerProfile(p: ProfileFields): string | null {
  if (p.name.trim().length < 2) return "Add your full name.";
  if (!isValidGhanaMobile(p.phone)) return "Enter a valid Ghana mobile number.";
  if (!p.services.length || p.services.some((s) => !SERVICE_IDS.includes(s))) return "Choose at least one service.";
  if (!AREAS.includes(p.baseArea) || !p.areas.includes(p.baseArea) || p.areas.some((a) => !AREAS.includes(a))) return "Choose your base area and include it in your service areas.";
  if (p.bio.trim().length < 20) return "Describe your work in at least 20 characters.";
  if (!Number.isInteger(p.yearsExperience) || p.yearsExperience < 0 || p.yearsExperience > 60) return "Enter experience between 0 and 60 years.";
  if (![p.pricing.from, p.pricing.to].every((v) => Number.isFinite(v) && v >= 0.01 && v <= 1_000_000) || p.pricing.to < p.pricing.from) return "Set a valid price range with the upper price at least the starting price.";
  if (!p.pricing.unit.trim()) return "Add a pricing unit, such as per job or per m².";
  if (!p.availability.days.length || p.availability.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return "Choose at least one working day.";
  if (p.payout.name.trim().length < 2) return "Add the payout account holder's name.";
  if (p.payout.type === "momo") {
    if (!Object.hasOwn(MOMO_NETWORKS, p.payout.network) || !isValidGhanaMobile(p.payout.number)) return "Choose a mobile money network and valid payout number.";
  } else if (!BANKS.includes(p.payout.bank) || !/^\d{6,20}$/.test(p.payout.number)) return "Choose a bank and enter a 6–20 digit account number.";
  return null;
}
