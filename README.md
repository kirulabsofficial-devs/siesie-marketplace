# Siesie service marketplace

A React prototype for home services in Ghana, with server-backed test sessions and private customer–pro messaging. The app starts on the public **Your home. Sorted.** landing page. Choose **View prototype as customer**, **pro** or **admin** to enter a sample account. Nothing signs in automatically from the old browser-local demo.

**Live Supabase integration:** [setup and deployment guide](docs/SUPABASE-LIVE.md). The live build adds real authentication, shared data, private storage and two-way voice/video calling. It requires your Supabase project and a call relay before it can be used. Root Vercel deployments now select this live build; the prototype commands below remain available separately. Payments go through Paystack once its keys, functions and webhook are set up (guide section 4).

## Start locally

Requires **Node.js 24.18+** and npm. SQLite is included with Node; no Docker or database install is needed.

```powershell
npm ci
npm run dev
```

Open **http://127.0.0.1:5178**. One command starts both Vite and the API. The first run creates and seeds `data/siesie.sqlite`; later runs preserve users, sessions, conversations, messages and read cursors. Keep this local server running while using the app.

To preview the built app with its API, stop development first:

```powershell
npm run build
npm run preview
```

The default `dist/` build needs the Node server. For a shareable Vercel prototype, use the separate build below. Both local commands bind to loopback and explicitly enable test accounts. `NODE_ENV=production` refuses test sign-in. Port and database overrides are optional:

```powershell
$env:PORT = "5180"
$env:SIESIE_DB_PATH = "data/another-demo.sqlite"
npm run dev
```

Environment files are not auto-loaded by the server. See `.env.example` for PowerShell overrides. Use one hostname consistently: `localhost` and `127.0.0.1` have different browser cookies.

## Share the prototype on Vercel

```powershell
npm run build:vercel
```

Drag the **`vercel-dist` folder** into [Vercel Drop](https://vercel.com/drop). This folder already contains the built site and its routing configuration. Upload this folder instead of `dist/` or the local SQLite database. For a prototype CLI deployment use `vercel --local-config vercel.prototype.json`; the root configuration selects the Supabase live build.

This explicit prototype build simulates sessions and messaging in the visitor's browser. It needs no backend, database credentials or running laptop. First visits are logged out. Visitors can try account creation, bookings, customer/pro/admin views and messaging; reloads keep that browser's demo state. Switch customer/pro roles in the **same browser** to try both sides of a conversation. Other browsers and devices have their own independent data. Use sample details only: this is not production authentication or a shared live marketplace.

The SPA rewrite supports direct links and refreshes on routes such as `/search`, `/jobs` and `/messages`. Vercel's [Vite guide](https://vercel.com/docs/frameworks/frontend/vite) documents this rewrite. Its [SQLite guidance](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel) explains why the local database cannot provide durable shared storage in Vercel Functions.

Prototype transport is selected at build time (`vite --mode prototype`), never as a fallback when a real server fails. `npm run dev`, `npm run build` and `npm run preview` retain their existing server-backed behavior. Server cookies cannot sign into the static prototype, and its browser state cannot authenticate against the server. For shared accounts use the separate live setup above.

Run `npm run test:vercel` to build and verify the prototype with a static-only web server and no API. The checks cover navigation, account creation, booking, role switching, messaging, reloads and browser isolation.

## Try two people locally

1. Open a normal browser window and choose **Customer** (Ama).
2. Open an incognito window or another browser profile at the same URL and choose **Pro** (Kwame).
3. As Ama, open a pro profile and select **Message**, or go to `/messages` → **New conversation** → **Kwame Asante**.
4. Send a message. As Kwame, open **Messages** in the pro workspace. Reply and switch back to Ama to see the response/read receipt.
5. Reload either window, or restart the server: the chosen accounts and messages remain. **Log out** returns that browser to the public landing page. The other browser stays signed in.

Two ordinary tabs in one browser profile share one cookie/account. Use separate browser contexts to represent two people.

| Role | Account | Demo phone | Workspace |
| --- | --- | --- | --- |
| Customer | Ama Owusu | `0244123456` | `/jobs`, `/messages` |
| Pro | Kwame Asante | `0245550101` | `/work`, `/work/messages` |
| Admin | Adjoa Sarpong | `0302000000` | `/admin` |

The phone login also accepts the demo code `123456`; no SMS is sent. Mock sessions last seven days unless logged out. Switching view explicitly selects another account. Admins cannot read customer–pro conversations.

## What is server-backed

- Durable identities and opaque, HttpOnly cookie sessions, with rotation, expiry and revocation.
- Scoped contact, conversation and message APIs; private membership checks on every conversation read, send and read-cursor update.
- SQLite constraints, ordered message IDs, bounded pagination and retry-safe sends.
- Independent per-participant read cursors, unread badges and read receipts.
- Two-second polling with reconnect catch-up, visible errors and retained failed-send drafts.

The existing React inbox, profile/job message links, search and customer/pro/admin journeys remain. The visual refresh preserves the navy branding and collage hero, adds a quieter prototype selector and refines desktop/mobile spacing. Existing service photos and fonts are served locally.

## What remains a local demo

Bookings, detailed profiles, identity-photo samples, verification decisions, reviews, disputes and payments still use `siesie.db` in this browser. They move no real money and do not synchronize between people. Use **Switch view** within the same browser for the original booking → quote → payment → completion → admin payout demonstration.

Server messaging eligibility uses the server's seeded verification/booking relationships, not browser state. New customers can message verified sample pros. A browser-only approval of a newly registered pro does not grant messaging eligibility. See the [scope and API guide](docs/SERVER-TEST-MODE.md) for this boundary.

Old `siesie.chat.v1` messages are not imported. **Reset local demo journeys** keeps shared messages and the active account. To start an empty shared messaging demo, stop the app and set `SIESIE_DB_PATH` to a new filename. Database files and test outputs are ignored by version control.

## Run tests

```powershell
# First-time browser installation only:
npx playwright install chromium

# API checks, build, then two independent browser sessions:
npm test

# Or run either suite separately:
npm run test:api
npm run test:e2e

# Extended local booking, dispute, registration and profile regression:
npm run test:marketplace
```

Tests create their own temporary database and local server on a free port. They never reset `data/siesie.sqlite`. The browser suite builds the app, tests the built frontend, and saves screenshots/results to `test-results/`.

Coverage includes logged-out startup, ignoring legacy localStorage identity, two browser sessions, bidirectional messages, unread/read receipts, lost-response retry without duplication, membership/role rejection, concurrent sends, pagination, invalid requests, origin protection, session rotation/logout/expiry, server-restart durability, mobile layouts, and the original booking-to-payout journey.

The extended marketplace regression starts its own development server and temporary database. It also checks the original action contracts and responsive routes. The historical Python entry point remains available, but needs a separate Python Playwright installation and a running development server.

See [server test-mode details and API contract](docs/SERVER-TEST-MODE.md). Older [continuation notes](docs/CONTINUATION.md) describe the pre-server prototype and are historical context.
