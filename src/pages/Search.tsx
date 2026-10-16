import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { MapPin, Search as SearchIcon, SlidersHorizontal, X } from "lucide-react";
import type { ServiceId } from "../data/types";
import { AREAS, BRAND, SERVICES, SERVICE_IDS } from "../config";
import { useDb, workerStats } from "../data/store";
import { Button, Dialog, EmptyState, FilterChip } from "../components/ui";
import { ProCard } from "../components/ProCard";
import { useTitle } from "../lib/hooks";
import { ServiceRail } from "../components/ServiceRail";

const SORTS = [{ id: "rating", label: "Top rated" }, { id: "price", label: "Lowest price" }, { id: "experience", label: "Most experience" }];

export function Search() {
  const [params, setParams] = useSearchParams();
  const requestedService = params.get("service") as ServiceId | null;
  const service = requestedService && SERVICE_IDS.includes(requestedService) ? requestedService : null;
  const area = params.get("area") ?? "";
  const query = params.get("q") ?? "";
  const sort = SORTS.some(s => s.id === params.get("sort")) ? params.get("sort")! : "rating";
  const [searchInput, setSearchInput] = useState(query);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  useEffect(() => setSearchInput(query), [query]);
  useTitle(`${service ? SERVICES[service].label : "Find a professional"}${area ? ` in ${area}` : ""} · ${BRAND.name}`);
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };
  const resetAll = () => { setSearchInput(""); setParams(new URLSearchParams(), { replace: true }); };
  const results = useDb(d => {
    const list = d.workers.filter(w => w.verification === "verified")
      .filter(w => !service || w.services.includes(service))
      .filter(w => !area || w.areas.includes(area))
      .filter(w => {
        const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const searchable = [w.name, w.bio, ...w.services.map(s => SERVICES[s].label), ...w.areas].join(" ").toLowerCase();
        return words.every(word => searchable.includes(word));
      }).map(w => ({ w, stats: workerStats(d, w.id) }));
    if (sort === "price") list.sort((a, b) => a.w.pricing.from - b.w.pricing.from);
    else if (sort === "experience") list.sort((a, b) => b.w.yearsExperience - a.w.yearsExperience);
    else list.sort((a, b) => (b.stats.rating ?? 0) - (a.stats.rating ?? 0) || b.stats.reviews - a.stats.reviews);
    return list;
  });
  const activeFilterCount = Number(Boolean(area)) + Number(Boolean(query)) + Number(Boolean(service));
  return (
    <div className="discovery-page">
      <div className="discovery-heading"><div><p className="market-eyebrow">LOCAL EXPERTISE. PERSONAL CARE.</p><h1>{service ? `${SERVICES[service].label}, taken care of.` : "Find your helping hand."}</h1><p>{area ? `Meet verified professionals serving ${area}.` : "Skilled professionals for the place you call home. Compare, choose, and book with confidence."}</p></div></div>
      <div className="discovery-controls">
        <form role="search" className="discovery-search" onSubmit={e => { e.preventDefault(); setParam("q", searchInput.trim() || null); }}>
          <SearchIcon size={19} aria-hidden /><label htmlFor="search-input" className="sr-only">Search artisans, skills or locations</label><input id="search-input" type="search" value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search a service or professional" />
          {searchInput && <button type="button" aria-label="Clear search" onClick={() => { setSearchInput(""); setParam("q", null); }}><X size={17} aria-hidden /></button>}
          <button type="submit" className="search-submit">Search</button>
        </form>
        <button className="discovery-filter-button" onClick={() => setFilterModalOpen(true)} aria-label={`Filters${activeFilterCount ? `, ${activeFilterCount} active` : ""}`}><SlidersHorizontal size={18} aria-hidden /><span>Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</span></button>
      </div>
      <ServiceRail />
      {(area || query) && <div className="flex flex-wrap items-center gap-2 text-xs">{area && <button className="inline-flex min-h-10 items-center gap-2 rounded-full bg-grout px-3" onClick={() => setParam("area", null)} aria-label={`Remove area filter ${area}`}><MapPin size={13} aria-hidden />{area}<X size={13} aria-hidden /></button>}{query && <button className="inline-flex min-h-10 items-center gap-2 rounded-full bg-grout px-3" onClick={() => setParam("q", null)} aria-label={`Remove search term ${query}`}>{query}<X size={13} aria-hidden /></button>}</div>}
      <section aria-label="Professional search results"><div className="discovery-results-bar"><h2 aria-live="polite">{results.length} {results.length === 1 ? "professional" : "professionals"} found</h2><label htmlFor="sort-results">Sort by<select id="sort-results" value={sort} onChange={e => setParam("sort", e.target.value)}>{SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label></div>
        {results.length ? <div className="pro-grid">{results.map(({ w, stats }) => <ProCard key={w.id} worker={w} rating={stats.rating} reviews={stats.reviews} />)}</div> : <EmptyState title="No professionals match your search." body="Try a different service or neighbourhood, or clear your filters to meet everyone." action={<Button onClick={resetAll}>Reset all filters</Button>} />}
      </section>
      <Dialog open={filterModalOpen} onClose={() => setFilterModalOpen(false)} title="Filter and sort"><div className="flex flex-col gap-5 pt-2"><div><label htmlFor="filter-area" className="eyebrow mb-2 block text-ink-faint">Neighbourhood or city</label><select id="filter-area" className="field" value={area} onChange={e => setParam("area", e.target.value || null)}><option value="">All areas (Accra, Tema and Kumasi)</option>{AREAS.map(a => <option key={a} value={a}>{a}</option>)}</select></div><fieldset><legend className="eyebrow mb-2 block text-ink-faint">Sort results by</legend><div className="flex flex-wrap gap-2">{SORTS.map(s => <FilterChip key={s.id} active={sort === s.id} onClick={() => setParam("sort", s.id)}>{s.label}</FilterChip>)}</div></fieldset><div className="flex gap-2"><Button variant="secondary" onClick={resetAll}>Reset all filters</Button><Button onClick={() => setFilterModalOpen(false)}>Show {results.length} results</Button></div></div></Dialog>
    </div>
  );
}
