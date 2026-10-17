import { useEffect, useState } from "react";
import { CreditCard, Smartphone } from "lucide-react";
import type { MomoNetwork } from "../data/types";
import { BRAND, MOMO_NETWORKS } from "../config";
import { detectNetwork, isValidGhanaMobile, simulateCharge, startLiveCheckout, TEST_MODE, type ChargeResult } from "../payments/paystack";
import { firstName, money, phone as fmtPhone } from "../lib/format";
import { cn } from "../lib/cn";
import { Button, Dialog, Field } from "./ui";
import { MoneyTrack } from "./MoneyTrack";

type Method = MomoNetwork | "card";
type Step = "choose" | "approve" | "done";

export function PaystackCheckout({
  jobId,
  open,
  onClose,
  amount,
  jobTitle,
  workerName,
  defaultPhone,
  onPaid,
}: {
  jobId: string;
  open: boolean;
  onClose: () => void;
  amount: number;
  jobTitle: string;
  workerName: string;
  defaultPhone: string;
  onPaid: (r: ChargeResult) => void | Promise<void>;
}) {
  const [step, setStep] = useState<Step>("choose");
  const [method, setMethod] = useState<Method>(detectNetwork(defaultPhone) ?? "mtn");
  const [number, setNumber] = useState(fmtPhone(defaultPhone));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("choose");
      setError(null);
      setBusy(null);
      setSettled(false);
      setLeaving(false);
    }
  }, [open]);

  useEffect(() => {
    if (step === "done") {
      const t = setTimeout(() => setSettled(true), 120);
      return () => clearTimeout(t);
    }
  }, [step]);

  const phoneOk = isValidGhanaMobile(number);
  const detected = detectNetwork(number);
  const mismatch = method !== "card" && phoneOk && detected && detected !== method;

  async function run(approve: boolean) {
    setBusy(approve ? "approve" : "decline");
    setError(null);
    try {
      const r = method === "card" ? await simulateCharge({ channel: "card", last4: "4081" }) : await simulateCharge({ channel: "momo", phone: number, network: method, approve });
      await onPaid(r);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed. No money was taken.");
      setStep("choose");
    } finally {
      setBusy(null);
    }
  }

  const methods: { id: Method; label: string }[] = [
    ...(Object.entries(MOMO_NETWORKS) as [MomoNetwork, { label: string }][]).map(([id, n]) => ({ id, label: n.label })),
    { id: "card", label: "Visa or Mastercard" },
  ];

  async function goToPaystack() {
    setLeaving(true);
    setError(null);
    try {
      await startLiveCheckout(jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment couldn't start. No money was taken.");
      setLeaving(false);
    }
  }

  // Live: Paystack's own checkout page takes the money, then sends the customer back to the job.
  if (!TEST_MODE) return (
    <Dialog open={open} onClose={leaving ? () => {} : onClose} title={`Pay ${money(amount)}`}>
      <div className="flex flex-col gap-5">
        <div className="rounded-[var(--radius-tile)] bg-tile-dim p-4">
          <p className="text-sm text-ink-soft">{jobTitle}</p>
          <p className="figure mt-1 text-2xl font-bold">{money(amount)}</p>
          <p className="mt-2 text-[0.9375rem]">
            {BRAND.name} holds this payment. {firstName(workerName)} gets it only after you confirm the job is done.
          </p>
        </div>
        <p className="text-[0.9375rem] text-ink-soft">
          You'll pay on Paystack's secure page with mobile money or a Visa or Mastercard card, then come straight back here. Your wallet PIN and card details are never entered on {BRAND.name}.
        </p>
        {error && <p className="rounded-[var(--radius-tile)] bg-kiln-wash p-3 font-bold text-kiln-deep">{error}</p>}
        <Button size="lg" busy={leaving} onClick={() => void goToPaystack()}>
          Continue to Paystack
        </Button>
      </div>
    </Dialog>
  );

  return (
    <Dialog open={open} onClose={busy ? () => {} : onClose} title={step === "done" ? "Payment held" : `Pay ${money(amount)}`}>
      {TEST_MODE && (
        <p className="-mt-2 mb-4 inline-flex rounded border border-dashed border-ink-soft/60 px-2 py-0.5 font-mono text-xs text-ink-soft">
          Test checkout · simulates Paystack · no real money
        </p>
      )}

      {step === "choose" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (method !== "card" && !phoneOk) return;
            setStep("approve");
          }}
          className="flex flex-col gap-5"
        >
          <div className="rounded-[var(--radius-tile)] bg-tile-dim p-4">
            <p className="text-sm text-ink-soft">{jobTitle}</p>
            <p className="figure mt-1 text-2xl font-bold">{money(amount)}</p>
            <p className="mt-2 text-[0.9375rem]">
              {BRAND.name} holds this payment. {firstName(workerName)} gets it only after you confirm the job is done.
            </p>
          </div>

          <fieldset>
            <legend className="mb-2 font-bold">Pay with</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {methods.map((m) => (
                <label
                  key={m.id}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center gap-2.5 rounded-[var(--radius-tile)] border-2 px-3 font-bold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-cobalt-bright",
                    method === m.id ? "border-cobalt bg-cobalt-wash text-cobalt" : "border-grout-deep hover:border-ink-soft",
                  )}
                >
                  <input type="radio" name="method" className="sr-only" checked={method === m.id} onChange={() => setMethod(m.id)} />
                  {m.id === "card" ? <CreditCard className="size-5" aria-hidden /> : <Smartphone className="size-5" aria-hidden />}
                  {m.label}
                </label>
              ))}
            </div>
          </fieldset>

          {method !== "card" ? (
            <Field
              label="Mobile money number"
              error={touched && !phoneOk ? "Enter a 10-digit Ghana number, like 024 412 3456." : null}
              hint={mismatch ? `That number looks like ${MOMO_NETWORKS[detected!].label}. Check the network.` : undefined}
            >
              {(p) => <input {...p} className="field figure" inputMode="tel" autoComplete="tel" value={number} onChange={(e) => setNumber(e.target.value)} onBlur={() => setTouched(true)} />}
            </Field>
          ) : (
            <p className="text-[0.9375rem] text-ink-soft">Paystack's secure card form opens next. Card details are never entered on {BRAND.name}.</p>
          )}

          {error && <p className="rounded-[var(--radius-tile)] bg-kiln-wash p-3 font-bold text-kiln-deep">{error}</p>}

          <Button type="submit" size="lg">
            Pay {money(amount)}
          </Button>
        </form>
      )}

      {step === "approve" && (
        <div className="flex flex-col gap-5">
          {method === "card" ? (
            <p>Complete the payment in Paystack's card window.</p>
          ) : (
            <>
              <p className="text-lg">
                A payment prompt was sent to <span className="figure font-bold">{number}</span>.
              </p>
              <p className="text-ink-soft">Enter your {MOMO_NETWORKS[method].label} PIN on your phone to approve {money(amount)}. Keep this window open.</p>
            </>
          )}
          <div className="rounded-[var(--radius-tile)] border-2 border-dashed border-grout-deep p-4">
            <p className="mb-3 font-mono text-xs text-ink-soft">Test controls: choose what the phone does</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => run(true)} busy={busy === "approve"} disabled={!!busy}>
                {method === "card" ? "Simulate card success" : "Approve on phone"}
              </Button>
              {method !== "card" && (
                <Button variant="secondary" onClick={() => run(false)} busy={busy === "decline"} disabled={!!busy}>
                  Decline on phone
                </Button>
              )}
            </div>
          </div>
          <button type="button" className="self-start text-sm font-bold text-cobalt underline underline-offset-4" onClick={() => setStep("choose")} disabled={!!busy}>
            Change payment method
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="flex flex-col gap-5">
          <MoneyTrack
            state={settled ? "held" : "unpaid"}
            amount={amount}
            workerName={workerName}
            size="lg"
            caption={`${firstName(workerName)} has been told the money is secured and can start. You'll confirm when the job is done.`}
          />
          <Button size="lg" onClick={onClose}>
            Back to the job
          </Button>
        </div>
      )}
    </Dialog>
  );
}
