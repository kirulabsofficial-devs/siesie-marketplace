const cedi = new Intl.NumberFormat("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cediWhole = new Intl.NumberFormat("en-GH", { maximumFractionDigits: 0 });

/** GH₵ 1,800.00 — use `whole` for price ranges and headline figures. */
export function money(amount: number, opts: { whole?: boolean } = {}) {
  return `GH₵ ${(opts.whole ? cediWhole : cedi).format(amount)}`;
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function commissionOn(amount: number, pct: number) {
  const commission = round2((amount * pct) / 100);
  return { commission, net: round2(amount - commission) };
}

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const dayYearFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const weekdayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

export function date(iso: string, withYear = false) {
  return (withYear ? dayYearFmt : dayFmt).format(new Date(iso));
}

export function dateTime(iso: string) {
  const d = new Date(iso);
  return `${dayFmt.format(d)}, ${timeFmt.format(d)}`;
}

export function weekday(iso: string) {
  return weekdayFmt.format(new Date(iso));
}

export function ago(iso: string, now = Date.now()) {
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return date(iso, true);
}

/** "31 h 12 min left" or null when the moment has passed. */
export function timeLeft(iso: string, now = Date.now()) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return null;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min left`;
  return `${h} h ${m.toString().padStart(2, "0")} min left`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function firstName(name: string) {
  return name.split(/\s+/)[0] ?? name;
}

/** 0244123456 -> 024 412 3456 */
export function phone(p: string) {
  const d = p.replace(/\D/g, "").replace(/^233/, "0");
  if (d.length !== 10) return p;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

export function maskPhone(p: string) {
  const d = p.replace(/\D/g, "").replace(/^233/, "0");
  if (d.length !== 10) return p;
  return `${d.slice(0, 3)} ••• ${d.slice(7)}`;
}

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function reference(prefix: string) {
  const n = Math.floor(Math.random() * 36 ** 6)
    .toString(36)
    .toUpperCase()
    .padStart(6, "0");
  return `${prefix}-${n}`;
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
