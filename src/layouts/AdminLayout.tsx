import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { BadgeCheck, Gauge, LogOut, Menu, ReceiptText, Scale, Send, Settings, X } from "lucide-react";
import { Brand } from "../components/Brand";
import { DemoBar } from "../components/DemoBar";
import { SiteFooter } from "../components/SiteFooter";
import { signOut, useDb } from "../data/store";
import { cn } from "../lib/cn";

export function AdminLayout() {
  const counts = useDb((d) => ({
    verify: d.workers.filter((w) => w.verification === "pending").length,
    payouts: d.jobs.filter((j) => j.status === "confirmed").length,
    disputes: d.jobs.filter((j) => j.status === "disputed").length,
  }));
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  const items = [
    { to: "/admin", label: "Overview", icon: Gauge, end: true },
    { to: "/admin/verifications", label: "Verifications", icon: BadgeCheck, count: counts.verify },
    { to: "/admin/payouts", label: "Payouts to release", icon: Send, count: counts.payouts },
    { to: "/admin/disputes", label: "Disputes", icon: Scale, count: counts.disputes, urgent: true },
    { to: "/admin/transactions", label: "Transactions", icon: ReceiptText },
    { to: "/admin/settings", label: "Commission and rules", icon: Settings },
  ];

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Admin">
      {items.map((it, i) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          style={{ ["--i" as string]: i }}
          className={({ isActive }) =>
            cn(
              "press group relative flex min-h-12 items-center gap-3 rounded-[var(--radius-tile)] px-3 text-sm font-bold",
              isActive ? "bg-white text-ink shadow-[var(--shadow-tile)]" : "text-ink-soft hover:bg-white/70 hover:text-ink",
            )
          }
        >
          {({ isActive }) => (
            <>
              {/* Active rail: one 3px mark, not a whole extra colour scheme. */}
              <span
                aria-hidden
                className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-cobalt-bright transition-transform duration-[var(--dur-move)] ease-[var(--ease-spring)]", isActive ? "scale-y-100" : "scale-y-0")}
              />
              <it.icon className={cn("size-5 shrink-0 transition-colors", isActive ? "text-cobalt-bright" : "text-ink-faint group-hover:text-ink-soft")} aria-hidden />
              <span className="flex-1">{it.label}</span>
              {!!it.count && (
                <span className={cn("grid h-5.5 min-w-5.5 place-items-center rounded-full px-1.5 text-xs font-extrabold text-white", it.urgent ? "bg-kiln-deep" : "bg-ink")}>{it.count}</span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:font-bold focus:shadow-[var(--shadow-lift)]"
      >
        Skip to content
      </a>
      <DemoBar />

      <div className="flex flex-1">
        <aside className="sticky top-0 hidden h-dvh w-68 shrink-0 flex-col border-r border-slate-200 bg-grout px-3 py-5 lg:flex">
          <div className="px-2 pb-6">
            <Brand to="/admin" suffix="Admin" />
          </div>
          {nav}
          <button
            onClick={signOut}
            className="press mt-auto inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-tile)] px-3 text-left text-sm font-bold text-ink-soft hover:bg-white/70 hover:text-ink"
          >
            <LogOut className="size-4" aria-hidden />
            Log out
          </button>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-grout/90 px-4 py-2 backdrop-blur-xl lg:hidden">
            <Brand to="/admin" suffix="Admin" />
            <button
              className="press grid size-11 place-items-center rounded-full text-ink-mid hover:bg-white/70"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={open ? "Close menu" : "Open menu"}
            >
              {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
          </header>

          {open && <div className="animate-drawer border-b border-slate-200 bg-grout p-3 lg:hidden">{nav}</div>}

          {/* flex column so the footer settles at the bottom on short pages. */}
          <div className="flex min-h-[calc(100dvh-4rem)] flex-col lg:min-h-dvh">
            <main key={pathname} id="main" className="animate-page mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-16 sm:px-8 sm:py-10">
              <Outlet />
            </main>

            <SiteFooter
              tagline="Every figure here comes from this prototype's saved records."
              columns={[
                {
                  title: "Queues",
                  links: [
                    { label: "Verifications", to: "/admin/verifications" },
                    { label: "Payouts to release", to: "/admin/payouts" },
                    { label: "Disputes", to: "/admin/disputes" },
                  ],
                },
                {
                  title: "Records",
                  links: [
                    { label: "Overview", to: "/admin" },
                    { label: "Transactions", to: "/admin/transactions" },
                  ],
                },
                {
                  title: "Settings",
                  links: [
                    { label: "Commission and rules", to: "/admin/settings" },
                    { label: "Public site", to: "/" },
                  ],
                },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
