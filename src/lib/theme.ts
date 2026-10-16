import { useSyncExternalStore } from "react";
import { LIVE_BACKEND } from "../data/runtime";

/*
 * Prototype colour themes, for comparing palettes with testers.
 *
 * The default theme is Sage, set on <html data-theme="sage"> in index.html so
 * every build, the live one included, opens in it. The original Siesie navy is
 * the bare stylesheet and needs no attribute; every other theme sets
 * <html data-theme="…"> and is defined in styles/themes.css.
 * The live build never reads or changes the theme.
 */

export type ThemeId = "siesie" | "olive" | "cyprus" | "sage" | "forest";

export const THEMES: { id: ThemeId; name: string; note: string; swatches: string[]; chrome: string }[] = [
  { id: "sage", name: "Sage & Beige", note: "Current theme", swatches: ["#3a523b", "#4d694e", "#fff3d5"], chrome: "#3a523b" },
  { id: "siesie", name: "Siesie Navy", note: "Original navy", swatches: ["#142e43", "#244d68", "#f1f5f9"], chrome: "#142e43" },
  { id: "olive", name: "Olive & Cream", note: "Dark olive green with cream", swatches: ["#3e4f21", "#556b2f", "#fffdd0"], chrome: "#3e4f21" },
  { id: "cyprus", name: "Cyprus & Sand", note: "Deep teal with sand dune", swatches: ["#00332f", "#004643", "#f0ede5"], chrome: "#00332f" },
  { id: "forest", name: "Forest & Tan", note: "Forest and sage with warm tan", swatches: ["#0c3b2e", "#6d9773", "#bb8a52"], chrome: "#0c3b2e" },
];

const DEFAULT_THEME: ThemeId = "sage";
const BARE_THEME: ThemeId = "siesie";
const KEY = "siesie.theme";
const isTheme = (value: unknown): value is ThemeId => THEMES.some((t) => t.id === value);

let current: ThemeId = DEFAULT_THEME;
const listeners = new Set<() => void>();

export function applyTheme(id: ThemeId) {
  if (LIVE_BACKEND) return;
  current = id;
  const root = document.documentElement;
  if (id === BARE_THEME) delete root.dataset.theme;
  else root.dataset.theme = id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEMES.find((t) => t.id === id)!.chrome);
  try { localStorage.setItem(KEY, id); } catch { /* storage may be disabled */ }
  listeners.forEach((l) => l());
}

/** Runs before the first render so the page never flashes the default theme. A `?theme=` link wins over the saved choice. */
export function initTheme() {
  if (LIVE_BACKEND) return;
  let id: string | null = new URLSearchParams(location.search).get("theme");
  if (!isTheme(id)) {
    try { id = localStorage.getItem(KEY); } catch { id = null; }
  }
  if (isTheme(id)) applyTheme(id);
}

/** A link that opens the prototype on the current page in the given theme. */
export function themeLink(id: ThemeId) {
  const url = new URL(location.href);
  url.searchParams.set("theme", id);
  return url.toString();
}

export function useTheme(): ThemeId {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => current,
  );
}
