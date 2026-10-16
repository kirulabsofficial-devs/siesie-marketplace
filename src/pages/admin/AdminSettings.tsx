import { useState } from "react";
import { Info } from "lucide-react";
import { useDb, updateSettings } from "../../data/store";
import { Button, DefinitionRow, Field, PageHeader, Tile } from "../../components/ui";
import { useAction } from "../../components/Toast";
import { commissionOn, money } from "../../lib/format";
import { useTitle } from "../../lib/hooks";

export function AdminSettings() {
  useTitle("Commission and rules · Siesie");
  const settings = useDb((d) => d.settings);
  const [pct, setPct] = useState(String(settings.commissionPct));
  const [hours, setHours] = useState(String(settings.confirmWindowHours));
  const run = useAction();
  const valid = pct.trim() !== "" && hours.trim() !== "" && Number.isFinite(Number(pct)) && Number(pct) >= 0 && Number(pct) <= 30 && Number.isInteger(Number(hours)) && Number(hours) >= 24 && Number(hours) <= 168;
  const example = commissionOn(1000, valid ? Number(pct) : settings.commissionPct);
  return <div>
    <PageHeader title="Commission and rules" lead="Set the fee for new quotes and the time customers have to inspect newly completed work." />
    <div className="grid max-w-4xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:items-start">
      <Tile className="min-w-0 p-5 sm:p-7"><form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); if (valid) run(() => updateSettings({ commissionPct: Number(pct), confirmWindowHours: Number(hours) }), "Commission and rules saved."); }}>
        <Field label="Platform commission (%)" hint="0–30%. Applied to the worker's allocation of the job payment.">{(p) => <input {...p} type="number" className="field figure" min="0" max="30" step="0.1" required value={pct} onChange={(e) => setPct(e.target.value)} />}</Field>
        <Field label="Inspection window (hours)" hint="24–168 hours. A dispute freezes payment until an admin resolves it.">{(p) => <input {...p} type="number" className="field figure" min="24" max="168" step="1" required value={hours} onChange={(e) => setHours(e.target.value)} />}</Field>
        <p className="flex items-start gap-2.5 rounded-[var(--radius-tile)] border border-cobalt-edge bg-cobalt-wash p-4 text-sm text-ink-mid"><Info className="mt-0.5 size-4 shrink-0 text-cobalt-bright" aria-hidden />Existing quotes keep their agreed commission. Inspection deadlines already running keep their original end time. Payouts still require manual admin release.</p>
        <Button type="submit" className="self-start" disabled={!valid}>Save rules</Button>
      </form></Tile>
      {/* Recomputes as you type, so the fee change is visible before saving. */}
      <Tile className="min-w-0 p-5 lg:sticky lg:top-24"><h2 className="display-narrow text-lg">Example payment</h2><dl className="mt-3 divide-y divide-grout"><DefinitionRow term="Customer pays">{money(1000)}</DefinitionRow><DefinitionRow term="Platform fee">{money(example.commission)}</DefinitionRow><DefinitionRow term="Worker receives">{money(example.net)}</DefinitionRow></dl></Tile>
    </div>
  </div>;
}
