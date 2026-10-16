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

## Security and data behavior

- Default-deny RLS and revoked direct browser table privileges; explicit security-definer RPCs enforce authenticated roles, ownership, membership and state transitions. Function search paths are fixed.
- Identity images and booking/dispute images are in a private bucket. Access is limited to the owner, relevant booking participants (job images only), and admins. Signed URLs last five minutes. Public portfolio images go in a separate bucket.
- Live job, document and profile data stay in memory. Only the Supabase login session is persisted by the Auth SDK; demo state never authorizes a live request.
- Chat and call signaling are polled while the app is open. No Realtime publication needs to be enabled. Active call signals are deleted when a participant ends the call or either participant next observes expiry. For retention, schedule a privileged database job to clear signals for expired calls that neither party reopens, and purge old call metadata under your retention policy.
- One device can own each side of an answered call. Other tabs cannot send signals, obtain relay credentials or end that device's call.
- Client-supplied payment success is rejected. Live checkout, payouts and refunds are disabled until a payment provider, server verification/webhooks and financial reconciliation are implemented. The live build must not be described as a complete paid marketplace yet. Automatic inspection-window payouts are also not enabled.

## Verification

```powershell
npm run typecheck
npm run test:supabase
npm run test:live
npm test
npm run test:vercel
```

`test:supabase` runs real PostgreSQL migrations and permission/state checks in PGlite. `test:live` builds the live frontend using explicitly fake test connection values in `test-results/live-build`, mocks Supabase HTTP auth, and routes RPCs to that local database. It checks independent account sessions, shared messages, both call directions, real browser audio/video packets on loopback, media controls, decline and cleanup. Its test-only ICE override does not enter the shipped app. Never deploy `test-results/live-build`.

After connecting the real services, test sign-up + email confirmation + password reset, pro registration + document approval, shared bookings/messages, and calls in both directions on two devices on different networks. Check decline, denied permissions, logout during a call, offline recovery, protected deep links, and cross-account private-file access. Check relay credentials are issued and calls use a relay candidate. These deployment checks remain outstanding.

References: [Supabase email/password authentication](https://supabase.com/docs/guides/auth/passwords), [SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp), [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Edge Function authentication](https://supabase.com/docs/guides/functions/auth), [Cloudflare TURN credentials](https://developers.cloudflare.com/realtime/turn/generate-credentials/).
