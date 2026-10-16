# Siesie frontend direction

Research and implementation: 20 September 2026.

## Reference marketplaces

These are established reference products, not a quantified ranking. Their official pages informed the information architecture and service discovery patterns; Siesie's visual treatment is original.

| Reference | Pattern observed | Application to Siesie |
| --- | --- | --- |
| [Thumbtack](https://www.thumbtack.com/) | Prominent service discovery and local professional search | A focused homepage search with a separate location selector and direct service links |
| [Taskrabbit](https://www.taskrabbit.com/) and its [service catalogue](https://www.taskrabbit.com/services) | Recognisable household tasks and an approachable path to hiring help | Concrete category names, familiar trade icons, and a three-step explanation |
| [Urban Company](https://www.urbancompany.com/chennai) | Image-led service sections with visible prices and ratings | Consistent photographic cards, genuine stored review counts, starting prices and units |
| [Houzz professional directory](https://www.houzz.com/professionals/probr0-bo~) | Service/location discovery and home-improvement categories | A home-focused photograph and a more spacious professional catalogue |

## Visual direction

Siesie serves homeowners looking for tiling, cleaning and maintenance in Ghana. The first screen should help them find the right professional; the rest should explain how choosing and booking works.

- Palette: navy `#142e43`, service blue `#244d68`, slate `#668397`, white `#ffffff`, mist `#f5f8fa`, and quiet green `#3a6950`. Existing amber, green and red payment-state colours remain distinct.
- Type: locally served Archivo Variable for display typography; Plus Jakarta Sans for body copy, with a locally served Atkinson fallback. Monospace remains reserved for amounts and supporting data.
- Layout: a two-column photographic hero, compact trust strip, six service categories, four-column professional catalogue, booking steps, payment walkthrough, professional invitation and FAQs.
- Signature: a large architectural photograph with a rounded upper corner and a payment-protection card that overlaps its edge. A small Ghana flag and the existing Kente motif retain local context.
- Responsive design: catalogue changes to two columns on tablets and one on phones; the hero stacks on phones; the bottom navigation is reserved for smaller screens.

The initial design was revised to remove decorative statistics and a discount that had no supporting product behaviour. The redesigned cards use `workerStats`, including the actual review count and a new-professional state, instead of fabricated rating fallbacks. Prices include their unit so a square-metre tiling price is not mistaken for a complete-job price.

## Implemented scope

Rebuilt homepage and professional search; shared professional cards; refined global colour, typography and radius tokens; white public navigation; a quieter public footer; actual ratings on profile screens. Search supports service, location, query and sorting, including multiple search words. The location picker preserves active search filters.

The prototype's existing customer, worker, administrator and payment flows remain in place. The interactive payment example is explicitly labelled as a demonstration. Photography and example profiles remain prototype assets; this redesign does not add backend payments or production identity verification.

## Validation

Production TypeScript/Vite build, browser visual review, responsive layout checks and focused interaction checks. Vite reports the existing application bundle above its 500 kB advisory threshold; route splitting is a separate optimisation opportunity.
