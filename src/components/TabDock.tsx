import { NavLink } from "react-router";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";

export interface DockTab {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Count shown on the tab. Falsy values render nothing. */
  badge?: number;
  /** Badge means something is wrong or overdue rather than merely waiting. */
  urgent?: boolean;
}

/**
 * Floating tab dock, shared by the worker and admin shells.
 *
 * Same rules as the customer dock: at most five destinations, labels always
 * visible, one highlight that slides between tabs rather than two that blink,
 * and enough bottom inset to clear the phone's home indicator.
 */
export function TabDock({ tabs, activeIndex, label, className }: { tabs: DockTab[]; activeIndex: number; label: string; className?: string }) {
  return (
    <div className={cn("bottom-safe pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3", className)}>
      <nav
        aria-label={label}
        className="glass-dock pointer-events-auto relative grid w-full max-w-md rounded-[var(--radius-sheet)] p-1.5"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {activeIndex >= 0 && (
          <span
            aria-hidden
            className="absolute inset-y-1.5 left-1.5 rounded-[18px] bg-cobalt-wash transition-transform duration-[var(--dur-move)] ease-[var(--ease-spring)]"
            style={{ width: `calc((100% - 0.75rem) / ${tabs.length})`, transform: `translateX(calc(${activeIndex} * 100%))` }}
          />
        )}

        {tabs.map((t, i) => {
          const active = i === activeIndex;
          return (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              aria-current={active ? "page" : undefined}
              className={cn("press relative z-10 flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-[18px]", active ? "text-cobalt" : "text-ink-soft hover:text-ink")}
            >
              <span className="relative">
                <t.icon className={cn("size-5 transition-transform duration-[var(--dur-move)] ease-[var(--ease-spring)]", active && "-translate-y-px scale-110")} aria-hidden />
                {!!t.badge && (
                  <span
                    className={cn(
                      "absolute -top-1.5 -right-2.5 grid h-4.5 min-w-4.5 place-items-center rounded-full px-1 text-[10px] font-extrabold ring-2 ring-white",
                      t.urgent ? "bg-kiln-deep text-white" : "bg-ink text-white",
                    )}
                  >
                    {t.badge > 9 ? "9+" : t.badge}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-bold tracking-tight">{t.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
