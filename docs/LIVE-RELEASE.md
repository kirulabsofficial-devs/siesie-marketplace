# Live release status — 22 September 2026

## Verified locally

- TypeScript passes; the live Vercel build compiles using the supplied public Supabase connection.
- PostgreSQL migrations apply cleanly in an isolated PGlite database. Role enforcement, private storage policies, bookings, verification, message membership and both call directions pass.
- Two isolated Chromium sessions exchange messages and booking/quote updates. Voice and video calls send real media packets on loopback using fake capture devices. Mute, camera toggle, decline, permission denial and track cleanup pass.
- The existing local test API and browser journey suites pass (13 API tests, 9 browser groups). The static Vercel prototype still passes all four groups.
- Guest Home, Explore, Bookings, Messages and Account navigation remains available on mobile; private actions go through account login.

## Verified remotely

- Supabase `hecxnbeeaziwjpixvwtx` has all three Siesie migrations installed through the SQL editor. All 15 SQL function bodies match the local tested versions after whitespace/comment normalization. All Siesie tables have RLS enabled.
- Anonymous snapshot RPC returns 200 with no demo users or jobs. Anonymous chat, calls and direct profile reads are denied. Email signup requires confirmation.
- `call-ice` is deployed with JWT verification enabled. `SITE_ORIGINS` is set to `https://siesie-marketplace.vercel.app`. The function checks the current user and call membership before issuing relay credentials.
- Remote call checks pass: production-origin preflight returns 204, an unapproved origin returns 403, and a request without a user session returns 401.
- Supabase Site URL is `https://siesie-marketplace.vercel.app`; login callbacks are restricted to `https://siesie-marketplace.vercel.app/login**`.

## Remote setup still needed

- Sign in to the Vercel account that owns Siesie and deploy `live-dist` or the source with the root Vercel configuration. The new code is not yet published to the production domain. `Siesie-Live-Vercel.zip` contains the final tested live build. Vercel Drop creates new projects; use the CLI linked to the existing project when updating its current domain.
- Configure custom SMTP for public confirmation/reset email delivery.
- Set up Cloudflare TURN and save its key ID and API token in Supabase Edge Function secrets. The user confirmed TURN is not set up yet. No subscription or paid service has been purchased.
- Reconcile CLI migration history before any future `supabase db push`; the existing schema was installed manually and must not be recreated.
- On two actual devices/networks, verify signup/confirmation/reset, verification image access, booking/quote updates, messages and relay-based voice/video calls. These remote checks are not yet complete.
- Payments (added 17 October 2026): run `supabase/migrations/202610170001_paystack.sql`, set `PAYSTACK_SECRET_KEY`, deploy the three payment functions, set the Paystack webhook URL and run `supabase/cron.sql`. See section 4 of SUPABASE-LIVE.md. The integration is tested locally against a fake Paystack only; run a full test-mode payment, payout and refund before switching to live keys.

## Recovery

The SQL editor bundle wraps all schema installation in a transaction. If it fails, do not deploy the live frontend; inspect the error, fix the bundle and retry after confirming rollback. After a successful installation, preserve the new data and apply forward-only corrective migrations rather than dropping tables.

Keep the previous Vercel deployment available. Roll back the frontend if account isolation fails, authentication cannot complete, or booking/message/call actions consistently error. Do not route signed-in users into demo accounts as a fallback. If a previous deployment is a demo, clearly identify it as a prototype with separate browser-local data.

Monitor Supabase Auth/API/function errors during first real-device tests. TURN or calling failures should not prevent messages or bookings. Camera and microphone tracks must stop on hang-up, decline, logout and leaving the page. Keep Paystack on test keys until a test-mode payment, payout and refund have been checked in the Paystack dashboard. If live payouts misbehave, unschedule the payout job (`select cron.unschedule('siesie-payouts');`) and remove `PAYSTACK_SECRET_KEY`; checkout then fails safely with no money taken.
