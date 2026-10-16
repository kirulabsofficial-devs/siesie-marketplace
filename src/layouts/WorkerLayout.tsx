import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { Briefcase, Inbox, LogOut, MessageCircle, UserRound, Wallet } from "lucide-react";
import { Brand } from "../components/Brand";
import { DemoBar } from "../components/DemoBar";
import { NoticeBell } from "../components/NoticeBell";
import { TabDock, type DockTab } from "../components/TabDock";
import { SiteFooter } from "../components/SiteFooter";
import { Avatar } from "../components/ui";
import { findWorker, signOut, useDb } from "../data/store";
import { useUnreadChats } from "../data/chat";
import { cn } from "../lib/cn";
import { firstName } from "../lib/format";
import { useScrolled } from "../lib/motion";

export function WorkerLayout() {
  const session = useDb((d) => d.session)!;
  const worker = useDb((d) => findWorker(d, session.userId));
  const requests = useDb((d) => d.jobs.filter((j) => j.workerId === session.userId && j.status === "requested").length);
  const disputes = useDb((d) => d.jobs.filter((j) => j.workerId === session.userId && j.status === "disputed").length);
  const { pathname } = useLocation();
  const scrolled = useScrolled(8);
  const unreadChats = useUnreadChats();
  const isMessages = pathname.startsWith("/work/messages");
  const inConversation = pathname.startsWith("/work/messages/");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const tabs: DockTab[] = [
    { to: "/work", label: "Requests", icon: Inbox, end: true, badge: requests },
    { to: "/work/jobs", label: "Jobs", icon: Briefcase, badge: disputes, urgent: true },
    { to: "/work/messages", label: "Messages", icon: MessageCircle, badge: unreadChats },
    { to: "/work/earnings", label: "Earnings", icon: Wallet },
    { to: "/work/profile", label: "Profile", icon: UserRound },
  ];

  const activeIndex = tabs.findIndex((tab) => tab.end ? pathname === tab.to : pathname.startsWith(tab.to));

  return (
    <div className={cn("flex min-h-dvh flex-col bg-canvas text-ink", isMessages && "messages-shell")}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:font-bold focus:shadow-[var(--shadow-lift)]"
      >
        Skip to content
      </a>
      <DemoBar />

      <header
        className={cn(
          "worker-header sticky top-0 z-30 border-b bg-white/85 backdrop-blur-xl transition-[box-shadow,border-color] duration-[var(--dur-move)]",
          scrolled ? "border-slate-200/70 shadow-[var(--shadow-flush)]" : "border-transparent",
        )}
      >
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6">
          <Brand to="/work" suffix="Pro" />

          {/* Desktop keeps a real nav bar; phones use the dock at the bottom. */}
          <nav className="hidden gap-1 lg:flex" aria-label="Worker">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) => cn("press inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-bold", isActive ? "bg-cobalt-wash text-cobalt" : "text-ink-soft hover:bg-grout hover:text-ink")}
              >
                {t.label}
                {!!t.badge && (
                  <span className={cn("grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-extrabold text-white", t.urgent ? "bg-kiln-deep" : "bg-ink")}>{t.badge}</span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
            <NoticeBell userId={session.userId} jobBase="/work/jobs" />
            {worker && <Avatar name={worker.name} id={worker.id} size="sm" />}
            <button
              onClick={signOut}
              className="press inline-flex min-h-10 items-center gap-1.5 rounded-full border border-grout-deep bg-white px-3 text-xs font-bold text-ink-mid hover:bg-tile-dim"
            >
              <LogOut className="size-3.5" aria-hidden />
              Log out{worker ? ` ${firstName(worker.name)}` : ""}
            </button>
          </div>
        </div>
      </header>

      <main key={isMessages ? "messages" : pathname} id="main" className={isMessages ? "messages-main" : "animate-page mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-10"}>
        <Outlet />
      </main>

      {!isMessages && <SiteFooter
        className="dock-clearance lg:pb-0"
        tagline="Know the money is secured before you buy materials."
        columns={[
          {
            title: "Your work",
            links: [
              { label: "Requests", to: "/work" },
              { label: "Jobs", to: "/work/jobs" },
              { label: "Messages", to: "/work/messages" },
              { label: "Earnings", to: "/work/earnings" },
            ],
          },
          {
            title: "Your account",
            links: [
              { label: "Profile and areas", to: "/work/profile" },
              { label: "Verification", to: "/work/profile" },
            ],
          },
          {
            title: "How it works",
            links: [
              { label: "Escrow protection", to: "/#how-payment-works" },
              { label: "Browse the marketplace", to: "/search" },
            ],
          },
        ]}
      />}

      <TabDock tabs={tabs} activeIndex={activeIndex} label="Worker" className={cn("lg:hidden", inConversation && "hidden md:flex")} />
    </div>
  );
}
