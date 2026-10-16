import { useState } from "react";
import { SERVICES } from "../../config";
import { reviewVerification, useDb } from "../../data/store";
import { Avatar, Button, ChoiceChip, DefinitionRow, Dialog, EmptyState, Field, PageHeader, Tile } from "../../components/ui";
import { useAction } from "../../components/Toast";
import { dateTime, phone } from "../../lib/format";
import { useTitle } from "../../lib/hooks";
import { useReveal } from "../../lib/motion";

export function AdminVerifications() {
  useTitle("Worker verification · Siesie");
  const workers = useDb((d) => d.workers);
  const [filter, setFilter] = useState("pending");
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [checked, setChecked] = useState(false);
  const run = useAction();
  const worker = workers.find((w) => w.id === selected);
  const list = workers.filter((w) => w.verification === filter);
  const listRef = useReveal<HTMLDivElement>([filter, list.length]);
  async function decide(approve: boolean) {
    if (!worker) return;
    if (await run(() => reviewVerification(worker.id, approve, note), approve ? "Worker verified. Their profile is now visible." : "Application returned with your feedback.")) setSelected(null);
  }
  return <div ref={listRef}>
    <PageHeader title="Worker verification" lead="Review identity documents and check they match the applicant before allowing customer bookings." />
    <div className="mb-6 flex flex-wrap gap-2">{["pending", "verified", "rejected"].map((f) => <ChoiceChip key={f} type="radio" name="verification" checked={filter === f} onChange={() => setFilter(f)}>{f.charAt(0).toUpperCase() + f.slice(1)} · {workers.filter((w) => w.verification === f).length}</ChoiceChip>)}</div>
    {!list.length ? <EmptyState title={`No ${filter} applications.`} body="New worker submissions appear in the pending queue." /> : <div className="grid gap-4 xl:grid-cols-2">{list.map((w, i) => <Tile key={w.id} data-reveal="pop" style={{ ["--i" as string]: Math.min(i, 8) }} className="flex flex-col p-5"><div className="flex items-start gap-3"><Avatar name={w.name} id={w.id} size="lg" /><div className="min-w-0"><h2 className="display-narrow text-lg">{w.name}</h2><p className="text-sm text-ink-soft">{w.services.map((s) => SERVICES[s].label).join(" · ")}</p><p className="text-sm text-ink-soft">{w.baseArea} · {w.yearsExperience} years of experience</p></div></div><p className="mt-4 line-clamp-2 text-ink-mid">{w.bio}</p>{w.verificationNote && <p className="mt-3 rounded-xl bg-grout p-3 text-sm text-ink-mid">Review note: {w.verificationNote}</p>}<Button className="mt-5 self-start" variant="secondary" onClick={() => { setSelected(w.id); setNote(""); setChecked(false); }}>{filter === "pending" ? "Review application" : "View application"}</Button></Tile>)}</div>}
    <Dialog open={!!worker} onClose={() => setSelected(null)} title={worker ? `Verify ${worker.name}` : "Application"} wide>
      {worker && <>
        <dl className="divide-y divide-grout"><DefinitionRow term="Phone">{phone(worker.phone)}</DefinitionRow><DefinitionRow term="Ghana Card">{worker.ghanaCard?.number ?? "Not provided"}</DefinitionRow><DefinitionRow term="Submitted">{worker.ghanaCard ? dateTime(worker.ghanaCard.submittedAt) : "Not submitted"}</DefinitionRow></dl>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">{[["Ghana Card front", worker.ghanaCard?.frontPhoto], ["Applicant portrait", worker.ghanaCard?.selfie]].map(([title, src]) => <div key={title}><h3 className="mb-2 text-sm font-bold text-ink">{title}</h3>{src ? <a href={src} target="_blank" rel="noreferrer" aria-label={`Open ${title} in a new tab`} className="press block overflow-hidden rounded-[var(--radius-tile)] border border-grout-deep"><img src={src} alt={title} className="max-h-64 w-full bg-tile-dim object-contain" /></a> : <p className="rounded-[var(--radius-tile)] border border-dashed border-grout-deep p-5 text-sm text-ink-soft">No image attached to this sample record.</p>}</div>)}</div>
        {worker.verification === "pending" && <div className="mt-5 flex flex-col gap-4">
          <p className="text-sm text-ink-soft">Sample applicants may have no document images. Request a resubmission when evidence is missing.</p>
          <Field label="Review note" hint="Required for rejection. Tell the worker exactly what to correct.">{(p) => <textarea {...p} className="field" value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} />}</Field>
          <label className="press flex items-start gap-3 rounded-xl bg-grout p-3 text-sm"><input type="checkbox" className="mt-0.5 size-4.5 accent-[var(--color-cobalt-bright)]" checked={checked} onChange={(e) => setChecked(e.target.checked)} /><span>I reviewed the submitted documents and the identity matches.</span></label>
          <div className="flex flex-wrap gap-2"><Button disabled={!checked || !worker.ghanaCard?.frontPhoto || !worker.ghanaCard?.selfie} onClick={() => decide(true)}>Approve worker</Button><Button variant="danger" disabled={note.trim().length < 10} onClick={() => decide(false)}>Request corrections</Button></div>
        </div>}
        {worker.verification !== "pending" && <p className="mt-5">Status: <strong>{worker.verification}</strong>. {worker.verificationNote}</p>}
      </>}
    </Dialog>
  </div>;
}
