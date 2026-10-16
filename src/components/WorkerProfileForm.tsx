import { useState } from "react";
import type { Photo, Worker } from "../data/types";
import { AREAS, BANKS, MOMO_NETWORKS, SERVICE_IDS, SERVICES, WEEKDAYS } from "../config";
import { type WorkerProfileInput } from "../data/store";
import { type ProfileFields, validateWorkerProfile } from "../lib/validation";
import { Button, ChoiceChip, Field, Tile } from "./ui";
import { PhotoPicker } from "./PhotoPicker";
import { LIVE_BACKEND } from "../data/runtime";

const empty: ProfileFields = {
  name: "", phone: "", services: [], baseArea: "", areas: [], bio: "", yearsExperience: 0,
  pricing: { mode: "quote", from: 100, to: 500, unit: "per job" },
  availability: { days: [1, 2, 3, 4, 5], note: "" },
  payout: { type: "momo", network: "mtn", number: "", name: "" },
};

export function WorkerProfileForm({ worker, onSave }: { worker?: Worker; onSave: (value: WorkerProfileInput) => unknown | Promise<unknown> }) {
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState<ProfileFields>(worker ?? empty);
  const [card, setCard] = useState("");
  const [idPhotos, setIdPhotos] = useState<Photo[]>([]);
  const [selfies, setSelfies] = useState<Photo[]>([]);
  const [error, setError] = useState<string | null>(null);
  function update<K extends keyof ProfileFields>(key: K, next: ProfileFields[K]) { setValue((v) => ({ ...v, [key]: next })); }
  const toggle = <T,>(items: T[], item: T) => items.includes(item) ? items.filter((i) => i !== item) : [...items, item];
  const payout = value.payout;

  return <form className="flex flex-col gap-6" noValidate onSubmit={async (e) => {
    e.preventDefault();
    if (saving) return;
    const problem = validateWorkerProfile(value) ?? (!worker && !/^GHA-\d{9}-\d$/.test(card) ? "Use the Ghana Card format GHA-123456789-0." : null)
      ?? (!worker && (!idPhotos[0]?.src || !selfies[0]?.src) ? "Add an ID photo and a portrait for review." : null);
    setError(problem);
    if (!problem) {
      setSaving(true);
      try { await onSave({ ...value, ghanaCardNumber: card, frontPhoto: idPhotos[0]?.src, selfie: selfies[0]?.src }); }
      catch (error) { setError(error instanceof Error ? error.message : "Your profile could not be saved."); }
      finally { setSaving(false); }
    }
  }}>
    <Tile className="p-5 sm:p-7">
      <h2 className="text-xl font-bold">Your work</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field label="Full name">{(p) => <input {...p} className="field" autoComplete="name" value={value.name} readOnly={!!worker} onChange={(e) => update("name", e.target.value)} />}</Field>
        <Field label="Phone number">{(p) => <input {...p} className="field figure" autoComplete="tel" inputMode="tel" value={value.phone} readOnly={!!worker} onChange={(e) => update("phone", e.target.value)} />}</Field>
      </div>
      <fieldset className="mt-5"><legend className="mb-2 font-bold">Services you offer</legend><div className="flex flex-wrap gap-2">{SERVICE_IDS.map((s) => <ChoiceChip key={s} checked={value.services.includes(s)} onChange={() => update("services", toggle(value.services, s))}>{SERVICES[s].label}</ChoiceChip>)}</div></fieldset>
      <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_10rem]">
        <Field label="About your work" hint="Tell customers about your skills and the jobs you take.">{(p) => <textarea {...p} className="field" maxLength={1200} value={value.bio} onChange={(e) => update("bio", e.target.value)} />}</Field>
        <Field label="Years of experience">{(p) => <input {...p} type="number" min="0" max="60" className="field figure" value={value.yearsExperience} readOnly={!!worker} onChange={(e) => update("yearsExperience", Number(e.target.value))} />}</Field>
      </div>
    </Tile>
    <Tile className="p-5 sm:p-7">
      <h2 className="text-xl font-bold">Where and when</h2>
      <Field label="Base area" className="mt-5">{(p) => <select {...p} className="field" value={value.baseArea} onChange={(e) => {
        const baseArea = e.target.value;
        setValue((v) => ({ ...v, baseArea, areas: baseArea && !v.areas.includes(baseArea) ? [...v.areas, baseArea] : v.areas }));
      }}><option value="">Choose your base</option>{AREAS.map((a) => <option key={a}>{a}</option>)}</select>}</Field>
      <fieldset className="mt-5"><legend className="mb-2 font-bold">Areas you cover</legend><div className="flex flex-wrap gap-2">{AREAS.map((a) => <ChoiceChip key={a} checked={value.areas.includes(a)} onChange={() => update("areas", toggle(value.areas, a))}>{a}</ChoiceChip>)}</div></fieldset>
      <fieldset className="mt-5"><legend className="mb-2 font-bold">Working days</legend><div className="flex flex-wrap gap-2">{WEEKDAYS.map((day, i) => <ChoiceChip key={day} checked={value.availability.days.includes(i)} onChange={() => update("availability", { ...value.availability, days: toggle(value.availability.days, i) })}>{day}</ChoiceChip>)}</div></fieldset>
      <Field label="Availability note" optional className="mt-5">{(p) => <input {...p} className="field" maxLength={200} placeholder="For example, mornings only on Saturdays" value={value.availability.note} onChange={(e) => update("availability", { ...value.availability, note: e.target.value })} />}</Field>
    </Tile>
    <Tile className="p-5 sm:p-7">
      <h2 className="text-xl font-bold">Pricing</h2><p className="mt-1 text-ink-soft">Customers see this guide. You agree a final price for each request.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Pricing approach">{(p) => <select {...p} className="field" value={value.pricing.mode} onChange={(e) => update("pricing", { ...value.pricing, mode: e.target.value as "fixed" | "quote" })}><option value="quote">Quote for each job</option><option value="fixed">Fixed rate</option></select>}</Field>
        <Field label="Pricing unit">{(p) => <input {...p} className="field" value={value.pricing.unit} maxLength={30} onChange={(e) => update("pricing", { ...value.pricing, unit: e.target.value })} />}</Field>
        <Field label="Starting price (GH₵)">{(p) => <input {...p} type="number" min="0.01" step="0.01" className="field figure" value={value.pricing.from} onChange={(e) => update("pricing", { ...value.pricing, from: Number(e.target.value) })} />}</Field>
        <Field label="Upper price (GH₵)">{(p) => <input {...p} type="number" min="0.01" step="0.01" className="field figure" value={value.pricing.to} onChange={(e) => update("pricing", { ...value.pricing, to: Number(e.target.value) })} />}</Field>
      </div>
    </Tile>
    <Tile className="p-5 sm:p-7">
      <h2 className="text-xl font-bold">Where you get paid</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Payout method">{(p) => <select {...p} className="field" value={payout.type} onChange={(e) => update("payout", e.target.value === "momo" ? { type: "momo", network: "mtn", number: "", name: payout.name } : { type: "bank", bank: BANKS[0], number: "", name: payout.name })}><option value="momo">Mobile money</option><option value="bank">Bank account</option></select>}</Field>
        {payout.type === "momo" ? <Field label="Network">{(p) => <select {...p} className="field" value={payout.network} onChange={(e) => update("payout", { ...payout, network: e.target.value as typeof payout.network })}>{Object.entries(MOMO_NETWORKS).map(([id, n]) => <option key={id} value={id}>{n.label}</option>)}</select>}</Field> : <Field label="Bank">{(p) => <select {...p} className="field" value={payout.bank} onChange={(e) => update("payout", { ...payout, bank: e.target.value })}>{BANKS.map((b) => <option key={b}>{b}</option>)}</select>}</Field>}
        <Field label={payout.type === "momo" ? "Payout phone number" : "Bank account number"}>{(p) => <input {...p} className="field figure" inputMode="numeric" value={payout.number} onChange={(e) => update("payout", { ...payout, number: e.target.value.replace(/[^\d+]/g, "") })} />}</Field>
        <Field label="Account holder name">{(p) => <input {...p} className="field" value={payout.name} onChange={(e) => update("payout", { ...payout, name: e.target.value })} />}</Field>
      </div>
      {worker && <p className="mt-3 text-sm text-ink-soft">Changes apply to payouts queued after you save. Existing queued payouts keep their recorded destination.</p>}
    </Tile>
    {!worker && <Tile className="p-5 sm:p-7">
      <h2 className="text-xl font-bold">Identity review</h2><p className="mt-1 text-ink-soft">Your profile becomes visible after the team approves your documents.</p>
      <p className="mt-3 rounded bg-cobalt-wash p-3 text-sm">{LIVE_BACKEND ? "Your ID and portrait are stored privately for identity review. Customers cannot see these documents." : "Prototype: use sample images and a sample card number. These files are stored in this browser."}</p>
      <Field label="Ghana Card number" className="mt-5">{(p) => <input {...p} className="field figure" placeholder="GHA-123456789-0" value={card} onChange={(e) => setCard(e.target.value.toUpperCase())} />}</Field>
      <div className="mt-5 grid grid-cols-2 gap-4"><div><p className="mb-2 font-bold">Front of Ghana Card</p><PhotoPicker max={1} value={idPhotos} onChange={setIdPhotos} label="Add ID photo" /></div><div><p className="mb-2 font-bold">Your portrait</p><PhotoPicker max={1} value={selfies} onChange={setSelfies} label="Add portrait" /></div></div>
    </Tile>}
    {error && <p role="alert" className="rounded bg-kiln-wash p-4 font-bold text-kiln-deep">{error}</p>}
    <Button type="submit" size="lg" busy={saving} className="self-start">{worker ? "Save profile" : "Submit for verification"}</Button>
  </form>;
}
