import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, ArrowUpRight, BadgeCheck, Check, ChevronDown, Grid2X2, Hammer, LockKeyhole, MapPin, PlugZap, Search, ShieldCheck, ShowerHead, SprayCan, Wallet, Wrench } from "lucide-react";
import { AREAS, BRAND, SERVICES, SERVICE_IDS } from "../config";
import type { EscrowState, ServiceId } from "../data/types";
import { useDb, workerStats } from "../data/store";
import { SERVICE_PHOTOS } from "../data/serviceData";
import { Button, FilterChip, LinkButton } from "../components/ui";
import { ProCard } from "../components/ProCard";
import { MoneyTrack } from "../components/MoneyTrack";
import { KenteBand } from "../components/Kente";
import { BrandMark } from "../components/Brand";
import { useTitle } from "../lib/hooks";
import { ServiceIcon } from "../components/ServiceRail";
import { LIVE_BACKEND } from "../data/runtime";

const CATEGORIES = [
  { label: "Home cleaning", detail: "A fresh start", service: "cleaning", icon: SprayCan },
  { label: "Tiling", detail: "Beautiful finishes", service: "tiling", icon: Grid2X2 },
  { label: "Plumbing", detail: "Every drop sorted", service: "maintenance", query: "plumbing", icon: ShowerHead },
  { label: "Electrical", detail: "Keep things running", service: "maintenance", query: "electri", icon: PlugZap },
  { label: "Carpentry", detail: "Made to work", service: "maintenance", query: "carpentry", icon: Hammer },
  { label: "Home repairs", detail: "The little fixes", service: "maintenance", icon: Wrench },
];

export function Landing() {
  useTitle(`${BRAND.name} · Your home. Sorted.`);
  return (
    <div className="marketplace-home">
      <HomeHero />
      <TrustBenefits />
      <section className="market-section service-categories" id="services">
        <div className="market-heading"><div><p className="market-eyebrow">A LITTLE HELP GOES A LONG WAY</p><h2>One home. Every service.</h2></div><Link className="market-text-link" to="/search">View all <ArrowUpRight size={18} aria-hidden /></Link></div>
        <div className="category-grid">{CATEGORIES.map(({ label, detail, service, query, icon: Icon }) => <Link key={label} className="category-tile" to={`/search?service=${service}${query ? `&q=${query}` : ""}`}><span className="category-icon"><Icon size={27} strokeWidth={1.5} aria-hidden /></span><h3>{label}</h3><p>{detail}</p><ArrowUpRight className="category-arrow" size={16} aria-hidden /></Link>)}</div>
      </section>
      <PopularServices />
      <FeaturedPros />
      <HowItWorks />
      {!LIVE_BACKEND && <PaymentProtection />}
      <section className="market-section worker-invite">
        <div className="worker-invite-photo"><img src={SERVICE_PHOTOS["svc-maintenance"]} alt="A tradesperson working on a home electrical installation" loading="lazy" /><KenteBand className="worker-kente" /></div>
        <div className="worker-invite-copy"><p className="market-eyebrow">GOOD WORK DESERVES TO BE FOUND</p><h2>Your craft.<br />Your next opportunity.</h2><p>{LIVE_BACKEND ? "Bring your skills to homes across Ghana. Build your profile, connect with customers, and send quotes for your next job." : "Bring your skills to homes across Ghana. Build your profile, connect with customers, and see that payment is secured before work begins."}</p><LinkButton to="/join">Become a Siesie pro <ArrowUpRight size={17} aria-hidden /></LinkButton><Link to="/login?as=worker" className="worker-signin">Already a pro? Sign in <ArrowRight size={14} aria-hidden /></Link></div>
      </section>
      <Faq />
    </div>
  );
}

function HomeHero() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("");
  const search = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (area) params.set("area", area);
    navigate(`/search${params.size ? `?${params}` : ""}`);
  };
  return (
    <section className="home-hero market-section" aria-label="Find help for your home">
      <div className="hero-search-row">
        <p className="home-greeting">A little help.<br /><strong>A lot more living.</strong></p>
        <form className="home-search" onSubmit={search} role="search">
          <label className="home-search-service" htmlFor="home-service"><Search size={21} aria-hidden /><span><span className="search-label">What does your home need?</span><input id="home-service" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search cleaning, tiling, repairs…" /></span></label>
          <div className="home-search-bottom"><label className="home-search-area" htmlFor="home-area"><MapPin size={18} aria-hidden /><select id="home-area" aria-label="Service location" value={area} onChange={e => setArea(e.target.value)}><option value="">Choose your area</option>{AREAS.map(a => <option key={a} value={a}>{a}</option>)}</select><ChevronDown size={14} aria-hidden /></label><button type="submit">Find a pro <ArrowRight size={17} aria-hidden /></button></div>
        </form>
      </div>
      <div className="hero-stage on-cobalt">
        <div className="hero-copy">
          <p className="market-eyebrow hero-eyebrow"><span /> LOCAL HANDS. GOOD WORK.</p>
          <h1>Your home.<br /><span>Sorted.</span></h1>
          <p className="hero-intro">Trusted local pros for the little fixes and the big plans.</p>
          <Link to="/search" className="hero-cta">Find your pro <ArrowUpRight size={19} aria-hidden /></Link>
          <p className="hero-local"><span className="ghana-flag" aria-hidden /><span>Made for homes in Ghana.</span></p>
        </div>
        <div className="hero-visual">
          <BrandMark onCobalt className="hero-brand-watermark" />
          <div className="hero-photo-frame"><img className="hero-home-photo" src={SERVICE_PHOTOS.p3.replace("w=800", "w=1200")} alt="A beautifully finished home with a garden and spacious terrace" width={640} height={720} fetchPriority="high" /></div>
          <div className="hero-detail-photo"><img src={SERVICE_PHOTOS["svc-cleaning"]} alt="A professional adding the finishing touches to a clean home" width={240} height={260} /><span><Check size={12} aria-hidden /> The details matter.</span></div>
          <Link to={LIVE_BACKEND ? "/#how-it-works" : "/#how-payment-works"} className="hero-assurance"><span className="hero-assurance-icon"><ShieldCheck size={22} strokeWidth={1.6} aria-hidden /></span><span><strong>Good hands. Great care.</strong><small>{LIVE_BACKEND ? "Verified pros. Clear quotes." : "Verified pros. Protected payments."}</small></span><ArrowUpRight size={18} aria-hidden /></Link>
          <span className="hero-photo-label"><BadgeCheck size={15} aria-hidden /> THE SIESIE STANDARD</span>
        </div>
        <div className="hero-bottom-line"><span>ACCRA · TEMA · KUMASI</span><span>SMALL FIXES. BIG DIFFERENCE. <ArrowUpRight size={13} aria-hidden /></span></div>
      </div>
      <div className="hero-popular"><span>Popular right now</span><Link to="/search?service=cleaning">Deep cleaning <ArrowUpRight size={12} aria-hidden /></Link><Link to="/search?service=tiling">Bathroom tiling <ArrowUpRight size={12} aria-hidden /></Link><Link to="/search?service=maintenance&q=plumbing">Plumbing <ArrowUpRight size={12} aria-hidden /></Link></div>
    </section>
  );
}

function TrustBenefits() {
  return <section className="trust-benefits" aria-label="The Siesie promise"><div className="market-section">{[
    { icon: BadgeCheck, title: "Verified people", text: "Ghana Card checked" },
    { icon: Wallet, title: "Upfront prices", text: "Agree before you pay" },
    LIVE_BACKEND ? { icon: ShieldCheck, title: "Stay connected", text: "Keep your messages together" } : { icon: ShieldCheck, title: "Protected payments", text: "Check the work first" },
  ].map(({ icon: Icon, title, text }) => <div key={title}><Icon size={26} strokeWidth={1.5} aria-hidden /><span><strong>{title}</strong><small>{text}</small></span></div>)}</div></section>;
}

function PopularServices() {
  return <section className="market-section popular-services"><div className="market-heading"><div><p className="market-eyebrow">MAKE ROOM FOR BETTER</p><h2>Little upgrades. Big smiles.</h2></div><Link className="market-text-link" to="/search">Explore services <ArrowUpRight size={18} aria-hidden /></Link></div><div className="popular-service-grid">{[
    { service: "cleaning", label: "A fresh start.", detail: "HOME CLEANING", photo: "svc-cleaning", alt: "A professional cleaning a bright living room" },
    { service: "tiling", label: "A finer finish.", detail: "TILING & FINISHES", photo: "svc-tiling", alt: "A bathroom finished with carefully laid tiles" },
    { service: "maintenance", label: "Back to brilliant.", detail: "REPAIRS & MAINTENANCE", photo: "svc-maintenance", alt: "A tradesperson repairing a home electrical installation" },
  ].map(s => <Link className="popular-service-card" key={s.service} to={`/search?service=${s.service}`}><div className="popular-service-photo"><img src={SERVICE_PHOTOS[s.photo]} alt={s.alt} loading="lazy" /><span><ArrowUpRight size={20} aria-hidden /></span></div><div className="popular-service-copy"><p>{s.detail}</p><h3>{s.label}</h3></div></Link>)}</div></section>;
}

function FeaturedPros() {
  const [filter, setFilter] = useState<ServiceId | "all">("all");
  const workers = useDb(d => d.workers.filter(w => w.verification === "verified").map(w => ({ w, stats: workerStats(d, w.id) })).sort((a, b) => (b.stats.rating ?? 0) - (a.stats.rating ?? 0) || b.stats.reviews - a.stats.reviews));
  const filtered = workers.filter(({ w }) => filter === "all" || w.services.includes(filter)).slice(0, 4);
  return <section className="featured-section"><div className="market-section"><div className="market-heading"><div><p className="market-eyebrow">MEET YOUR NEXT HELPING HAND</p><h2>Good people. Great work.</h2><p>Get to know the professionals behind a job well done.</p></div><Link className="market-text-link" to="/search">Meet all professionals <ArrowUpRight size={18} aria-hidden /></Link></div><div className="pro-filters" aria-label="Filter professionals by service"><FilterChip active={filter === "all"} onClick={() => setFilter("all")}>All services</FilterChip>{SERVICE_IDS.map(s => <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}><ServiceIcon service={s} size={15} />{SERVICES[s].label}</FilterChip>)}</div><div className="pro-grid" aria-live="polite">{filtered.map(({ w, stats }) => <ProCard key={w.id} worker={w} rating={stats.rating} reviews={stats.reviews} />)}{!filtered.length && <p>No verified professionals in this service yet. Try another category.</p>}</div>{!LIVE_BACKEND && <p className="sample-note">Explore sample professional profiles in this prototype.</p>}</div></section>;
}

function HowItWorks() {
  return <section className="market-section how-section" id="how-it-works"><div className="market-heading"><div><p className="market-eyebrow">LESS ORGANISING. MORE LIVING.</p><h2>A better home, in three steps.</h2></div><p className="section-side-note">From “someone should fix that”<br />to one less thing on your list.</p></div><div className="how-grid">{[
    { title: "Find your person", text: "Explore services, compare profiles and read customer reviews. Choose a pro who fits your home." },
    { title: "Make a plan", text: LIVE_BACKEND ? "Tell them what you need, choose a date and request a quote. Keep the details together in your booking." : "Tell them what you need, choose a date and agree on a quote. Secure your booking with MoMo or card." },
    LIVE_BACKEND ? { title: "Stay in touch", text: "Message your professional, ask questions and review their quote before taking the next step." } : { title: "Enjoy the result", text: "Your pro gets to work. Check the finished job, then confirm so their payout can be processed." },
  ].map((step, i) => <div key={step.title}><span className="step-number">0{i + 1}</span><h3>{step.title}</h3><p>{step.text}</p></div>)}</div></section>;
}

type PaymentStep = "unpaid" | "working" | "check" | "released" | "disputed" | "settled";
const DEMO: Record<PaymentStep, { state: EscrowState; title: string; copy: string }> = {
  unpaid: { state: "unpaid", title: "A price you both agree on", copy: "Kwame quoted GH₵ 1,850 for bathroom tiling. Nothing has been paid yet." },
  working: { state: "held", title: "Secured while work happens", copy: "Your payment is held safely. Kwame can see that the funds are secured before starting." },
  check: { state: "held", title: "Your turn to check the work", copy: "The job is complete. Inspect the result and confirm, or report an issue within the inspection window." },
  released: { state: "released", title: "Great work. Payment released.", copy: "After confirmation and payout processing, the money goes to your professional." },
  disputed: { state: "disputed", title: "An issue? Payment stays put.", copy: "The funds remain frozen while the issue is reviewed and a resolution is agreed." },
  settled: { state: "split", title: "A fair resolution", copy: "In this example, GH₵ 370 returns to you and the remaining amount covers the work and platform fee." },
};

function PaymentProtection() {
  const [step, setStep] = useState<PaymentStep>("unpaid");
  const hours = useDb(d => d.settings.confirmWindowHours);
  const demo = DEMO[step];
  const actions: Record<PaymentStep, { label: string; to: PaymentStep; variant?: "primary" | "secondary" | "danger" }[]> = {
    unpaid: [{ label: "Try a demo payment", to: "working" }], working: [{ label: "Kwame finishes work", to: "check" }], check: [{ label: "Job looks good", to: "released" }, { label: "Report issue", to: "disputed", variant: "danger" }], released: [{ label: "Start over", to: "unpaid", variant: "secondary" }], disputed: [{ label: "Review resolution", to: "settled", variant: "secondary" }], settled: [{ label: "Start over", to: "unpaid", variant: "secondary" }],
  };
  return <section className="market-section protection-section" id="how-payment-works"><div className="protection-panel"><div className="protection-copy"><p className="market-eyebrow"><LockKeyhole size={15} aria-hidden /> SIESIE PAYMENT PROTECTION</p><h2>A job well done.<br />Then, a payment <br />well earned.</h2><p>Book with confidence. Your payment is held while the work happens, giving you time to check the result before your pro is paid.</p><ul><li><Check size={17} aria-hidden /> Pay with Mobile Money or card</li><li><Check size={17} aria-hidden /> {hours} hours to inspect completed work</li><li><Check size={17} aria-hidden /> Dispute support if something isn't right</li></ul><small>Uncontested payments are queued for payout after the inspection window.</small></div><div className="protection-demo"><div className="demo-heading"><span><ShieldCheck size={17} aria-hidden /> Your payment journey</span><small>INTERACTIVE DEMO</small></div><div className="demo-job"><span>BATHROOM RETILING</span><strong>Kwame Asante</strong><p>East Legon · Agreed quote: GH₵ 1,850</p></div><MoneyTrack state={demo.state} amount={1850} workerName="Kwame" size="md" split={step === "settled" ? { toWorker: 1480, toCustomer: 370 } : undefined} /><div className="demo-explanation" aria-live="polite"><h3>{demo.title}</h3><p>{demo.copy}</p></div><div className="demo-actions">{actions[step].map(a => <Button key={a.label} size="sm" variant={a.variant ?? "primary"} onClick={() => setStep(a.to)}>{a.label}</Button>)}</div><p className="demo-footnote"><LockKeyhole size={12} aria-hidden /> Just a walkthrough. No money moves.</p></div></div></section>;
}

function Faq() {
  const hours = useDb(d => d.settings.confirmWindowHours);
  const questions = [
    { question: "Where can I book a service?", answer: "Siesie connects you with professionals across Accra, Tema and Kumasi. Choose your neighbourhood in search to see professionals who serve your area." },
    { question: "How do I choose the right professional?", answer: "Compare each professional's work, service packages, experience and customer reviews. Verified profiles have completed the Ghana Card identity check. Send a booking request to agree on the scope and final quote." },
    LIVE_BACKEND ? { question: "Can I pay through Siesie?", answer: "Payments are not available yet. You can create an account, request a booking, receive a quote and message your professional." } : { question: "When is my professional paid?", answer: `Your payment is held while work is in progress. After completion, you have ${hours} hours to inspect it. Confirmation, or the end of the window without a dispute, queues the payout for processing.` },
    LIVE_BACKEND ? { question: "How do I discuss my booking?", answer: "Open Messages to talk with your professional. Your booking keeps the scope, proposed date and quote together." } : { question: "What if something isn't right?", answer: "Report the issue from your booking during the inspection window and include photos if you can. The payment is frozen while the dispute is reviewed." },
  ];
  return <section className="market-section faq-section"><div><p className="market-eyebrow">A FEW THINGS TO KNOW</p><h2>Make yourself <br />at home.</h2><p>Helpful answers before<br />your first booking.</p></div><div className="faq-list">{questions.map(q => <details key={q.question}><summary>{q.question}<ChevronDown size={18} aria-hidden /></summary><p>{q.answer}</p></details>)}</div></section>;
}
