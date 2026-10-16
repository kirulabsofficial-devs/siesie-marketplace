import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Check, Clock, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { BRAND, SERVICES, WEEKDAYS } from "../config";
import { findCustomer, findWorker, useDb, useSessionState, workerStats } from "../data/store";
import { MessageLink } from "../components/MessageLink";
import { Avatar, EmptyState, FavoriteButton, Gallery, IconButton, Segmented, Stars, Tile, VerifiedBadge } from "../components/ui";
import { SERVICE_PHOTOS, SERVICE_TIERS, type ServiceTier } from "../data/serviceData";
import { date, firstName, money } from "../lib/format";
import { cn } from "../lib/cn";
import { useTitle } from "../lib/hooks";
import { useReveal } from "../lib/motion";
import { NotFound } from "./NotFound";

const PROMISES = [
  { icon: Sparkles, label: "Professional tools included" },
  { icon: Check, label: "Site cleaned afterwards" },
  { icon: ShieldCheck, label: "48h inspection guarantee" },
];

export function WorkerProfile() {
  const { ready, error } = useSessionState();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const worker = useDb((d) => findWorker(d, id));
  const stats = useDb((d) => workerStats(d, id));
  const reviews = useDb((d) =>
    d.jobs
      .filter((j) => j.workerId === id && j.customerReview)
      .sort((a, b) => b.customerReview!.at.localeCompare(a.customerReview!.at))
      .map((j) => ({ job: j, customer: findCustomer(d, j.customerId)! })),
  );
  const isCustomer = useDb((d) => d.session?.role === "customer");

  const primary = worker?.services[0] ?? "tiling";
  const tiers = SERVICE_TIERS[primary] || SERVICE_TIERS.tiling;
  const [selectedTierId, setSelectedTierId] = useState<ServiceTier["id"]>(tiers[0].id);
  const selectedTier = tiers.find((t) => t.id === selectedTierId) ?? tiers[0];

  const ref = useReveal<HTMLDivElement>();

  useTitle(worker ? `${worker.name} · ${SERVICES[primary].label} · ${BRAND.name}` : BRAND.name);

  if (!ready) return <div className="session-loading" role="status">Loading this professional…</div>;
  if (error && !worker) return <div className="session-loading" role="alert">{error}</div>;
  if (!worker || worker.verification !== "verified") return <NotFound />;

  const fn = firstName(worker.name);
  const heroPhoto =
    worker.portfolio[0]?.src ||
    SERVICE_PHOTOS[worker.portfolio[0]?.id] ||
    SERVICE_PHOTOS[`svc-${primary}`] ||
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80";

  const tierPrice = Math.round(worker.pricing.from * selectedTier.priceMultiplier);

  const handleBookPackage = () => {
    const titleParam = encodeURIComponent(`${selectedTier.label} ${SERVICES[primary].label} Package`);
    const target = `/book/${worker.id}?service=${primary}&tier=${selectedTier.id}&title=${titleParam}`;
    navigate(isCustomer ? target : `/login?as=customer&next=${encodeURIComponent(target)}`);
  };

  return (
    // Bottom padding clears the fixed booking bar, which replaces the tab dock here.
    <div ref={ref} className="mx-auto max-w-4xl px-4 pt-4 pb-32 sm:px-6 sm:pt-6">
      <div className="flex items-center justify-between gap-3 pb-4">
        <IconButton label="Go back" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-5" aria-hidden />
        </IconButton>
        <h1 className="display-narrow text-lg text-ink">Service details</h1>
        <FavoriteButton id={worker.id} size="lg" />
      </div>

      <div data-reveal="fade" className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-sheet)] bg-ink shadow-[var(--shadow-card)] sm:aspect-[21/9]">
        <img src={heroPhoto} alt={`Work by ${worker.name}`} className="size-full object-cover" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent" />

        <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-cobalt-bright/90 px-3 py-1 text-xs font-extrabold text-white backdrop-blur-md">Service professional</span>
          <VerifiedBadge status={worker.verification} />
        </div>

        <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-4 text-white">
          <div className="min-w-0">
            <span className="eyebrow text-white/70">{SERVICES[primary].label} specialist</span>
            <h2 className="display mt-0.5 truncate text-2xl sm:text-4xl">{worker.name}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm">
              <span className="inline-flex items-center gap-1 text-white/85">
                <MapPin className="size-3.5" aria-hidden />
                {worker.baseArea}
              </span>
              <span className="rounded-full bg-white/95 px-2 py-0.5">
                <Stars value={stats.rating} count={stats.reviews} />
              </span>
            </div>
          </div>

          <Avatar name={worker.name} id={worker.id} size="lg" className="hidden ring-2 ring-white/60 sm:block" />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-6">
        <Tile data-reveal className="p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <h3 className="display-narrow text-base text-ink">About this service</h3>
            <span className="shrink-0 text-xs font-semibold text-ink-soft">{worker.yearsExperience} years experience</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-mid sm:text-base">{worker.bio}</p>
          <MessageLink peerId={worker.id} className="mt-4" />

          <ul className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3.5">
            {PROMISES.map(({ icon: Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-1.5 rounded-lg bg-grout px-2.5 py-1.5 text-xs font-bold text-ink-mid">
                <Icon className="size-3.5 shrink-0 text-cobalt-bright" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </Tile>

        <Tile data-reveal className="border-cobalt-edge p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="display-narrow text-base text-ink">Service packages</h3>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cobalt-wash px-2.5 py-1 text-xs font-extrabold text-cobalt">
              <ShieldCheck className="size-3.5" aria-hidden />
              Escrow protected
            </span>
          </div>

          <Segmented
            className="mt-4"
            label="Choose a package"
            value={selectedTierId}
            onChange={setSelectedTierId}
            options={tiers.map((t) => ({ id: t.id, label: t.label, sub: t.badge }))}
          />

          {/* Keyed on the tier so switching replays the entry animation — the
              panel reads as new content arriving, not text silently swapping. */}
          <div key={selectedTier.id} className="animate-rise mt-5 rounded-[var(--radius-card)] border border-slate-200/70 bg-tile-dim p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h4 className="text-sm font-extrabold text-ink sm:text-base">{selectedTier.label} package</h4>
                <p className="mt-1 text-xs leading-relaxed text-ink-mid sm:text-sm">{selectedTier.summary}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className="block text-xs font-semibold text-ink-faint">Package price</span>
                <span className="text-lg font-extrabold tabular-nums text-cobalt sm:text-xl">{money(tierPrice, { whole: true })}</span>
              </div>
            </div>

            <p className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-ink-soft">
              <Clock className="size-4 shrink-0 text-cobalt-bright" aria-hidden />
              Estimated duration: {selectedTier.duration}
            </p>

            <div className="mt-4 border-t border-slate-200/70 pt-3.5">
              <p className="eyebrow mb-2 text-ink-faint">What is included</p>
              <ul className="space-y-2">
                {selectedTier.includes.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-ink-mid sm:text-sm">
                    <span className="mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full bg-celadon-wash text-emerald-600">
                      <Check className="size-3 stroke-[3]" aria-hidden />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Tile>

        <Tile data-reveal className="p-5 sm:p-6">
          <h3 className="display-narrow text-base text-ink">Availability</h3>
          <ul className="mt-3 grid max-w-sm grid-cols-7 gap-1.5">
            {WEEKDAYS.map((d, i) => {
              const on = worker.availability.days.includes(i);
              return (
                <li
                  key={d}
                  className={cn("grid aspect-square place-items-center rounded-xl text-xs font-extrabold", on ? "bg-cobalt-bright text-white" : "bg-grout text-ink-faint")}
                >
                  <span aria-hidden>{d.slice(0, 2)}</span>
                  <span className="sr-only">
                    {d}: {on ? "available" : "not available"}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2.5 text-xs text-ink-soft">{worker.availability.note}</p>
        </Tile>

        <section data-reveal>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="display-narrow text-base text-ink">Past work</h3>
            <span className="text-xs font-semibold text-ink-soft">{worker.portfolio.length} photos</span>
          </div>
          {worker.portfolio.length ? <Gallery photos={worker.portfolio} /> : <EmptyState title={`${fn} has not uploaded past job photos yet.`} />}
        </section>

        <section data-reveal>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h3 className="display-narrow text-base text-ink">Customer reviews</h3>
              <p className="text-xs text-ink-soft">Only verified paid clients can leave ratings</p>
            </div>
            <Stars value={stats.rating} count={stats.reviews} size="md" />
          </div>

          {reviews.length === 0 ? (
            <EmptyState title="No customer reviews yet" body={`${fn} is freshly verified on Siesie. Every booking is still covered by escrow protection.`} />
          ) : (
            <ul className="space-y-3">
              {reviews.map(({ job, customer }) => (
                <li key={job.id} className="rounded-[var(--radius-card)] border border-slate-100 bg-white p-4 shadow-[var(--shadow-flush)] sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <Stars value={job.customerReview!.rating} />
                    <span className="text-xs text-ink-faint">{date(job.customerReview!.at, true)}</span>
                  </div>
                  {job.customerReview!.text && <p className="mt-2 text-xs leading-relaxed text-ink-mid sm:text-sm">“{job.customerReview!.text}”</p>}
                  <p className="mt-2.5 text-xs font-bold text-ink-soft">
                    {firstName(customer.name)}, {job.area} · {job.title}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/*
        Booking bar. On this route it replaces the tab dock (BottomNav hides
        itself on /workers/*) so the two fixed bars can never stack.
      */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <span className="block text-[11px] font-semibold text-ink-faint">{selectedTier.label} package</span>
            <span className="text-base font-extrabold whitespace-nowrap tabular-nums text-ink sm:text-lg">{money(tierPrice, { whole: true })}</span>
          </div>

          <button
            type="button"
            onClick={handleBookPackage}
            className="press sheen inline-flex min-h-13 flex-1 items-center justify-center gap-2 rounded-full bg-cobalt-bright px-6 text-sm font-extrabold text-white shadow-[var(--shadow-cobalt)] sm:max-w-xs"
          >
            Book {selectedTier.label.toLowerCase()}
            <span className="sr-only"> package for {money(tierPrice, { whole: true })}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
