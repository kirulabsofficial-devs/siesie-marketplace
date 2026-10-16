import { useEffect, useRef } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { Droplets, Grid2X2, Hammer, House, Plug, SprayCan, Wrench, type LucideIcon } from "lucide-react";
import type { ServiceId } from "../data/types";

export const SERVICE_ICONS: Record<ServiceId, LucideIcon> = { cleaning: SprayCan, tiling: Grid2X2, maintenance: Wrench };
const categories: { label: string; service?: ServiceId; query?: string; icon: LucideIcon }[] = [
  { label: "All services", icon: House },
  { label: "Cleaners", service: "cleaning", icon: SprayCan },
  { label: "Handymen", service: "maintenance", icon: Wrench },
  { label: "Plumbers", service: "maintenance", query: "plumbing", icon: Droplets },
  { label: "Electrical pros", service: "maintenance", query: "electri", icon: Plug },
  { label: "Tilers", service: "tiling", icon: Grid2X2 },
  { label: "Carpenters", service: "maintenance", query: "carpentry", icon: Hammer },
];

/** A shared, keyboard-accessible service selector. Every item opens a real filtered search. */
export function ServiceRail({ showAll = true }: { showAll?: boolean }) {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const rail = useRef<HTMLElement>(null);
  const service = params.get("service") || undefined;
  const query = params.get("q") || undefined;
  useEffect(() => {
    const selected = rail.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (selected && rail.current) rail.current.scrollLeft = Math.max(0, selected.offsetLeft - rail.current.offsetLeft - (rail.current.clientWidth - selected.clientWidth) / 2);
  }, [service, query]);
  return <nav ref={rail} className="service-rail" aria-label="Browse services">
    {categories.filter((c) => showAll || c.service).map(({ label, service: value, query: term, icon: Icon }) => {
      const selected = pathname === "/search" && service === value && query === term;
      const next = new URLSearchParams(params);
      if (value) next.set("service", value); else next.delete("service");
      if (term) next.set("q", term); else next.delete("q");
      return <Link key={label} to={`/search${next.size ? `?${next}` : ""}`} aria-current={selected ? "page" : undefined} className="service-rail-link">
        <Icon size={27} strokeWidth={1.35} aria-hidden /><span>{label}</span>
      </Link>;
    })}
  </nav>;
}

export function ServiceIcon({ service, size = 18 }: { service: ServiceId; size?: number }) {
  const Icon = SERVICE_ICONS[service];
  return <Icon size={size} strokeWidth={1.5} className="service-icon" aria-hidden />;
}
