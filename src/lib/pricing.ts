import type { Worker } from "../data/types";
import { money } from "./format";

export function priceText(w: Pick<Worker, "pricing">) {
  const { from, to, unit } = w.pricing;
  return from === to ? `${money(from, { whole: true })} ${unit}` : `${money(from, { whole: true })}–${to.toLocaleString("en-GH")} ${unit}`;
}

/** Lower bound only. For tight card footers where the full range wraps to two lines. */
export function priceFrom(w: Pick<Worker, "pricing">) {
  return money(w.pricing.from, { whole: true });
}
