# Connect Siesie to Supabase

The live code supports email/password accounts, customer and professional roles, shared bookings and quotes, private messages, read receipts, notifications, professional verification and private image uploads. The customer and pro inboxes also support bidirectional voice/video calls with incoming-call dialogs across the app, accept/decline, mute, camera toggle and hang-up.

**Connection status (22 September 2026):** project `hecxnbeeaziwjpixvwtx` and its public key are configured in ignored `.env.local`. All three database migrations are installed remotely; all 15 SQL function bodies match the tested source and all Siesie tables have RLS enabled. Public snapshot access succeeds, while anonymous access to profiles, messages and calls is rejected. The `call-ice` Edge Function is deployed. Site URL, login redirects and `SITE_ORIGINS` are configured for `https://siesie-marketplace.vercel.app`. TURN credentials and custom SMTP still need setup, and the live frontend still needs deployment. Automated integration tests use an isolated local PostgreSQL database and simulated Auth HTTP responses; they are not evidence of live email delivery or Internet call reliability.

## 1. Database and accounts

**The current project is already installed through the SQL editor. Do not rerun the installation.** SQL editor installation does not populate the CLI migration-history table. Before managing this project with `supabase db push`, reconcile its migration history with the three applied migrations using the CLI repair workflow, after checking the remote schema. Make subsequent changes through new forward-only migrations.

For a new, empty Supabase project, link it with the Supabase CLI and apply the migrations in this repository:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Alternatively, execute each file in `supabase/migrations` in filename order in the project's SQL editor. Apply each migration only once. The migrations create new Siesie tables; they do not import demo users, bookings or messages. Use an empty project or review naming conflicts first.

In Supabase Authentication:

- Enable email/password sign-in and email confirmation. Set a password minimum of 10 characters.
- Set the Site URL to the final HTTPS Vercel URL. Add `https://YOUR_DOMAIN/login**` to allowed redirect URLs; add your exact local development URL only if needed. Both confirmation and password reset return to `/login`.
- Configure a custom SMTP sender before inviting public users. Supabase's default mail service is limited and does not deliver freely to arbitrary users.
- Create real customer and professional accounts through the site's login page. Professionals submit their profiles and identity photos before an admin can approve public listing.

An admin must be granted manually by a trusted project owner. After that person signs up, find their UUID in Authentication and run:

```sql
update public.siesie_profiles set role = 'admin'
where id = 'THE_VERIFIED_ADMIN_USER_UUID' and role = 'customer';
```

Account metadata cannot grant admin access. No admin account or password is seeded. Admins can review verification documents and bookings but cannot read private customer–pro chats or call signaling.

## 2. Live frontend on Vercel

Add these public values in Vercel → Project Settings → Environment Variables:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

A legacy public `anon` key is also accepted. Never use a secret/service-role key, database password, TURN token or payment secret here: Vite variables are included in the browser bundle. Local development uses the same values in ignored `.env.local`.

The root `vercel.json` now selects `npm run build:live` and `live-dist`, with SPA rewrites for direct links. Redeploy after adding the variables and applying the migrations. The build stops with a setup error if the connection values are missing; it cannot silently switch to demo authentication.

For Vercel Drop, run `npm run build:live` locally with those values, then upload **live-dist** (also packaged as `Siesie-Live-Vercel.zip`). It contains the static site and routing configuration; your laptop is not the backend. The old `Siesie-Vercel.zip`/`vercel-dist` remain prototypes and do not contain the live integration.

The explicit prototype remains available via `npm run build:vercel`, or CLI deployment with `vercel --local-config vercel.prototype.json`. `npm run dev` still runs the local SQLite demo. Use `npm run dev:live` for Supabase development.

## 3. Voice and video calls

Supabase stores invitation and signaling state. Browser WebRTC carries the media. Calls use relay-only ICE to avoid exposing participants' direct network addresses to each other and to work across restrictive networks.

Create a Cloudflare Realtime TURN key, then set these **Supabase Edge Function secrets** in the dashboard:

```text
CLOUDFLARE_TURN_KEY_ID=your-turn-key-id
CLOUDFLARE_TURN_API_TOKEN=your-turn-key-api-token
SITE_ORIGINS=https://YOUR_DOMAIN
```

`SITE_ORIGINS` accepts comma-separated exact origins for approved production/preview deployments. For local testing include `http://localhost:5178` or `http://127.0.0.1:5178` as used. Do not put these secrets in frontend environment variables. TURN usage may incur provider charges; no provider has been provisioned or purchased by this change.

The current project already has this function deployed with JWT verification enabled. For a new project or a function source update, deploy the authenticated relay function:

```powershell
supabase functions deploy call-ice
```

Keep JWT verification enabled. The function also validates the current user and requires an active call belonging to that user/device before issuing short-lived relay credentials. It limits relay grants to three per participant per call. TURN credentials last two hours; calls end after one hour. Call invitations time out after 45 seconds. A missing participant heartbeat ends the call after 90 seconds. Starting calls is limited to eight attempts in five minutes per account.

Customers open **Messages**, choose a professional, then tap the phone or camera button. Professionals use the same buttons in their customer conversations. Both participants must be signed in with the site open. Incoming calls show a dialog on any page. This version has no background push notifications, closed-browser ringing, call recording or PSTN/telephone dialing. Browsers may pause background tabs; a visible tab is the reliable path. Permission prompts are shown only when initiating or accepting a call. Decline, hang-up, logout and page exit release camera/microphone tracks. A reload does not resume an answered call on a different device.

## 4. Payments with Paystack

Customers pay the agreed quote on Paystack's own checkout page, by mobile money or card. The money lands in Siesie's Paystack balance, and the booking shows as paid only after the server checks the charge with Paystack. When the customer confirms the work, or the inspection window closes with no dispute, the worker is sent the quote less the commission by Paystack Transfer to their mobile money wallet or bank account. The commission is set in Admin → Settings (10% by default) and fixed on each quote when the worker sends it. It stays in the balance.

Siesie pays Paystack's fees out of its commission: customers pay exactly the quote and workers get exactly the quote less commission. At the time of writing Paystack charges 1.95% per local payment, GHS 1 per mobile money transfer and GHS 8 per bank transfer, so a 10% commission leaves Siesie about 8%. Check Paystack's current Ghana pricing.

- A payment that arrives for a booking that can no longer take it (withdrawn, already paid, wrong amount) is refunded in full automatically.
- A failed or reversed transfer alerts admins and waits in Admin → Payouts for a retry once the cause is fixed. Each retry uses a new transfer reference.
- A transfer that got no answer from Paystack is checked with Paystack before anything is sent again, so a timeout cannot pay a worker twice.
- An admin's dispute decision refunds the customer's share through Paystack and sends the worker's share, less commission.

### Paystack account

- Paystack only lets **registered businesses** keep a balance and send transfers. Starter accounts cannot.
- In Settings → Preferences, set the payout schedule to **Settled to Balance** (manual payouts). With automatic payouts Paystack settles everything to your bank the next day, and you must top up the balance before workers can be paid. Paystack's Ghana terms have required a transfer from the balance at least every 90 days; confirm the current rule with Paystack.
- Turn off **OTP for transfers**, or Paystack holds every payout waiting for a code. Siesie marks those payouts failed with an explanation.
- Start with **test mode** keys. Only the secret key is used. The public key (`pk_…`) is not needed because checkout happens on Paystack's page.

### Setup

1. In the SQL editor, run `supabase/migrations/202610170001_paystack.sql` once. On the existing project run only this file, not `install.sql`.
2. In Edge Function secrets, add `PAYSTACK_SECRET_KEY` with your `sk_test_…` key. `SITE_ORIGINS` is already set for calls and is reused. Never put the secret key in a `VITE_` variable, a chat or the repository.
3. Deploy the functions:

```powershell
supabase functions deploy paystack-checkout
supabase functions deploy paystack-webhook --no-verify-jwt
supabase functions deploy paystack-payouts --no-verify-jwt
```

4. In Paystack → Settings → API Keys & Webhooks, set the webhook URL to `https://hecxnbeeaziwjpixvwtx.supabase.co/functions/v1/paystack-webhook`.
5. Run `supabase/cron.sql` in the SQL editor. It schedules the payout run every 10 minutes and shows a generated secret. Save that value as the Edge Function secret `SIESIE_CRON_SECRET`.
6. Test end to end with Paystack's test cards and test mobile money numbers: pay, confirm the work, and check the transfer in Paystack's test dashboard.
7. To go live, replace `PAYSTACK_SECRET_KEY` with the `sk_live_…` key and set the same webhook URL under the live keys. The frontend does not change.

## Security and data behavior

- Default-deny RLS and revoked direct browser table privileges; explicit security-definer RPCs enforce authenticated roles, ownership, membership and state transitions. Function search paths are fixed.
- Identity images and booking/dispute images are in a private bucket. Access is limited to the owner, relevant booking participants (job images only), and admins. Signed URLs last five minutes. Public portfolio images go in a separate bucket.
- Live job, document and profile data stay in memory. Only the Supabase login session is persisted by the Auth SDK; demo state never authorizes a live request.
- Chat and call signaling are polled while the app is open. No Realtime publication needs to be enabled. Active call signals are deleted when a participant ends the call or either participant next observes expiry. For retention, schedule a privileged database job to clear signals for expired calls that neither party reopens, and purge old call metadata under your retention policy.
- One device can own each side of an answered call. Other tabs cannot send signals, obtain relay credentials or end that device's call.
- Browsers never record a payment, payout or refund. Only Edge Functions holding the service-role key can call `siesie_payments`, and they act only on Paystack's answers: webhooks must carry a valid signature, every charge is re-verified with Paystack, and each update applies once however often Paystack retries. Checkout and transfer tables are not readable from the browser.
- Payouts and refunds rely on Paystack's records for reconciliation. Compare Paystack's transactions and transfers with Admin → Transactions regularly.

## Verification

```powershell
npm run typecheck
npm run test:supabase
npm run test:payments
npm run test:live
npm test
npm run test:vercel
```

`test:supabase` runs real PostgreSQL migrations and permission/state checks in PGlite. `test:payments` runs the payment Edge Functions' shared logic against those migrations and a scripted fake Paystack: checkout, webhook signatures, replays, refunds, payouts, failed and unanswered transfers, expired inspection windows and dispute splits. `test:live` builds the live frontend using explicitly fake test connection values in `test-results/live-build`, mocks Supabase HTTP auth, and routes RPCs to that local database. It checks independent account sessions, shared messages, the Paystack checkout round trip, both call directions, real browser audio/video packets on loopback, media controls, decline and cleanup. Its test-only ICE override does not enter the shipped app. Never deploy `test-results/live-build`.

After connecting the real services, test sign-up + email confirmation + password reset, pro registration + document approval, shared bookings/messages, and calls in both directions on two devices on different networks. Check decline, denied permissions, logout during a call, offline recovery, protected deep links, and cross-account private-file access. Check relay credentials are issued and calls use a relay candidate. These deployment checks remain outstanding.

References: [Supabase email/password authentication](https://supabase.com/docs/guides/auth/passwords), [SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp), [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Edge Function authentication](https://supabase.com/docs/guides/functions/auth), [Cloudflare TURN credentials](https://developers.cloudflare.com/realtime/turn/generate-credentials/).
