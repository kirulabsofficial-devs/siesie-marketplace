import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, CircleAlert, MessageSquareText, ShieldCheck } from "lucide-react";
import type { Role } from "../data/types";
import { AREAS, BRAND, DEMO_OTP } from "../config";
import { registerCustomer, signInWithCode, useSessionState } from "../data/store";
import { Avatar, Button, Field, Tile } from "../components/ui";
import { isValidGhanaMobile } from "../payments/paystack";
import { phone as fmtPhone } from "../lib/format";
import { useTitle } from "../lib/hooks";
import { cn } from "../lib/cn";
import { KenteBand } from "../components/Kente";
import { LIVE_BACKEND, STATIC_PROTOTYPE } from "../data/runtime";
import { LiveLogin } from "./LiveLogin";

const HOME: Record<Role, string> = { customer: "/jobs", worker: "/work", admin: "/admin" };

type Step = "phone" | "code" | "new";

const STEPS: Array<{ id: Step; label: string }> = [
  { id: "phone", label: "Number" },
  { id: "code", label: "Code" },
  { id: "new", label: "Details" },
];

const DEMO_ACCOUNTS = [
  { role: "Customer", name: "Ama Owusu", phone: "0244123456" },
  { role: "Worker", name: "Kwame Asante", phone: "0245550101" },
  { role: "Admin", name: "Adjoa Sarpong", phone: "0302000000" },
];

export function Login() {
  return LIVE_BACKEND ? <LiveLogin /> : <DemoLogin />;
}

function DemoLogin() {
  useTitle(`Log in · ${BRAND.name}`);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { pending } = useSessionState();
  const requestedNext = params.get("next");
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.includes("\\") ? requestedNext : null;
  const as = params.get("as") as Role | null;

  const [step, setStep] = useState<Step>("phone");
  const [number, setNumber] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [error, setError] = useState<string | null>(null);

  function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidGhanaMobile(number) && !/^0\d{9}$/.test(number.replace(/\D/g, ""))) {
      setError("Enter a 10-digit phone number, like 024 412 3456.");
      return;
    }
    setError(null);
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (code.replace(/\D/g, "") !== DEMO_OTP) {
      setError("That code doesn’t match. Use the demo code 123456.");
      return;
    }
    setError(null);
    try {
      const account = await signInWithCode(number, code);
      if (!account) { setStep("new"); return; }
      const target = next && (account.role === as || !as) ? next : HOME[account.role];
      navigate(target, { replace: true });
    } catch (e) { setError((e as Error).message); }
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2 || !area) {
      setError("Add your name and area.");
      return;
    }
    try {
      await registerCustomer({ name: name.trim(), phone: number.replace(/\D/g, ""), area });
      navigate(next && as !== "worker" ? next : "/search", { replace: true });
    } catch (e) { setError((e as Error).message); }
  }

  // "new" only ever follows a successful code check, so it counts as step 3.
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
      <Link to="/" className="press -ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-bold text-ink-soft hover:bg-grout hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        Back to {BRAND.name}
      </Link>

      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:items-start">
        {/* Woven header on the card. overflow-hidden clips the band to the
            card's radius so it sits flush in the corners. */}
        <Tile as="div" className="min-w-0 overflow-hidden p-0">
          <KenteBand className="h-6 w-full" />
          <div className="p-6 sm:p-8">
          {/* Progress. Three short steps stated up front beats a form that
              keeps producing one more screen. */}
          <ol className="mb-7 flex flex-wrap items-center gap-2" aria-label="Sign-in progress">
            {STEPS.map((s, i) => {
              const done = i < stepIndex;
              const current = i === stepIndex;
              return (
                <li key={s.id} className="flex flex-1 items-center gap-2">
                  <span
                    aria-current={current ? "step" : undefined}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs font-bold transition-colors duration-[var(--dur-move)]",
                      current ? "text-cobalt" : done ? "text-ink-soft" : "text-ink-faint",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-6 place-items-center rounded-full text-[11px] transition-colors duration-[var(--dur-move)]",
                        current ? "bg-cobalt-bright text-white" : done ? "bg-cobalt-wash text-cobalt" : "bg-grout text-ink-faint",
                      )}
                    >
                      {i + 1}
                    </span>
                    {s.label}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span aria-hidden className="h-0.5 flex-1 overflow-hidden rounded-full bg-grout">
                      <span
                        className={cn("block h-full rounded-full bg-cobalt-bright transition-transform duration-[var(--dur-sheet)] ease-[var(--ease-set)]", done ? "scale-x-100" : "scale-x-0")}
                        style={{ transformOrigin: "left center" }}
                      />
                    </span>
                  )}
                </li>
              );
            })}
          </ol>

          {/* Keyed on step so each screen animates in rather than snapping. */}
          <div key={step} className="animate-rise">
            {step === "phone" && (
              <form onSubmit={sendCode} className="flex flex-col gap-5" noValidate>
                <div>
                  <h1 className="display text-[1.875rem]">Log in or sign up</h1>
                  <p className="mt-2 text-ink-soft">Explore with a sample account and the demo code 123456. No SMS is sent.</p>
                </div>
                <Field label="Phone number" error={error}>
                  {(p) => (
                    <input
                      {...p}
                      className="field figure text-lg"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="024 412 3456"
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      autoFocus
                    />
                  )}
                </Field>
                <Button type="submit" size="lg" disabled={pending}>
                  Send code
                </Button>
                <p className="text-sm text-ink-soft">
                  Tiler, cleaner or handyman?{" "}
                  <Link to="/join" className="font-bold text-cobalt underline underline-offset-4">
                    Register as a worker
                  </Link>
                </p>
              </form>
            )}

            {step === "code" && (
              <form onSubmit={verify} className="flex flex-col gap-5" noValidate>
                <div>
                  <span className="grid size-11 place-items-center rounded-2xl bg-cobalt-wash text-cobalt">
                    <MessageSquareText className="size-5" aria-hidden />
                  </span>
                  <h1 className="display mt-3 text-[1.875rem]">Enter the code</h1>
                  <p className="mt-2 text-ink-soft">
                    Demo sign-in for <span className="figure font-bold text-ink">{fmtPhone(number)}</span>.
                  </p>
                </div>
                <Field label="6-digit code" error={error} hint={`Test mode: the code is ${DEMO_OTP}.`}>
                  {(p) => (
                    <input
                      {...p}
                      className="field figure text-center text-2xl tracking-[0.4em]"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      autoFocus
                    />
                  )}
                </Field>
                <Button type="submit" size="lg" disabled={pending}>
                  Continue
                </Button>
                <button
                  type="button"
                  className="press -ml-2 self-start rounded-full px-2 py-2.5 text-sm font-bold text-cobalt hover:bg-cobalt-wash"
                  onClick={() => {
                    setStep("phone");
                    setCode("");
                    setError(null);
                  }}
                >
                  Use a different number
                </button>
              </form>
            )}

            {step === "new" && (
              <form onSubmit={createAccount} className="flex flex-col gap-5" noValidate>
                <div>
                  <h1 className="display text-[1.875rem]">Create your account</h1>
                  <p className="mt-2 text-ink-soft">
                    <span className="figure">{fmtPhone(number)}</span> is new to {BRAND.name}. Two details and you can book.
                  </p>
                </div>
                <Field label="Your name">
                  {(p) => <input {...p} className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />}
                </Field>
                <Field label="Your area" hint="Used to show workers who cover it.">
                  {(p) => (
                    <select {...p} className="field" value={area} onChange={(e) => setArea(e.target.value)}>
                      <option value="">Choose an area</option>
                      {AREAS.map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                  )}
                </Field>
                {error && (
                  <p role="alert" className="animate-rise inline-flex items-center gap-2 text-sm font-bold text-kiln-deep">
                    <CircleAlert className="size-4 shrink-0" aria-hidden />
                    {error}
                  </p>
                )}
                <Button type="submit" size="lg" disabled={pending}>
                  Create account
                </Button>
              </form>
            )}
          </div>

            <p className="mt-7 inline-flex items-start gap-2 border-t border-grout pt-5 text-xs leading-relaxed text-ink-soft">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-celadon" aria-hidden />
              {STATIC_PROTOTYPE ? "Use sample details. Demo accounts, bookings and messages are saved only in this browser; no real bookings or payments are made." : "Your number is only used to sign you in and to let a worker reach you about a job you booked."}
            </p>
          </div>
        </Tile>

        <aside className="min-w-0">
          <Tile className="p-5">
            <p className="eyebrow text-ink-faint">Prototype accounts</p>
            <p className="mt-1 text-xs text-ink-soft">
              Tap one to fill the number. The code is always <span className="figure font-bold text-ink">{DEMO_OTP}</span>.
            </p>
            <ul className="mt-4 flex flex-col gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.phone}>
                  <button
                    type="button"
                    className="press flex w-full items-center gap-3 rounded-[var(--radius-tile)] border border-slate-100 bg-tile-dim p-3 text-left hover:border-cobalt-edge hover:bg-cobalt-wash"
                    onClick={() => {
                      setNumber(a.phone);
                      setStep("phone");
                      setCode("");
                      setError(null);
                    }}
                  >
                    <Avatar name={a.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{a.name}</span>
                      <span className="figure block text-xs text-ink-soft">{fmtPhone(a.phone)}</span>
                    </span>
                    <span className="eyebrow shrink-0 rounded-full bg-white px-2 py-1 text-ink-soft">{a.role}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Tile>
        </aside>
      </div>
    </div>
  );
}
