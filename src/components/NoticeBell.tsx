import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Bell } from "lucide-react";
import { markNoticesRead, useDb } from "../data/store";
import { ago } from "../lib/format";
import { cn } from "../lib/cn";

export function NoticeBell({ userId, jobBase, onCobalt }: { userId: string; jobBase: string; onCobalt?: boolean }) {
  const notices = useDb((d) => d.notices.filter((n) => n.to === userId).slice(0, 8));
  const unread = notices.filter((n) => !n.read).length;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open && unread) void Promise.resolve(markNoticesRead(userId)).catch((error) => window.dispatchEvent(new CustomEvent("siesie:error", { detail: error.message })));
        }}
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className={cn("relative grid size-11 place-items-center rounded-[var(--radius-tile)]", onCobalt ? "text-tile hover:bg-tile/10" : "text-ink hover:bg-ink/5")}
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && <span className="figure absolute right-1.5 top-1.5 grid min-w-5 place-items-center rounded-full bg-kiln px-1 text-[0.6875rem] font-bold leading-5 text-tile">{unread}</span>}
      </button>
      {open && (
        <div className="animate-rise absolute right-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-[var(--radius-tile)] bg-tile text-ink shadow-2xl ring-1 ring-grout-deep">
          <p className="border-b border-grout px-4 py-2.5 font-bold">Notifications</p>
          {notices.length === 0 ? (
            <p className="px-4 py-6 text-ink-soft">Nothing yet. Updates about your jobs show up here.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-grout overflow-auto">
              {notices.map((n) => (
                <li key={n.id}>
                  <Link to={n.jobId ? `${jobBase}/${n.jobId}` : jobBase} onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-tile-dim">
                    <p className="text-[0.9375rem] leading-snug">{n.text}</p>
                    <p className="mt-1 text-xs text-ink-soft">{ago(n.at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
