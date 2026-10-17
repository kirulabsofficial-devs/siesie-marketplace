import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowRight, ChevronDown, Mail, MessageCircle } from "lucide-react";
import { BRAND } from "../config";
import { Brand } from "./Brand";
import { KenteBand } from "./Kente";
import { useToast } from "./Toast";
import { cn } from "../lib/cn";
import { LIVE_BACKEND } from "../data/runtime";

export interface FooterColumn {
  title: string;
  links: Array<{ label: string; to: string }>;
}

/**
 * Negative footer.
 *
 * The brand set oversized and cropped at the baseline, reversed out of a dark
 * block, with the useful links on a light panel underneath. The wordmark is
 * decorative — it is aria-hidden, and the real navigable brand link sits in the
 * panel — so the size is doing typographic work, not carrying information.
 *
 * Shared by all three shells so the customer app, the worker dashboard and the
 * admin console end on the same note.
 */
export function SiteFooter({
  columns,
  newsletter,
  className,
  tagline,
}: {
  columns: FooterColumn[];
  /** Marketing sign-up. Only the public site shows it. */
  newsletter?: boolean;
  className?: string;
  tagline?: ReactNode;
}) {
  return (
    // A container, so the wordmark sizes against the footer's own width rather
    // than the viewport's — the admin console sits beside a 17rem sidebar, and
    // vw units would push the type straight off the edge there.
    <footer className={cn("site-footer @container mt-auto", className)}>
      <KenteBand className="footer-kente h-12 w-full sm:h-14" />

      <div className="footer-wordmark-panel relative overflow-hidden bg-cobalt-deep">
        {tagline && (
          <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-14">
            <p className="max-w-md text-sm leading-relaxed text-white/60 sm:text-base">{tagline}</p>
          </div>
        )}

        {/*
          The negative margin pulls the block's bottom edge up into the
          letterforms, so the type is cropped rather than merely large. Both the
          size and the crop are in em, so they hold at every width.
        */}
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
          <span
            aria-hidden
            // Sized to fill the measure, with the max capped so it still fits
            // the 1232px content box once the container stops growing.
            className="footer-wordmark display -mb-[0.13em] block text-[clamp(5rem,35.5cqw,30rem)] leading-[0.75] text-white select-none"
          >
            {BRAND.name}
          </span>
        </div>
      </div>

      <div className="bg-white">
        <div className="footer-content mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="footer-grid grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
            <div>
              <Brand />
              <p className="footer-description mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">
                {LIVE_BACKEND ? "Find verified home professionals in Ghana. Request quotes and keep your conversations in one place." : "Ghana's verified home services platform. Every payment is held until you confirm the work."}
              </p>

              {newsletter && !LIVE_BACKEND && <FooterGroup title="New pros in your area" newsletter><JournalSignup /></FooterGroup>}

              <div className="footer-contacts mt-6 flex flex-col gap-1.5 text-sm">
                <a href={`https://wa.me/${BRAND.supportWhatsApp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="press -ml-2 inline-flex min-h-11 w-fit items-center gap-2 rounded-lg px-2 font-bold text-ink hover:bg-grout">
                  <MessageCircle className="size-4 shrink-0 text-ink-faint" aria-hidden />
                  {BRAND.supportWhatsApp}<span className="font-normal text-ink-faint">WhatsApp</span>
                </a>
                <a href={`mailto:${BRAND.supportEmail}`} className="press -ml-2 inline-flex min-h-11 w-fit items-center gap-2 rounded-lg px-2 font-bold text-ink hover:bg-grout">
                  <Mail className="size-4 shrink-0 text-ink-faint" aria-hidden />
                  <span className="hidden sm:inline">{BRAND.supportEmail}</span><span className="sm:hidden">Email us</span>
                </a>
              </div>
            </div>

            <div className="footer-links grid gap-8 sm:grid-cols-3">
              {columns.map((col) => (
                <nav key={col.title} aria-label={col.title}>
                  <FooterGroup title={col.title}>
                  <ul className="mt-3 flex flex-col">
                    {col.links.map((l) => (
                      <li key={l.to + l.label}>
                        <Link to={l.to} className="press -ml-2 inline-flex min-h-11 items-center rounded-lg px-2 text-sm text-ink-mid hover:bg-grout hover:text-cobalt">
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  </FooterGroup>
                </nav>
              ))}
            </div>
          </div>

          <div className="footer-copyright mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-grout pt-6 text-xs text-ink-soft">
            <p>
              © {new Date().getFullYear()} {BRAND.name}. Accra, Tema and Kumasi{!LIVE_BACKEND && " · Payments protected by Paystack."}
            </p>
            <div className="flex items-center gap-4">
              <Link to="/terms" className="hover:text-cobalt underline-offset-4 hover:underline">
                Terms of Service
              </Link>
              <span aria-hidden>·</span>
              <Link to="/privacy" className="hover:text-cobalt underline-offset-4 hover:underline">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterGroup({ title, children, newsletter }: { title: string; children: ReactNode; newsletter?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className={cn("footer-group", newsletter && "footer-newsletter")}>
    {!newsletter && <h2 className="footer-desktop-title eyebrow text-ink-faint">{title}</h2>}
    <button className="footer-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>{title}<ChevronDown size={16} aria-hidden /></button>
    <div id={id} className={cn("footer-group-body", open && "is-open")}>{children}</div>
  </div>;
}

/** Prototype sign-up: confirms locally and sends nothing anywhere. */
function JournalSignup() {
  const toast = useToast();
  const [email, setEmail] = useState("");

  return (
    <form
      className="mt-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!email.trim()) return;
        setEmail("");
        toast("Thanks. We'll let you know when new pros join your area.");
      }}
    >
      <label htmlFor="footer-email" className="text-sm font-bold text-ink">
        New pros in your area
      </label>
      <p className="mt-0.5 text-xs text-ink-soft">An occasional note when verified workers join near you.</p>
      <div className="mt-2.5 flex items-center gap-2 rounded-full border border-grout-deep bg-white py-1 pr-1 pl-4 transition-all duration-[var(--dur-quick)] focus-within:border-cobalt-bright focus-within:shadow-[0_0_0_4px_var(--color-cobalt-wash)]">
        <input
          id="footer-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-sm placeholder:text-ink-faint focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Subscribe"
          className="press grid size-10 shrink-0 place-items-center rounded-full bg-ink text-white hover:bg-cobalt-bright"
        >
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
    </form>
  );
}
