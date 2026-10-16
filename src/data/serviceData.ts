import type { ServiceId } from "./types";

export interface ServiceCategoryItem {
  id: string;
  serviceId: ServiceId;
  label: string;
  iconName: string;
  /** Flat tint plus icon colour for the category chip. */
  tint: string;
  count: number;
}

export const POPULAR_CATEGORIES: ServiceCategoryItem[] = [
  {
    id: "cleaning",
    serviceId: "cleaning",
    label: "Cleaning",
    iconName: "SprayCan",
    tint: "bg-blue-50 text-blue-700",
    count: 24,
  },
  {
    id: "tiling",
    serviceId: "tiling",
    label: "Tiling",
    iconName: "Grid2X2",
    tint: "bg-slate-100 text-slate-700",
    count: 18,
  },
  {
    id: "maintenance",
    serviceId: "maintenance",
    label: "Repairing",
    iconName: "Wrench",
    tint: "bg-indigo-50 text-indigo-700",
    count: 32,
  },
  {
    id: "painting",
    serviceId: "maintenance",
    label: "Painting",
    iconName: "PaintRoller",
    tint: "bg-violet-50 text-violet-700",
    count: 15,
  },
  {
    id: "plumbing",
    serviceId: "maintenance",
    label: "Plumbing",
    iconName: "ShowerHead",
    tint: "bg-sky-50 text-sky-700",
    count: 21,
  },
  {
    id: "electrical",
    serviceId: "maintenance",
    label: "Electrical",
    iconName: "PlugZap",
    tint: "bg-cyan-50 text-cyan-700",
    count: 19,
  },
];

export interface ServiceTier {
  id: "basic" | "standard" | "premium";
  label: string;
  priceMultiplier: number;
  badge?: string;
  summary: string;
  duration: string;
  includes: string[];
}

export const SERVICE_TIERS: Record<ServiceId, ServiceTier[]> = {
  tiling: [
    {
      id: "basic",
      label: "Basic",
      priceMultiplier: 1.0,
      summary: "Ideal for small repairs, re-grouting, or a compact splashback (up to 5 m²).",
      duration: "1 day",
      includes: [
        "Surface preparation & cleaning",
        "Tile alignment & cutting",
        "Standard anti-fungal grout application",
        "Site swept & rubbish bagged",
      ],
    },
    {
      id: "standard",
      label: "Standard",
      badge: "Popular",
      priceMultiplier: 1.6,
      summary: "Full floor or wall tiling for a standard bathroom or kitchen (up to 15 m²).",
      duration: "2–3 days",
      includes: [
        "Surface leveling & primer prep",
        "Precision laser leveling clips",
        "Water-resistant tile adhesive",
        "Silicon edge sealing",
        "48h workmanship check window",
      ],
    },
    {
      id: "premium",
      label: "Premium",
      badge: "Best Value",
      priceMultiplier: 2.4,
      summary: "Large format porcelain, full bathroom renovation or patio (up to 30 m²).",
      duration: "3–5 days",
      includes: [
        "Complete moisture barrier & waterproofing",
        "Porcelain/marble specialist precision cutting",
        "Epoxy stain-proof grout",
        "Deep scrub, buff & polish finish",
        "Extended 14-day defect warranty",
      ],
    },
  ],
  cleaning: [
    {
      id: "basic",
      label: "Basic",
      priceMultiplier: 1.0,
      summary: "Routine maintenance clean for 1–2 bedroom apartment.",
      duration: "3–4 hours",
      includes: [
        "Dusting all accessible surfaces",
        "Kitchen counters, sink & stove wipe down",
        "Bathroom sanitization & mirror polish",
        "Floor vacuum & damp mop",
      ],
    },
    {
      id: "standard",
      label: "Standard",
      badge: "Most Popular",
      priceMultiplier: 1.5,
      summary: "Deep clean for 2–3 bedroom home or move-out turnaround.",
      duration: "5–6 hours",
      includes: [
        "Everything in Basic package",
        "Kitchen oven & microwave degreasing",
        "Bathroom tile limescale & grout scrub",
        "Interior windows & baseboards wiped",
        "Eco-friendly antibacterial disinfectant",
      ],
    },
    {
      id: "premium",
      label: "Premium",
      badge: "Comprehensive",
      priceMultiplier: 2.2,
      summary: "Post-construction dust scrub, full tenancy or luxury villa deep clean.",
      duration: "Full day (team of 3)",
      includes: [
        "Industrial wet/dry vacuum extraction",
        "Sofa & upholstery steam extraction",
        "Cabinet interiors, doors & high ledges",
        "Balcony pressure wash & tile polish",
        "Complimentary air freshening treatment",
      ],
    },
  ],
  maintenance: [
    {
      id: "basic",
      label: "Basic",
      priceMultiplier: 1.0,
      summary: "Minor fixes: 1–2 plumbing leaks, faucet replacement, or socket check.",
      duration: "1–2 hours",
      includes: [
        "Diagnostic inspection",
        "Minor pipe connection or seal repair",
        "Socket / switch replacement (up to 2)",
        "Safety verification check",
      ],
    },
    {
      id: "standard",
      label: "Standard",
      badge: "Recommended",
      priceMultiplier: 1.7,
      summary: "General home repair: multiple fixtures, drain unblocking, or door lock change.",
      duration: "3–4 hours",
      includes: [
        "Multi-point diagnostic inspection",
        "Water heater, pump or valve servicing",
        "Door alignment & lock installation",
        "Minor ceiling board repair or caulking",
        "30-day repair guarantee",
      ],
    },
    {
      id: "premium",
      label: "Premium",
      badge: "Complete Care",
      priceMultiplier: 2.6,
      summary: "Full day home maintenance & overhaul for whole property.",
      duration: "Full day",
      includes: [
        "Comprehensive plumbing & electrical overhaul",
        "Pressure pump servicing & piping re-route",
        "High-voltage safety inspection",
        "Hardware lubrication & security check",
        "Priority emergency callback support",
      ],
    },
  ],
};

/** High quality curated service photography */
export const SERVICE_PHOTOS: Record<string, string> = {
  // Service hero photos
  "svc-tiling": "/photos/photo-1584622650111-993a426fbf0a.jpg",
  "svc-cleaning": "/photos/photo-1581578731548-c64695cc6952.jpg",
  "svc-maintenance": "/photos/photo-1621905251189-08b45d6a269e.jpg",

  // Worker portfolios
  p1: "/photos/photo-1584622650111-993a426fbf0a.jpg",
  p2: "/photos/photo-1507089947368-19c1da9775ae.jpg",
  p3: "/photos/photo-1600585154340-be6161a56a0c.jpg",
  p4: "/photos/photo-1552321554-5fefe8c9ef14.jpg",
  p5: "/photos/photo-1527515637462-cff94eecc1ac.jpg",
  p6: "/photos/photo-1581578731548-c64695cc6952.jpg",
  p7: "/photos/photo-1563453392212-326f5e854473.jpg",
  p8: "/photos/photo-1585704032915-c3400ca199e7.jpg",
  p9: "/photos/photo-1621905251189-08b45d6a269e.jpg",
  p10: "/photos/photo-1581578731548-c64695cc6952.jpg",
  p11: "/photos/photo-1507089947368-19c1da9775ae.jpg",
  p12: "/photos/photo-1552321554-5fefe8c9ef14.jpg",
};
