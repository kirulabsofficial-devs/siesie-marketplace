import { useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, CircleAlert, Lock, MapPin, ShieldCheck } from "lucide-react";
import type { Photo, ServiceId } from "../data/types";
import { BRAND, SERVICES } from "../config";
import { findCustomer, findWorker, requestBooking, useDb, workerStats } from "../data/store";
import { Avatar, Button, ChoiceChip, Field, Stars, Tile, VerifiedBadge } from "../components/ui";
import { MoneyGlyph } from "../components/MoneyTrack";
import { PhotoPicker } from "../components/PhotoPicker";
import { KenteBand } from "../components/Kente";
import { useAction } from "../components/Toast";
import { firstName } from "../lib/format";
import { priceText } from "../lib/pricing";
import { useTitle } from "../lib/hooks";
import { useReveal } from "../lib/motion";
import { NotFound } from "./NotFound";

function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

/** Numbered section heading, so a long form reads as a few short steps. */
function Step({ n, title, lead }: { n: number; title: string; lead?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-cobalt-wash text-xs font-extrabold text-cobalt">{n}</span>
      <div className="min-w-0">
        <h2 className="display-narrow text-base text-ink">{title}</h2>
        {lead && <p className="mt-0.5 text-sm text-ink-soft">{lead}</p>}
      </div>
    </div>
  );
}

export function BookingRequest() {
  const { workerId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const run = useAction();
  const worker = useDb((d) => findWorker(d, workerId));
  const stats = useDb((d) => workerStats(d, workerId));
  const customer = useDb((d) => (d.session ? findCustomer(d, d.session.userId) : undefined));
  useTitle(`Book ${worker?.name ?? ""} · ${BRAND.name}`);

  const initialService = (params.get("service") as ServiceId | null) ?? worker?.services[0] ?? "tiling";
  const [service, setService] = useState<ServiceId>(worker?.services.includes(initialService) ? initialService : (worker?.services[0] ?? "tiling"));
  const [title, setTitle] = useState(params.get("title") ? decodeURIComponent(params.get("title")!) : "");
  const [scope, setScope] = useState(
    params.get("tier") ? `Selected package: ${params.get("tier")?.toUpperCase()}. Please confirm availability for the service.` : "",
  );
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [area, setArea] = useState(customer && worker?.areas.includes(customer.area) ? customer.area : "");
  const [address, setAddress] = useState("");
  const [when, setWhen] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const ref = useReveal<HTMLDivElement>();

  if (!worker || worker.verification !== "verified") return <NotFound />;
  const fn = firstName(worker.name);

  const errors = {
    title: title.trim().length < 4 ? "Give the job a short name, like “Retile bathroom floor”." : null,
    scope: scope.trim().length < 20 ? `Describe the job in a sentence or two so ${fn} can price it.` : null,
    area: !area ? "Choose the area where the job is." : null,
    when: !when ? "Pick a date." : when < todayISO() ? "Pick today or a later date." : null,
    address: address.trim().length < 4 ? "Add a house number, street or landmark." : null,
  };
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : null);
  const openErrors = submitted ? (Object.entries(errors) as Array<[keyof typeof errors, string | null]>).filter(([, v]) => v) : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean) || !customer) {
      // Focus the summary, not the first bad field: the person gets the whole
      // list read out instead of discovering problems one at a time.
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    let id = "";
    const ok = await run(async () => {
      id = await requestBooking({
        customerId: customer.id,
        workerId: worker!.id,
        service,
        title: title.trim(),
        scope: scope.trim(),
        photos,
        area,
        address: `${area}, ${address.trim()}`,
        preferredDate: new Date(`${when}T09:00:00`).toISOString(),
      });
    }, `Request sent to ${fn}.`);
    if (ok) navigate(`/jobs/${id}`);
  }

  const examples = SERVICES[service].examples;

  return (
    // pb-36 clears the sticky mobile submit bar; the tab dock is hidden on /book.
    <div ref={ref} className="mx-auto max-w-6xl px-4 py-6 pb-36 sm:px-6 sm:py-10 lg:pb-10">
      <Link to={`/workers/${worker.id}`} className="press -ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-bold text-ink-soft hover:bg-grout hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        Back to {fn}'s profile
      </Link>

      <header data-reveal="fade" className="mt-3">
        <h1 className="display text-[1.875rem] sm:text-[2.5rem]">Request a booking</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-soft sm:text-base">
          {fn} replies with a price and a date. Nothing is charged until you accept it.
        </p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] lg:items-start">
        <Tile as="div" data-reveal className="min-w-0 p-5 sm:p-7">
          <form id="booking-form" noValidate onSubmit={submit} className="flex flex-col gap-7">
            {openErrors.length > 0 && (
              <div
                ref={summaryRef}
                tabIndex={-1}
                role="alert"
                className="animate-rise rounded-[var(--radius-tile)] border border-kiln/35 bg-kiln-wash p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kiln"
              >
                <p className="flex items-center gap-2 font-bold text-kiln-deep">
                  <CircleAlert className="size-4.5 shrink-0" aria-hidden />
                  {openErrors.length === 1 ? "One thing to fix" : `${openErrors.length} things to fix`}
                </p>
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  {openErrors.map(([key, msg]) => (
                    <li key={key}>
                      <a href={`#book-${key}`} className="font-semibold text-kiln-deep underline underline-offset-4 hover:text-ink">
                        {msg}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <section className="flex flex-col gap-5">
              <Step n={1} title="The job" lead={`What you need ${fn} to do.`} />

              {worker.services.length > 1 && (
                <fieldset>
                  <legend className="mb-2 text-sm font-bold text-ink">Service</legend>
                  <div className="flex flex-wrap gap-2">
                    {worker.services.map((s) => (
                      <ChoiceChip key={s} type="radio" name="service" checked={service === s} onChange={() => setService(s)}>
                        {SERVICES[s].label}
                      </ChoiceChip>
                    ))}
                  </div>
                </fieldset>
              )}

              <Field id="book-title" label="What needs doing?" error={show("title")} hint={`For example: ${examples.slice(0, 2).join(", ").toLowerCase()}.`}>
                {(p) => <input {...p} className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />}
              </Field>

              <Field
                id="book-scope"
                label="Details"
                error={show("scope")}
                hint="Size of the area, materials you already have, and anything the worker should know before quoting."
              >
                {(p) => <textarea {...p} className="field" value={scope} onChange={(e) => setScope(e.target.value)} maxLength={1200} />}
              </Field>

              <div>
                <p className="text-sm font-bold text-ink">
                  Photos <span className="font-normal text-ink-faint">(optional)</span>
                </p>
                <p className="mt-0.5 mb-3 text-xs text-ink-soft">
                  Photos help {fn} give an accurate price. They are also your record if there is a dispute later.
                </p>
                <PhotoPicker value={photos} onChange={setPhotos} />
              </div>
            </section>

            <section className="flex flex-col gap-5 border-t border-grout pt-7">
              <Step n={2} title="Where and when" lead="The address stays private until you pay." />

              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="book-area" label="Area" error={show("area")} hint={`${fn} covers these areas.`}>
                  {(p) => (
                    <select {...p} className="field" value={area} onChange={(e) => setArea(e.target.value)}>
                      <option value="">Choose an area</option>
                      {worker.areas.map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field id="book-when" label="Preferred date" error={show("when")} hint="The worker can suggest another date.">
                  {(p) => <input {...p} type="date" className="field" min={todayISO()} value={when} onChange={(e) => setWhen(e.target.value)} />}
                </Field>
              </div>

              <Field id="book-address" label="Address or landmark" error={show("address")} hint="Shared with the worker only after you pay.">
                {(p) => (
                  <input
                    {...p}
                    className="field"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="House no. 14, Lagos Avenue, near the Shell station"
                    autoComplete="street-address"
                  />
                )}
              </Field>
            </section>

            {/* Desktop submit. On phones the sticky bar below owns this action. */}
            <div className="hidden items-center gap-4 border-t border-grout pt-6 lg:flex">
              <Button type="submit" size="lg">
                Send request to {fn}
              </Button>
              <p className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
                <Lock className="size-4 shrink-0 text-ink-faint" aria-hidden />
                Nothing is charged now.
              </p>
            </div>

          </form>
        </Tile>

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24">
          <Tile data-reveal className="flex gap-3 p-4">
            <Avatar name={worker.name} id={worker.id} size="lg" />
            <div className="min-w-0">
              <p className="font-bold text-ink">{worker.name}</p>
              <div className="mt-1">
                <VerifiedBadge status={worker.verification} />
              </div>
              <div className="mt-1.5">
                <Stars value={stats.rating} count={stats.reviews} />
              </div>
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-soft">
                <MapPin className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
                {worker.baseArea}
              </p>
              <p className="mt-1.5 text-sm font-bold text-ink">{priceText(worker)}</p>
            </div>
          </Tile>

          {/* Woven header, clipped to the card radius by overflow-hidden. */}
          <Tile data-reveal className="overflow-hidden p-0">
            <KenteBand className="h-6 w-full" />
            <div className="p-5">
            <h2 className="display-narrow inline-flex items-center gap-2 text-base">
              <ShieldCheck className="size-4.5 shrink-0 text-cobalt-bright" aria-hidden />
              What happens next
            </h2>
            <ol className="mt-3.5 flex flex-col gap-3.5">
              {(
                [
                  ["unpaid", `${fn} accepts with a price and date, or declines.`],
                  ["held", `You pay to confirm. ${BRAND.name} holds the money.`],
                  ["held", `${fn} does the job and marks it complete. You check it.`],
                  ["released", `You confirm and ${fn} is paid. Or report a problem and the money stays frozen.`],
                ] as const
              ).map(([state, text], i) => (
                <li key={i} className="flex gap-3 text-sm text-ink-mid">
                  <MoneyGlyph state={state} className="mt-1.5 shrink-0" />
                  <span>{text}</span>
                </li>
              ))}
            </ol>
            </div>
          </Tile>
        </aside>
      </div>

      {/*
        Outside the animated card on purpose. A fixed element inside a container
        that is mid-animation anchors to that container, so this lives at the
        page root and reaches the form by id instead.
      */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <p className="inline-flex flex-1 items-center gap-1.5 text-xs font-semibold text-ink-soft">
            <Lock className="size-3.5 shrink-0" aria-hidden />
            Nothing charged now
          </p>
          <Button type="submit" form="booking-form" size="md" className="min-w-40">
            Send request
          </Button>
        </div>
      </div>
    </div>
  );
}
