import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { ChevronDown, LogOut, MapPin, Menu, MessageCircle, X } from "lucide-react";
import { Brand } from "../components/Brand";
import { DemoBar } from "../components/DemoBar";
import { NoticeBell } from "../components/NoticeBell";
import { BottomNav } from "../components/BottomNav";
import { SiteFooter } from "../components/SiteFooter";
import { Avatar, Dialog } from "../components/ui";
import { currentUserName, signOut, useDb } from "../data/store";
import { useUnreadChats } from "../data/chat";
import { AREAS, SERVICES, SERVICE_IDS } from "../config";
import { cn } from "../lib/cn";
import { firstName } from "../lib/format";
import { useScrolled } from "../lib/motion";

export function PublicLayout() {
  const session = useDb((d) => d.session);
  const name = useDb(currentUserName);
  const { pathname, hash, search } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [areaModal, setAreaModal] = useState(false);
  const [currentArea, setCurrentArea] = useState(() => {
    try {
      const saved = localStorage.getItem("selected_area");
      return saved && AREAS.includes(saved) ? saved : "East Legon";
    } catch {
      return "East Legon";
    }
  });

  const scrolled = useScrolled(24);
  const overlay = false;

  useEffect(() => {
    setMenu(false);
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);

  const selectArea = (a: string) => {
    setCurrentArea(a);
    try {
      localStorage.setItem("selected_area", a);
    } catch {}
    setAreaModal(false);
    if (pathname.startsWith("/search")) {
      const next = new URLSearchParams(search);
      next.set("area", a);
      navigate(`/search?${next}`);
    }
  };

  const links = [
    { to: "/search", label: "Find a pro" },
    { to: "/#how-it-works", label: "How it works" },
    { to: "/join", label: "For professionals" },
  ];

  const signedInCustomer = session?.role === "customer";
  const unreadChats = useUnreadChats();
  const isMessages = pathname.startsWith("/messages");
  const home = session?.role === "worker" ? "/work" : session?.role === "admin" ? "/admin" : null;

  return (
    <div className={cn("public-shell flex min-h-dvh flex-col bg-canvas text-ink", isMessages && "messages-shell")}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:font-bold focus:shadow-[var(--shadow-lift)]"
      >
        Skip to content
      </a>


      <header
        className={cn(
          "public-header sticky top-0 z-30 transition-[background-color,box-shadow,border-color] duration-[var(--dur-move)] ease-[var(--ease-swift)]",
          overlay ? "on-cobalt border-b border-transparent bg-cobalt text-white" : "border-b border-slate-200/70 bg-white/85 text-ink backdrop-blur-xl",
          scrolled && "shadow-[var(--shadow-flush)]",
        )}
      >
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-6">
            <Brand onCobalt={overlay} />

            {/* Location chip — the single most consulted piece of context in a
                local marketplace, so it stays in the chrome rather than a menu. */}
            <button
              type="button"
              onClick={() => setAreaModal(true)}
              className={cn(
                "press hidden min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold sm:inline-flex",
                overlay ? "bg-white/15 text-white hover:bg-white/25" : "bg-grout text-ink-mid hover:bg-grout-deep/60",
              )}
            >
              <MapPin className={cn("size-3.5 shrink-0", overlay ? "text-white" : "text-cobalt-bright")} aria-hidden />
              <span className="max-w-[120px] truncate sm:max-w-[180px]">{currentArea}</span>
              <ChevronDown className="size-3 shrink-0 opacity-60" aria-hidden />
              <span className="sr-only">Change your location</span>
            </button>
          </div>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn(
                    "press rounded-xl px-3.5 py-2 text-sm font-bold",
                    isActive && !l.to.includes("#")
                      ? overlay
                        ? "bg-white/20 text-white"
                        : "bg-cobalt-wash text-cobalt"
                      : overlay
                        ? "text-white/85 hover:bg-white/15 hover:text-white"
                        : "text-ink-soft hover:bg-grout hover:text-ink",
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {signedInCustomer ? (
              <>
                <Link to="/messages" className="press relative hidden size-11 items-center justify-center rounded-full hover:bg-grout lg:inline-flex" aria-label={`Messages${unreadChats ? `, ${unreadChats} unread` : ""}`}>
                  <MessageCircle size={20} aria-hidden />
                  {unreadChats > 0 && <span className="absolute right-0 top-0 grid min-w-4.5 h-4.5 place-items-center rounded-full bg-cobalt px-1 text-[10px] font-bold text-white">{unreadChats > 9 ? "9+" : unreadChats}</span>}
                </Link>
                <NoticeBell userId={session!.userId} jobBase="/jobs" />
                <Link to="/jobs" className={cn("press flex items-center gap-2 rounded-full p-1 pr-1 lg:pr-3", overlay ? "hover:bg-white/15" : "hover:bg-grout")}>
                  <Avatar name={name || "Member"} id={session!.userId} size="sm" />
                  <span className="hidden text-xs font-bold lg:inline">Hi, {name ? firstName(name) : "there"}</span>
                  <span className="sr-only">Your bookings</span>
                </Link>
                <button
                  onClick={signOut}
                  className={cn(
                    "press min-h-9 rounded-full px-3 text-xs font-bold",
                    overlay ? "bg-white/15 text-white hover:bg-white/25" : "border border-grout-deep bg-white text-ink-mid hover:bg-tile-dim",
                  )}
                >
                  Log out
                </button>
              </>
            ) : home ? (
              <Link to={home} className={cn("press min-h-10 rounded-full px-4 py-2.5 text-xs font-extrabold", overlay ? "bg-white text-cobalt" : "bg-cobalt-bright text-white shadow-[var(--shadow-cobalt)]")}>
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className={cn(
                    "press inline-flex min-h-10 items-center rounded-full px-4 text-xs font-extrabold",
                    overlay ? "bg-white/15 text-white hover:bg-white/25" : "border border-grout-deep bg-white text-ink-mid hover:bg-tile-dim",
                  )}
                >
                  Log in
                </Link>
                <Link
                  to="/join"
                  className={cn(
                    "press hidden min-h-10 items-center rounded-full px-4 text-xs font-extrabold sm:inline-flex",
                    overlay ? "bg-white text-cobalt" : "bg-cobalt-bright text-white shadow-[var(--shadow-cobalt)]",
                  )}
                >
                  Become a pro
                </Link>
              </>
            )}

            <button
              className={cn("press grid size-11 place-items-center rounded-full lg:hidden", overlay ? "text-white hover:bg-white/15" : "text-ink-mid hover:bg-grout")}
              onClick={() => setMenu((m) => !m)}
              aria-expanded={menu}
              aria-label={menu ? "Close menu" : "Open menu"}
            >
              {menu ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
          </div>
        </div>

        {menu && (
          <nav className="animate-rise border-t border-slate-200 bg-white px-4 pt-3 pb-5 lg:hidden" aria-label="Mobile">
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  setAreaModal(true);
                }}
                className="press flex items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-bold text-ink-mid hover:bg-grout"
              >
                <MapPin className="size-4 text-cobalt-bright" aria-hidden />
                {currentArea}
                <ChevronDown className="ml-auto size-4 text-ink-faint" aria-hidden />
              </button>
              {links.map((l) => (
                <Link key={l.to} to={l.to} onClick={() => setMenu(false)} className="press rounded-xl px-3 py-3 text-sm font-bold text-ink-mid hover:bg-grout">
                  {l.label}
                </Link>
              ))}
              {signedInCustomer ? (
                <>
                  <Link to="/jobs" onClick={() => setMenu(false)} className="press rounded-xl px-3 py-3 text-sm font-bold text-cobalt hover:bg-cobalt-wash">
                    My bookings and jobs
                  </Link>
                  <Link to="/messages" onClick={() => setMenu(false)} className="press rounded-xl px-3 py-3 text-sm font-bold text-cobalt hover:bg-cobalt-wash">Messages{unreadChats ? ` (${unreadChats} unread)` : ""}</Link>
                  <button
                    onClick={() => {
                      setMenu(false);
                      signOut();
                    }}
                    className="press flex items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-bold text-kiln-deep hover:bg-kiln-wash"
                  >
                    <LogOut className="size-4" aria-hidden />
                    Log out
                  </button>
                </>
              ) : (
                <Link to="/login" onClick={() => setMenu(false)} className="press rounded-xl px-3 py-3 text-sm font-bold text-cobalt hover:bg-cobalt-wash">
                  Customer and worker sign in
                </Link>
              )}
            </div>
          </nav>
        )}
      </header>
      <DemoBar />

      {/* Keyed on pathname only, so typing in search (which changes the query
          string) does not restart the transition and steal focus. */}
      <main key={isMessages ? "messages" : pathname} id="main" className={isMessages ? "messages-main" : "animate-page flex-1"}>
        <Outlet />
      </main>

      <BottomNav />

      <Dialog open={areaModal} onClose={() => setAreaModal(false)} title="Where are you?">
        <p className="mb-4 text-sm text-ink-soft">Pick your neighbourhood in Greater Accra or Kumasi and we will show the verified workers closest to you.</p>
        <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto pr-1">
          {AREAS.map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => selectArea(area)}
              aria-pressed={currentArea === area}
              className={cn(
                "press flex min-h-12 items-center gap-2 rounded-xl border p-3 text-left text-xs font-bold",
                currentArea === area ? "border-cobalt-bright bg-cobalt-wash text-cobalt" : "border-grout-deep bg-white text-ink-mid hover:bg-tile-dim",
              )}
            >
              <MapPin className={cn("size-3.5 shrink-0", currentArea === area ? "text-cobalt-bright" : "text-ink-faint")} aria-hidden />
              <span className="truncate">{area}</span>
            </button>
          ))}
        </div>
      </Dialog>

      {!isMessages && <SiteFooter
        className="public-footer dock-clearance"
        newsletter
        tagline="Verified artisans, transparent prices, and money that only moves when the work is done."
        columns={[
          {
            title: "Services",
            links: SERVICE_IDS.map((s) => ({ label: SERVICES[s].label, to: `/search?service=${s}` })),
          },
          {
            title: "For service pros",
            links: [
              { label: "Join with Ghana Card", to: "/join" },
              { label: "Worker portal login", to: "/login?as=worker" },
            ],
          },
          {
            title: "Company",
            links: [
              { label: "Find a pro", to: "/search" },
              { label: "Escrow protection", to: "/#how-payment-works" },
            ],
          },
        ]}
      />}
    </div>
  );
}
