import { Link } from "react-router";
import { ArrowUpRight, BadgeCheck, MapPin, Star } from "lucide-react";
import type { Worker } from "../data/types";
import { SERVICES } from "../config";
import { SERVICE_PHOTOS } from "../data/serviceData";
import { priceFrom } from "../lib/pricing";
import { Avatar, FavoriteButton } from "./ui";

export function ProCard({ worker, rating, reviews }: { worker: Worker; rating: number | null; reviews: number }) {
  const service = worker.services[0];
  const photo = worker.portfolio[0]?.src || SERVICE_PHOTOS[worker.portfolio[0]?.id] || SERVICE_PHOTOS[`svc-${service}`];
  return (
    <article className="pro-card">
      <div className="pro-card-photo">
        <img src={photo} alt={`${SERVICES[service].label} portfolio from ${worker.name}`} loading="lazy" decoding="async" />
        <span className="pro-card-verified"><BadgeCheck size={14} aria-hidden /> Verified pro</span>
        <div className="pro-card-favorite"><FavoriteButton id={worker.id} size="md" /></div>
      </div>
      <div className="pro-card-body">
        <div className="pro-card-meta"><span>{SERVICES[service].label}</span><span className="pro-card-rating"><Star size={13} aria-hidden />{rating === null ? "New pro" : <>{rating.toFixed(1)} <span>({reviews})</span></>}</span></div>
        <div className="pro-card-person"><Avatar name={worker.name} id={worker.id} size="sm" /><div><h3><Link to={`/workers/${worker.id}`}>{worker.name}</Link></h3><p><MapPin size={12} aria-hidden />{worker.baseArea}</p></div></div>
        <p className="pro-card-bio">{worker.bio}</p>
        <div className="pro-card-bottom"><p><span>Starting from</span><strong>{priceFrom(worker)}</strong><small className="pro-price-unit"> {worker.pricing.unit}</small></p><Link to={`/workers/${worker.id}`} aria-label={`View ${worker.name}'s profile`} className="pro-card-link"><ArrowUpRight size={20} aria-hidden /></Link></div>
      </div>
    </article>
  );
}
