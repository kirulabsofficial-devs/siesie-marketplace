import { useEffect, useRef, useState, type DependencyList } from "react";

/**
 * Motion helpers.
 *
 * Everything here is plain DOM + CSS: no animation library. The stylesheet owns
 * the keyframes and timing tokens; these hooks only decide *when* a class flips.
 * That keeps the animation work on the compositor and the bundle unchanged.
 */

const REDUCED = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.(REDUCED).matches === true;
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    const mq = window.matchMedia(REDUCED);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/**
 * Scroll reveal.
 *
 * Attach the returned ref to a container. Every `[data-reveal]` inside it gets
 * `.is-revealed` once it crosses into view, which is what actually starts the
 * CSS animation. Items keep their `--i` stagger index from the markup.
 *
 * Reveals fire once and stay revealed — re-animating on every scroll direction
 * change reads as nervous rather than alive.
 *
 * Pass `deps` when the list of children changes (filtering, search results) so
 * newly mounted nodes get observed too.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(deps: DependencyList = []) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]")).filter(
      (el) => !el.classList.contains("is-revealed"),
    );
    if (!targets.length) return;

    // No observer support, or the user asked for less motion: show it all now.
    if (typeof IntersectionObserver === "undefined" || prefersReducedMotion()) {
      targets.forEach((el) => el.classList.add("is-revealed"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          io.unobserve(entry.target);
        }
      },
      // Start slightly before the element is fully on screen so the motion has
      // finished by the time the user has scrolled it into comfortable reading.
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 },
    );

    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

/** True once the window has scrolled past `offset`. Drives the compact header. */
export function useScrolled(offset = 8) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      setScrolled(window.scrollY > offset);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [offset]);

  return scrolled;
}

/**
 * Counts up to `value` when it first enters view. Used for the trust stats —
 * a number that lands feels earned, a number that is just printed does not.
 * Returns the current value and the ref to attach.
 */
export function useCountUp(value: number, durationMs = 900) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setShown(value);
      return;
    }

    let raf = 0;
    let start = 0;

    const tick = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / durationMs);
      // expo.out — fast off the line, settles softly, matches --ease-set.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setShown(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );

    io.observe(el);
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [value, durationMs]);

  return [shown, ref] as const;
}
