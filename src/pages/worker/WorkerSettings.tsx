import { useState } from "react";
import type { Photo } from "../../data/types";
import { useDb, findWorker, updateWorker, addPortfolioPhoto, resubmitVerification } from "../../data/store";
import { WorkerProfileForm } from "../../components/WorkerProfileForm";
import { Button, Field, Gallery, LinkButton, PageHeader, Tile } from "../../components/ui";
import { PhotoPicker } from "../../components/PhotoPicker";
import { useAction } from "../../components/Toast";
import { useTitle } from "../../lib/hooks";
import { NotFound } from "../NotFound";
import { LIVE_BACKEND } from "../../data/runtime";

export function WorkerSettings() {
  useTitle("Your profile · Siesie");
  const worker = useDb((d) => findWorker(d, d.session!.userId));
  const run = useAction();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [front, setFront] = useState<Photo[]>([]);
  const [selfie, setSelfie] = useState<Photo[]>([]);
  const [card, setCard] = useState(worker?.ghanaCard?.number ?? "");
  if (!worker) return <NotFound />;
  return <>
    <PageHeader title="Your profile" lead={`Verification: ${worker.verification.replace("_", " ")}. Keep your services, areas and payout details up to date.`} actions={worker.verification === "verified" && <LinkButton variant="secondary" to={`/workers/${worker.id}`}>View public profile</LinkButton>} />
    <div className="max-w-3xl">
      {(worker.verification === "rejected" || worker.verification === "not_submitted") && <Tile className="mb-6 p-5 ring-2 ring-kiln/30"><h2 className="font-bold">Update your verification</h2><p className="mt-2">{worker.verificationNote ?? "Submit your identity details for review."}</p><form className="mt-4 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); run(() => resubmitVerification(worker.id, card, { frontPhoto: front[0]?.src ?? worker.ghanaCard?.frontPhoto, selfie: selfie[0]?.src ?? worker.ghanaCard?.selfie }), "Verification resubmitted."); }}>
        <Field label="Ghana Card number">{(p) => <input {...p} className="field figure" value={card} onChange={(e) => setCard(e.target.value.toUpperCase())} />}</Field>
        <p className="text-sm text-ink-soft">{LIVE_BACKEND ? "These images are private and used for identity review." : "Use sample images in this prototype."} New photos replace the previous submission.</p><div className="flex gap-5"><PhotoPicker value={front} onChange={setFront} max={1} label="Replace ID" /><PhotoPicker value={selfie} onChange={setSelfie} max={1} label="New portrait" /></div><Button type="submit" className="self-start">Resubmit documents</Button>
      </form></Tile>}
      <WorkerProfileForm worker={worker} onSave={(v) => run(() => updateWorker(worker.id, { services: v.services, baseArea: v.baseArea, areas: v.areas, bio: v.bio, pricing: v.pricing, availability: v.availability, payout: v.payout }), "Profile saved.")} />
      <Tile className="mt-8 p-5 sm:p-7"><h2 className="text-xl font-bold">Photos of your work</h2><Gallery photos={worker.portfolio} className="mt-4" /><div className="mt-5"><PhotoPicker value={photos} onChange={setPhotos} max={6} /></div><Button className="mt-4" disabled={!photos.length} onClick={async () => { if (await run(async () => { for (const p of photos) await addPortfolioPhoto(worker.id, p); }, "Portfolio updated.")) setPhotos([]); }}>Add to portfolio</Button></Tile>
    </div>
  </>;
}
