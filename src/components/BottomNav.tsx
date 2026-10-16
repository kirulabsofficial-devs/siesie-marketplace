import { NavLink, useLocation } from "react-router";
import { CalendarCheck, Home, MessageCircle, Search, User } from "lucide-react";
import { useDb } from "../data/store";
import { useUnreadChats } from "../data/chat";
import { cn } from "../lib/cn";

/**
 * Floating tab dock.
 *
 * Five destinations is the ceiling for a bottom bar — past that, targets get
 * too narrow to hit reliably. Labels stay visible at every state: a row of bare
 * icons forces people to decode glyphs, and it leaves screen-reader users with
 * nothing but the aria-label to go on.
 *
 * The centre booking tab is raised as the one thing a customer returns to most.
 */
export function BottomNav() {
  const session = useDb((d) => d.session);
  const unreadChats = useUnreadChats();
  const activeJobs = useDb((d) => {
    if (!session) return 0;
    if (session.role === "customer") {
      return d.jobs.filter((j) => j.customerId === session.userId && !["closed", "cancelled"].includes(j.status)).length;
    }
    if (session.role === "worker") {
      return d.jobs.filter((j) => j.workerId === session.userId && !["closed", "declined"].includes(j.status)).length;
    }
    return 0;
  });

  const { pathname } = useLocation();

  // Keep feature discovery available to guests. Hide the dock only on screens
  // that need the bottom edge for a primary action or the sign-up/login flow.
  const hideDock =
    pathname.startsWith("/workers/") || pathname.startsWith("/book/") || pathname.startsWith("/login") || pathname.startsWith("/join");
  if (hideDock) return null;

  const jobsHref = session?.role === "worker" ? "/work/jobs" : session?.role === "customer" ? "/jobs" : "/login?as=customer&next=/jobs";
  const inboxHref = session?.role === "worker" ? "/work/messages" : session?.role === "customer" ? "/messages" : "/login?as=customer&next=/messages";
  const profileHref = session?.role === "worker" ? "/work/profile" : session?.role === "admin" ? "/admin" : session ? "/jobs" : "/login";

  const isHome = pathname === "/";
  const isSearch = pathname.startsWith("/search") || pathname.startsWith("/workers");
  const isJobs = pathname.startsWith("/jobs") || pathname.startsWith("/work/jobs") || pathname.startsWith("/book");
  const isInbox = pathname.startsWith("/messages") || pathname.startsWith("/work/messages");
  const isProfile = pathname.startsWith("/login") || pathname.startsWith("/join") || pathname.startsWith("/admin");

  const tabs = [
    { key: "home", to: "/", label: "Home", Icon: Home, active: isHome },
    { key: "search", to: "/search", label: "Explore", Icon: Search, active: isSearch },
    { key: "jobs", to: jobsHref, label: "Bookings", Icon: CalendarCheck, active: isJobs, fab: true, badge: activeJobs },
    { key: "inbox", to: inboxHref, label: "Messages", Icon: MessageCircle, active: isInbox, dot: unreadChats > 0 },
    { key: "profile", to: profileHref, label: "Account", Icon: User, active: isProfile },
  ];

  const activeIndex = tabs.findIndex((t) => t.active);

  return (
    <div className={cn("bottom-safe pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3", pathname.startsWith("/messages/") && "hidden md:flex")}>
      <nav aria-label="Primary" className="glass-dock pointer-events-auto relative grid w-full max-w-md grid-cols-5 rounded-[var(--radius-sheet)] px-1.5 pt-1.5 pb-1.5">
        {/* Sliding highlight. One element moving reads as the same object relocating. */}
        {activeIndex >= 0 && (
          <span
            aria-hidden
            className="absolute inset-y-1.5 left-1.5 w-[calc((100%-0.75rem)/5)] rounded-[18px] bg-cobalt-wash transition-transform duration-[var(--dur-move)] ease-[var(--ease-spring)]"
            style={{ transform: `translateX(calc(${activeIndex} * 100%))` }}
          />
        )}

        {tabs.map(({ key, to, label, Icon, active, fab, badge, dot }) =>
          fab ? (
            <NavLink
              key={key}
              to={to}
              aria-current={active ? "page" : undefined}
              className="press relative z-10 flex flex-col items-center justify-end gap-1 pb-1"
            >
              <span
                className={cn(
                  "relative grid size-13 -translate-y-4 place-items-center rounded-full shadow-[var(--shadow-cobalt)] transition-colors duration-[var(--dur-quick)]",
                  active ? "bg-cobalt-bright text-white ring-4 ring-white" : "bg-ink text-white ring-4 ring-white hover:bg-cobalt-bright",
                )}
              >
                <Icon className="size-5.5" aria-hidden />
                {/* Neutral ink, not ochre: amber is reserved for held escrow
                    funds, and a count of open jobs is not that. */}
                {badge ? (
                  <span className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[10px] font-extrabold text-white ring-2 ring-white">
                    {badge > 9 ? "9+" : badge}
                    <span className="sr-only"> jobs in progress</span>
                  </span>
                ) : null}
              </span>
              <span className={cn("-mt-3 text-[10px] font-bold tracking-tight", active ? "text-cobalt" : "text-ink-soft")}>{label}</span>
            </NavLink>
          ) : (
            <NavLink
              key={key}
              to={to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press relative z-10 flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-[18px]",
                active ? "text-cobalt" : "text-ink-soft hover:text-ink",
              )}
            >
              <span className="relative">
                <Icon className={cn("size-5 transition-transform duration-[var(--dur-move)] ease-[var(--ease-spring)]", active && "-translate-y-px scale-110")} aria-hidden />
                {dot && (
                  <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-kiln ring-2 ring-white">
                    <span className="sr-only">unread</span>
                  </span>
                )}
              </span>
              <span className="text-[10px] font-bold tracking-tight">{label}</span>
            </NavLink>
          ),
        )}
      </nav>
    </div>
  );
}
