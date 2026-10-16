import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "../lib/cn";

type Tone = "success" | "error";
interface ToastItem {
  id: number;
  text: string;
  tone: Tone;
}

const Ctx = createContext<(text: string, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone: Tone = "success") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, text, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), tone === "error" ? 7000 : 4500);
  }, []);
  useEffect(() => {
    const show = (event: Event) => push((event as CustomEvent<string>).detail, "error");
    window.addEventListener("siesie:error", show);
    return () => window.removeEventListener("siesie:error", show);
  }, [push]);
  return (
    <Ctx.Provider value={push}>
      {children}
      {/* Clears the floating tab dock so a toast never lands under it. */}
      <div
        className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-3"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 6rem)" }}
        aria-live="polite"
        role="status"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "animate-rise pointer-events-auto flex max-w-md items-start gap-2.5 rounded-[var(--radius-tile)] px-4 py-3 font-bold shadow-xl",
              t.tone === "success" ? "bg-ink text-tile" : "bg-kiln text-tile",
            )}
          >
            {t.tone === "success" ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-celadon-wash" aria-hidden /> : <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

/** Runs a store action and turns an ActionError into an error toast. Returns true on success. */
export function useAction() {
  const toast = useToast();
  const pending = useRef(false);
  return useCallback(
    async (fn: () => unknown, success?: string) => {
      if (pending.current) return false;
      pending.current = true;
      try {
        await fn();
        if (success) toast(success);
        return true;
      } catch (e) {
        toast(e instanceof Error ? e.message : "That didn't work. Try again.", "error");
        return false;
      } finally { pending.current = false; }
    },
    [toast],
  );
}
