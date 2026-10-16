import type { Customer, Db, Job, JobEvent, Photo, ServiceId, TilePattern, Worker } from "./types";
import { commissionOn } from "../lib/format";

const H = 3600_000;
const D = 24 * H;

export const DB_VERSION = 3;

export const DEMO_USERS = {
  customer: "c_ama",
  worker: "w_kwame",
  admin: "a_adjoa",
} as const;

function iso(msAgo: number, now: number) {
  return new Date(now - msAgo).toISOString();
}

function photo(id: string, caption: string, pattern: TilePattern): Photo {
  return { id, caption, pattern };
}

export function createSeed(now = Date.now()): Db {
  const t = (msAgo: number) => iso(msAgo, now);
  const future = (msAhead: number) => new Date(now + msAhead).toISOString();

  const customers: Customer[] = [
    { id: "c_ama", name: "Ama Owusu", phone: "0244123456", area: "East Legon", joinedAt: t(140 * D) },
    { id: "c_kojo", name: "Kojo Danquah", phone: "0209876543", area: "Spintex", joinedAt: t(90 * D) },
    { id: "c_esi", name: "Esi Nyarko", phone: "0551239876", area: "Tema Comm. 25", joinedAt: t(60 * D) },
    { id: "c_fiifi", name: "Fiifi Mensah", phone: "0267771234", area: "Kumasi – Ahodwo", joinedAt: t(200 * D) },
    { id: "c_delali", name: "Delali Ahiable", phone: "0501112233", area: "Adenta", joinedAt: t(120 * D) },
  ];

  const workers: Worker[] = [
    {
      id: "w_kwame",
      name: "Kwame Asante",
      phone: "0245550101",
      services: ["tiling", "maintenance"],
      baseArea: "Spintex",
      areas: ["Spintex", "Tema Comm. 18", "Tema Comm. 25", "East Legon", "Airport Residential"],
      bio: "Tiler for 11 years. Bathrooms, kitchens and porches. I bring my own cutter and levelling clips, and I leave the site swept.",
      pricing: { mode: "quote", from: 45, to: 70, unit: "per m²" },
      availability: { days: [1, 2, 3, 4, 5, 6], note: "Mon–Sat, 7am to 5pm" },
      verification: "verified",
      ghanaCard: { number: "GHA-714203958-3", submittedAt: t(300 * D) },
      payout: { type: "momo", network: "mtn", number: "0245550101", name: "Kwame Asante" },
      portfolio: [
        photo("p1", "Bathroom floor, Spintex", "hex"),
        photo("p2", "Kitchen backsplash, East Legon", "subway"),
        photo("p3", "Veranda, Tema Comm. 18", "checker"),
        photo("p4", "Shower wall, Airport Residential", "herringbone"),
      ],
      joinedAt: t(300 * D),
      yearsExperience: 11,
    },
    {
      id: "w_abena",
      name: "Abena Mensah",
      phone: "0205550102",
      services: ["cleaning"],
      baseArea: "East Legon",
      areas: ["East Legon", "Airport Residential", "Osu", "Madina", "Adenta"],
      bio: "I run a team of three. Move-in cleans, post-construction dust, and deep cleans. We bring our own detergents and a wet vacuum.",
      pricing: { mode: "fixed", from: 350, to: 900, unit: "per clean" },
      availability: { days: [1, 2, 3, 4, 5, 6], note: "Mon–Sat, can start 6am" },
      verification: "verified",
      ghanaCard: { number: "GHA-502118734-1", submittedAt: t(250 * D) },
      payout: { type: "momo", network: "telecel", number: "0205550102", name: "Abena Mensah" },
      portfolio: [
        photo("p5", "Post-construction clean, East Legon", "grid"),
        photo("p6", "Kitchen deep clean, Osu", "terrazzo"),
        photo("p7", "Bathroom descale, Madina", "subway"),
      ],
      joinedAt: t(250 * D),
      yearsExperience: 6,
    },
    {
      id: "w_yaw",
      name: "Yaw Boateng",
      phone: "0545550103",
      services: ["maintenance"],
      baseArea: "Madina",
      areas: ["Madina", "Adenta", "Haatso", "East Legon"],
      bio: "Plumbing and electrical repairs. Leaks, sockets, water heaters, pumping machines. I explain what went wrong before I fix it.",
      pricing: { mode: "quote", from: 150, to: 800, unit: "per job" },
      availability: { days: [0, 1, 2, 3, 4, 5], note: "Sun–Fri, emergencies on call" },
      verification: "verified",
      ghanaCard: { number: "GHA-620044127-8", submittedAt: t(180 * D) },
      payout: { type: "momo", network: "mtn", number: "0545550103", name: "Yaw Boateng" },
      portfolio: [photo("p8", "Kitchen sink trap, Adenta", "pipes"), photo("p9", "Bathroom mixer, Haatso", "grid")],
      joinedAt: t(180 * D),
      yearsExperience: 9,
    },
    {
      id: "w_efua",
      name: "Efua Quansah",
      phone: "0265550104",
      services: ["cleaning"],
      baseArea: "Tema Comm. 25",
      areas: ["Tema Comm. 25", "Tema Comm. 18", "Spintex"],
      bio: "Weekly and one-off home cleaning. Fridges, ovens, windows, and wardrobes on request.",
      pricing: { mode: "fixed", from: 250, to: 600, unit: "per clean" },
      availability: { days: [1, 3, 5, 6], note: "Mon, Wed, Fri, Sat" },
      verification: "verified",
      ghanaCard: { number: "GHA-833019265-4", submittedAt: t(160 * D) },
      payout: { type: "momo", network: "airteltigo", number: "0265550104", name: "Efua Quansah" },
      portfolio: [photo("p10", "Living room, Tema Comm. 25", "terrazzo")],
      joinedAt: t(160 * D),
      yearsExperience: 4,
    },
    {
      id: "w_kofi",
      name: "Kofi Agyeman",
      phone: "0245550105",
      services: ["tiling"],
      baseArea: "Kumasi – Ahodwo",
      areas: ["Kumasi – Ahodwo", "Kumasi – Asokwa"],
      bio: "Floor and wall tiling in Kumasi. Large-format porcelain and outdoor pavers.",
      pricing: { mode: "quote", from: 40, to: 65, unit: "per m²" },
      availability: { days: [1, 2, 3, 4, 5], note: "Mon–Fri" },
      verification: "verified",
      ghanaCard: { number: "GHA-411870032-6", submittedAt: t(210 * D) },
      payout: { type: "bank", bank: "GCB Bank", number: "1041130045621", name: "Kofi Agyeman" },
      portfolio: [photo("p11", "Shop floor, Asokwa", "grid"), photo("p12", "Compound pavers, Ahodwo", "herringbone")],
      joinedAt: t(210 * D),
      yearsExperience: 14,
    },
    {
      id: "w_selorm",
      name: "Selorm Agbeko",
      phone: "0555550106",
      services: ["tiling"],
      baseArea: "Dansoman",
      areas: ["Dansoman", "Weija", "Kasoa", "Osu"],
      bio: "Bathrooms and stair tiling. I work with one apprentice and finish on the date we agree.",
      pricing: { mode: "fixed", from: 55, to: 55, unit: "per m²" },
      availability: { days: [1, 2, 3, 4, 5, 6], note: "Mon–Sat" },
      verification: "verified",
      ghanaCard: { number: "GHA-905527781-2", submittedAt: t(120 * D) },
      payout: { type: "momo", network: "mtn", number: "0555550106", name: "Selorm Agbeko" },
      portfolio: [photo("p13", "Stairs, Dansoman", "checker"), photo("p14", "Bathroom, Weija", "hex")],
      joinedAt: t(120 * D),
      yearsExperience: 7,
    },
    {
      id: "w_akosua",
      name: "Akosua Frimpong",
      phone: "0275550107",
      services: ["cleaning", "maintenance"],
      baseArea: "Adenta",
      areas: ["Adenta", "Madina", "Haatso"],
      bio: "Cleaning plus small fixes: curtain rails, door handles, tap washers, and bulb changes.",
      pricing: { mode: "fixed", from: 300, to: 700, unit: "per visit" },
      availability: { days: [2, 3, 4, 5, 6], note: "Tue–Sat" },
      verification: "verified",
      ghanaCard: { number: "GHA-318842290-5", submittedAt: t(100 * D) },
      payout: { type: "momo", network: "mtn", number: "0275550107", name: "Akosua Frimpong" },
      portfolio: [photo("p15", "Apartment reset, Adenta", "terrazzo")],
      joinedAt: t(100 * D),
      yearsExperience: 5,
    },
    {
      id: "w_emmanuel",
      name: "Emmanuel Tetteh",
      phone: "0505550108",
      services: ["maintenance"],
      baseArea: "Kasoa",
      areas: ["Kasoa", "Weija", "Dansoman"],
      bio: "Carpentry and ceilings. Doors, wardrobes, PVC and POP ceiling repairs.",
      pricing: { mode: "quote", from: 200, to: 1500, unit: "per job" },
      availability: { days: [1, 2, 3, 4, 5, 6], note: "Mon–Sat" },
      verification: "verified",
      ghanaCard: { number: "GHA-722905513-9", submittedAt: t(80 * D) },
      payout: { type: "momo", network: "telecel", number: "0505550108", name: "Emmanuel Tetteh" },
      portfolio: [photo("p16", "Ceiling repair, Kasoa", "grid")],
      joinedAt: t(80 * D),
      yearsExperience: 12,
    },
    // Pending verification: these fill the admin queue.
    {
      id: "w_nana",
      name: "Nana Owusu-Ansah",
      phone: "0245550109",
      services: ["tiling"],
      baseArea: "Haatso",
      areas: ["Haatso", "Madina", "Adenta"],
      bio: "Tiling and terrazzo polishing.",
      pricing: { mode: "quote", from: 50, to: 80, unit: "per m²" },
      availability: { days: [1, 2, 3, 4, 5], note: "Mon–Fri" },
      verification: "pending",
      ghanaCard: { number: "GHA-610238847-7", submittedAt: t(20 * H) },
      payout: { type: "momo", network: "mtn", number: "0245550109", name: "Nana Owusu-Ansah" },
      portfolio: [photo("p17", "Terrazzo floor, Haatso", "terrazzo")],
      joinedAt: t(20 * H),
      yearsExperience: 8,
    },
    {
      id: "w_mawuli",
      name: "Mawuli Kpodo",
      phone: "0205550110",
      services: ["maintenance"],
      baseArea: "Weija",
      areas: ["Weija", "Kasoa", "Dansoman"],
      bio: "Electrician. Rewiring, sockets, prepaid meter issues.",
      pricing: { mode: "quote", from: 120, to: 900, unit: "per job" },
      availability: { days: [1, 2, 3, 4, 5, 6], note: "Mon–Sat" },
      verification: "pending",
      ghanaCard: { number: "GHA-557710326-0", submittedAt: t(2 * D) },
      payout: { type: "momo", network: "telecel", number: "0205550110", name: "Mawuli Kpodo" },
      portfolio: [],
      joinedAt: t(2 * D),
      yearsExperience: 6,
    },
    {
      id: "w_rita",
      name: "Rita Addo",
      phone: "0565550111",
      services: ["cleaning"],
      baseArea: "Osu",
      areas: ["Osu", "Airport Residential"],
      bio: "Office and apartment cleaning.",
      pricing: { mode: "fixed", from: 280, to: 500, unit: "per clean" },
      availability: { days: [1, 2, 3, 4, 5], note: "Weekdays" },
      verification: "pending",
      ghanaCard: { number: "GHA-730061459-2", submittedAt: t(5 * H) },
      payout: { type: "momo", network: "airteltigo", number: "0565550111", name: "Rita Addo" },
      portfolio: [],
      joinedAt: t(5 * H),
      yearsExperience: 3,
    },
  ];

  const commissionPct = 12;
  const confirmWindowHours = 48;
  const workerById = Object.fromEntries(workers.map((w) => [w.id, w]));
  const customerById = Object.fromEntries(customers.map((c) => [c.id, c]));

  function dest(workerId: string) {
    const p = workerById[workerId].payout;
    return p.type === "momo" ? `MoMo ${p.number}` : `${p.bank} ••${p.number.slice(-4)}`;
  }

  let refN = 0;
  const ref = (p: string) => `${p}-${(0x1a2b3c + refN++ * 7919).toString(36).toUpperCase()}`;

  function base(
    id: string,
    customerId: string,
    workerId: string,
    service: ServiceId,
    title: string,
    scope: string,
    createdAgo: number,
  ): Job {
    const c = customerById[customerId];
    return {
      id,
      customerId,
      workerId,
      service,
      title,
      scope,
      address: `${c.area}, house no. ${12 + (id.charCodeAt(id.length - 1) % 40)}`,
      area: c.area,
      preferredDate: t(createdAgo - 3 * D),
      photos: [],
      status: "requested",
      createdAt: t(createdAgo),
      events: [{ at: t(createdAgo), by: "customer", text: "Booking requested" }],
    };
  }

  function paid(job: Job, amount: number, quotedAgo: number, paidAgo: number, network: "mtn" | "telecel" | "airteltigo" = "mtn") {
    job.quote = { amount, date: t(paidAgo - D), note: "", at: t(quotedAgo) };
    job.payment = {
      reference: ref("PSK"),
      amount,
      channel: "momo",
      network,
      payer: customerById[job.customerId].phone.replace(/^(\d{3})\d{4}(\d{3})$/, "$1 ••• $2"),
      paidAt: t(paidAgo),
    };
    job.status = "in_progress";
    job.events.push(
      { at: t(quotedAgo), by: "worker", text: `Accepted at ${amount.toFixed(2)}` },
      { at: t(paidAgo), by: "customer", text: "Paid. Funds held by platform" },
    );
    return job;
  }

  function released(job: Job, completedAgo: number, releasedAgo: number) {
    const amount = job.payment!.amount;
    const { commission, net } = commissionOn(amount, commissionPct);
    job.completedAt = t(completedAgo);
    job.confirmedAt = t(completedAgo - 6 * H);
    job.payout = {
      reference: ref("TRF"),
      gross: amount,
      commission,
      net,
      destination: dest(job.workerId),
      status: "sent",
      queuedAt: t(completedAgo - 6 * H),
      sentAt: t(releasedAgo),
    };
    job.status = "closed";
    job.events.push(
      { at: t(completedAgo), by: "worker", text: "Marked the job complete" },
      { at: t(completedAgo - 6 * H), by: "customer", text: "Confirmed the work" },
      { at: t(releasedAgo), by: "admin", text: `Payout of ${net.toFixed(2)} sent` },
    );
    return job;
  }

  function reviewed(job: Job, rating: number, text: string, workerRating = 5) {
    const at = job.payout?.sentAt ?? job.createdAt;
    job.customerReview = { rating, text, at };
    job.workerReview = { rating: workerRating, text: "", at };
    return job;
  }

  const jobs: Job[] = [];

  // ── Ama (demo customer) ────────────────────────────────────────────────
  {
    const j = base(
      "SS-10482",
      "c_ama",
      "w_kwame",
      "tiling",
      "Retile guest bathroom floor and walls",
      "Old tiles are cracked near the shower. About 14 m² total: floor 5 m², walls 9 m². I have bought the tiles already (60×30 white gloss for walls, 40×40 grey for floor).",
      9 * D,
    );
    j.photos = [photo("jp1", "Cracked floor tiles", "checker"), photo("jp2", "Shower wall", "subway")];
    paid(j, 1850, 8 * D, 7 * D);
    j.status = "completed";
    j.completedAt = t(12 * H);
    j.completionNote = "Floor and walls done, grouted and sealed around the shower tray. Leftover tiles are stacked in the store room.";
    j.completionPhotos = [photo("cp1", "Finished floor", "hex"), photo("cp2", "Finished shower wall", "subway")];
    j.confirmBy = future(confirmWindowHours * H - 12 * H);
    j.events.push({ at: t(12 * H), by: "worker", text: "Marked the job complete" });
    jobs.push(j);
  }
  {
    const j = base(
      "SS-10495",
      "c_ama",
      "w_abena",
      "cleaning",
      "Move-in deep clean, 3-bedroom house",
      "Moving in next week. Painters just finished so there is dust and paint spots on the floor tiles and windows. 3 bedrooms, 2 bathrooms, kitchen.",
      2 * D,
    );
    j.quote = { amount: 780, date: future(2 * D), note: "Three of us, about 7 hours. Paint spots on windows included.", at: t(20 * H) };
    j.status = "quoted";
    j.events.push({ at: t(20 * H), by: "worker", text: "Accepted at 780.00" });
    jobs.push(j);
  }
  {
    const j = base(
      "SS-10501",
      "c_ama",
      "w_yaw",
      "maintenance",
      "Kitchen sink leaking under the cabinet",
      "Water collects in the cabinet under the sink after every use. Cabinet board is starting to swell.",
      3 * H,
    );
    j.preferredDate = future(D);
    jobs.push(j);
  }
  jobs.push(
    reviewed(
      released(paid(base("SS-10233", "c_ama", "w_efua", "cleaning", "Weekend deep clean", "Full house clean before family visit.", 40 * D), 420, 39 * D, 38 * D, "mtn"), 36 * D, 35 * D),
      5,
      "Efua cleaned inside the fridge and oven without me asking. The house smelled fresh for days.",
    ),
  );

  // ── Kwame (demo worker) ───────────────────────────────────────────────
  {
    const j = base(
      "SS-10499",
      "c_kojo",
      "w_kwame",
      "tiling",
      "Kitchen backsplash, about 4 m²",
      "Want subway tiles behind the stove and sink. Wall is currently painted. I can buy tiles once you tell me the quantity.",
      2 * H,
    );
    j.preferredDate = future(4 * D);
    j.photos = [photo("jp3", "Kitchen wall", "grid")];
    jobs.push(j);
  }
  {
    const j = paid(
      base("SS-10470", "c_esi", "w_kwame", "tiling", "Porch tiling, 22 m²", "Front porch. Outdoor anti-slip tiles already delivered. Please remove the old cement screed first.", 6 * D),
      1320,
      5 * D,
      3 * D,
      "telecel",
    );
    j.preferredDate = t(2 * D);
    jobs.push(j);
  }
  jobs.push(
    reviewed(
      released(paid(base("SS-10301", "c_fiifi", "w_kwame", "tiling", "Shop floor tiling", "Retail shop floor, 30 m².", 26 * D), 1650, 25 * D, 24 * D), 21 * D, 20 * D),
      5,
      "Kwame came on time every day. The floor is perfectly level and the site was swept before leaving.",
    ),
    reviewed(
      released(paid(base("SS-10188", "c_delali", "w_kwame", "maintenance", "Replace broken bathroom tiles and fix tap", "A few broken tiles and a dripping tap.", 60 * D), 480, 59 * D, 58 * D), 56 * D, 55 * D),
      4,
      "Neat work on the tiles. Took an extra day to buy matching grout, but I was told in advance.",
    ),
    reviewed(
      released(paid(base("SS-10121", "c_esi", "w_kwame", "tiling", "Bathroom wall tiling", "Master bathroom walls.", 80 * D), 1100, 79 * D, 78 * D), 75 * D, 74 * D),
      5,
      "Straight grout lines and no wasted tiles. Booking again for the porch.",
    ),
  );

  // ── Admin queues ──────────────────────────────────────────────────────
  {
    const j = paid(
      base("SS-10455", "c_kojo", "w_yaw", "maintenance", "Ceiling leak above bedroom", "Brown water stain spreading on bedroom ceiling. Probably from the overhead tank pipe.", 10 * D),
      650,
      9 * D,
      9 * D,
    );
    j.completedAt = t(3 * D);
    j.completionNote = "Replaced the joint on the overflow pipe above the ceiling.";
    j.completionPhotos = [photo("cp3", "New pipe joint", "pipes")];
    j.confirmBy = t(3 * D - confirmWindowHours * H);
    j.status = "disputed";
    j.dispute = {
      reason: "unfinished",
      details: "It rained on Saturday and the ceiling is dripping again in the same spot. The stain is still wet. I don't think the real leak was found.",
      evidence: [photo("ev1", "Wet ceiling after rain", "grid")],
      openedAt: t(2 * D),
      workerResponse: {
        text: "The pipe I fixed is dry. The new water is from the roof, not the plumbing. Roofing is a separate job. I can come and show the customer.",
        evidence: [photo("ev2", "Dry pipe joint", "pipes")],
        at: t(1 * D),
      },
    };
    j.events.push(
      { at: t(3 * D), by: "worker", text: "Marked the job complete" },
      { at: t(2 * D), by: "customer", text: "Raised a dispute: the job isn't finished" },
      { at: t(1 * D), by: "worker", text: "Responded to the dispute" },
    );
    jobs.push(j);
  }
  {
    const j = paid(
      base("SS-10462", "c_esi", "w_abena", "cleaning", "Post-construction clean", "New extension, 2 rooms.", 8 * D),
      900,
      7 * D,
      7 * D,
    );
    j.completedAt = t(30 * H);
    j.confirmedAt = t(26 * H);
    const { commission, net } = commissionOn(900, commissionPct);
    j.payout = { reference: ref("TRF"), gross: 900, commission, net, destination: dest("w_abena"), status: "queued", queuedAt: t(26 * H) };
    j.status = "confirmed";
    j.customerReview = { rating: 5, text: "No dust anywhere, even on top of the window frames.", at: t(26 * H) };
    j.events.push({ at: t(30 * H), by: "worker", text: "Marked the job complete" }, { at: t(26 * H), by: "customer", text: "Confirmed the work" });
    jobs.push(j);
  }
  {
    const j = paid(
      base("SS-10444", "c_fiifi", "w_kofi", "tiling", "Compound pavers, 40 m²", "Driveway pavers.", 12 * D),
      2400,
      11 * D,
      11 * D,
    );
    j.completedAt = t(3 * D);
    j.confirmBy = t(3 * D - confirmWindowHours * H);
    j.confirmedAt = j.confirmBy;
    j.autoConfirmed = true;
    const { commission, net } = commissionOn(2400, commissionPct);
    j.payout = { reference: ref("TRF"), gross: 2400, commission, net, destination: dest("w_kofi"), status: "queued", queuedAt: j.confirmBy };
    j.status = "confirmed";
    j.events.push(
      { at: t(3 * D), by: "worker", text: "Marked the job complete" },
      { at: j.confirmBy, by: "system", text: `No dispute within ${confirmWindowHours} h. Payout queued` },
    );
    jobs.push(j);
  }
  {
    const j = paid(
      base("SS-10390", "c_delali", "w_akosua", "cleaning", "Apartment clean and curtain rails", "Clean 2-bed apartment and fix two curtain rails.", 20 * D),
      560,
      19 * D,
      19 * D,
    );
    j.completedAt = t(17 * D);
    j.status = "closed";
    const toWorker = 400;
    const toCustomer = 160;
    const { commission, net } = commissionOn(toWorker, commissionPct);
    j.dispute = {
      reason: "unfinished",
      details: "The cleaning was fine but only one curtain rail was fixed.",
      evidence: [photo("ev3", "Loose curtain rail", "grid")],
      openedAt: t(16 * D),
      workerResponse: { text: "The second rail needed a new bracket I didn't have. I agree to a partial refund.", evidence: [], at: t(16 * D - 4 * H) },
      resolution: { outcome: "split", toWorker, toCustomer, note: "Cleaning complete, one rail outstanding. Rail portion refunded.", at: t(15 * D) },
    };
    j.payout = { reference: ref("TRF"), gross: toWorker, commission, net, destination: dest("w_akosua"), status: "sent", queuedAt: t(15 * D), sentAt: t(15 * D) };
    j.refund = { reference: ref("RFD"), amount: toCustomer, destination: "MoMo 050 ••• 233", at: t(15 * D) };
    j.events.push(
      { at: t(17 * D), by: "worker", text: "Marked the job complete" },
      { at: t(16 * D), by: "customer", text: "Raised a dispute: the job isn't finished" },
      { at: t(15 * D), by: "admin", text: "Dispute resolved: split 400.00 / 160.00" },
    );
    jobs.push(reviewed(j, 4, "Cleaning was very good. Rail sorted out through the dispute."));
  }
  {
    const j = paid(
      base("SS-10402", "c_kojo", "w_emmanuel", "maintenance", "Wardrobe door rehang", "Two wardrobe doors dropping.", 18 * D),
      300,
      17 * D,
      17 * D,
    );
    j.status = "closed";
    j.dispute = {
      reason: "no_show",
      details: "Didn't come on the agreed day or the day after. Not answering calls.",
      evidence: [],
      openedAt: t(14 * D),
      resolution: { outcome: "refund", toWorker: 0, toCustomer: 300, note: "Worker unreachable for 72 h. Full refund.", at: t(12 * D) },
    };
    j.refund = { reference: ref("RFD"), amount: 300, destination: "MoMo 020 ••• 543", at: t(12 * D) };
    j.events.push(
      { at: t(14 * D), by: "customer", text: "Raised a dispute: the worker didn't show up" },
      { at: t(12 * D), by: "admin", text: "Dispute resolved: full refund of 300.00" },
    );
    jobs.push(j);
  }

  // ── History that gives every verified worker a reputation ─────────────
  const history: Array<[string, string, ServiceId, string, number, number, number, string]> = [
    ["c_delali", "w_abena", "cleaning", "Move-out clean", 650, 30, 5, "Landlord returned my full deposit after Abena's team cleaned. That says it all."],
    ["c_kojo", "w_abena", "cleaning", "Office deep clean", 850, 50, 5, "Came at 6am so the office was ready by 9. Very organised."],
    ["c_ama", "w_abena", "cleaning", "Sofa and rug wash", 380, 70, 4, "Sofa looks new. One rug still had a faint stain."],
    ["c_ama", "w_yaw", "maintenance", "Water heater not working", 420, 45, 5, "Yaw showed me the burnt element before replacing it. Very honest."],
    ["c_delali", "w_yaw", "maintenance", "Sockets sparking in kitchen", 260, 65, 5, "Fixed it the same afternoon and checked every socket in the house."],
    ["c_esi", "w_efua", "cleaning", "Weekly clean (4 weeks)", 1000, 35, 5, "Reliable every single week. Never late."],
    ["c_fiifi", "w_kofi", "tiling", "Living room porcelain tiles", 2100, 55, 5, "Large tiles, zero lippage. Worth every pesewa."],
    ["c_fiifi", "w_kofi", "tiling", "Staircase tiling", 1500, 95, 4, "Good finish. Took longer than planned because of the rain."],
    ["c_delali", "w_selorm", "tiling", "Bathroom floor", 420, 40, 5, "Finished exactly on the date we agreed."],
    ["c_kojo", "w_selorm", "tiling", "Stair nosing and tiles", 990, 75, 4, "Clean cuts on the stair edges. Apprentice was a bit slow."],
    ["c_delali", "w_akosua", "cleaning", "Kitchen clean and new tap washer", 340, 45, 5, "Two jobs in one visit. Very handy."],
    ["c_esi", "w_emmanuel", "maintenance", "POP ceiling patch", 750, 33, 4, "You can't see where the patch is anymore."],
    ["c_kojo", "w_emmanuel", "maintenance", "Main door lock replacement", 280, 70, 5, "Brought three lock options and fitted the one I picked."],
  ];
  history.forEach(([cid, wid, service, title, amount, days, rating, text], i) => {
    const id = `SS-${9800 + i * 17}`;
    const j = base(id, cid, wid, service, title, title + ".", days * D);
    released(paid(j, amount, days * D - 6 * H, days * D - 12 * H), days * D - 3 * D, days * D - 4 * D);
    reviewed(j, rating, text);
    jobs.push(j);
  });

  const sortEvents = (e: JobEvent[]) => e.sort((a, b) => a.at.localeCompare(b.at));
  jobs.forEach((j) => sortEvents(j.events));

  return {
    version: DB_VERSION,
    customers,
    workers,
    admins: [{ id: "a_adjoa", name: "Adjoa Sarpong", phone: "0302000000" }],
    jobs,
    notices: [
      { id: "n1", to: "c_ama", text: "Kwame marked “Retile guest bathroom floor and walls” complete. Check the work.", jobId: "SS-10482", at: t(12 * H), read: false },
      { id: "n2", to: "c_ama", text: "Abena accepted your cleaning request at GH₵ 780.00. Pay to confirm.", jobId: "SS-10495", at: t(20 * H), read: false },
      { id: "n3", to: "w_kwame", text: "New request from Kojo: Kitchen backsplash, about 4 m²", jobId: "SS-10499", at: t(2 * H), read: false },
    ],
    settings: { commissionPct, confirmWindowHours },
    session: null,
  };
}
