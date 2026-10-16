# Messaging test slice

This slice backs sessions and private customer–pro messaging with a local SQLite database. The React booking, verification, escrow, dispute, payout and profile journeys remain browser-local simulations. No real payments, OTPs or notifications are sent.

This guide describes the default local server build. `npm run build:vercel` instead creates an explicitly browser-only prototype in `vercel-dist/`; its demo identities and messages stay in that browser and do not use these server endpoints. See the Vercel section in the README.

## Architecture and trust boundary

`server/index.mjs` serves the API and Vite in one process during development; preview serves `dist/` and the same API. There is no second port or CORS configuration. The server binds to `127.0.0.1`.

`server/database.mjs` creates schema version 1, enables foreign keys, WAL and a five-second busy timeout, then idempotently inserts the minimal fixture in `server/seed.json`. Seed data includes IDs, roles, display names, demo phone numbers, service summaries, verification flags and seeded customer–worker booking relationships. It excludes identity documents, payout details, job addresses and message content.

The fixture is derived from `src/data/seed.ts` using `npm run db:seed-fixture`. Changing it affects newly created databases; existing rows are intentionally not overwritten. Schema changes belong in a new `PRAGMA user_version` migration.

The API derives the current user from the session cookie. Request bodies cannot select message senders, conversation members or read-cursor owners. Admin accounts have no access to messaging. Inaccessible and nonexistent conversations both return 404. Client-side UI checks only improve navigation; the server is the authorization boundary.

## Session behavior

- Fresh browser contexts open the public landing page without selecting a mock account. Old `siesie.db.session` values are ignored, including values saved by the earlier prototype.
- Choosing **View prototype as customer**, **pro** or **admin** explicitly creates a session. The phone/code journey also works with demo code `123456`. New customer/pro registrations receive a server-generated identity; their detailed demo profiles remain local.
- Sessions last seven days and survive reloads, browser restarts that retain cookies, and server restarts. Logout revokes the session row, clears the cookie and returns to `/`.
- Tokens contain 32 random bytes. Only SHA-256 hashes are stored in SQLite. Cookies use `HttpOnly`, `SameSite=Strict`, `Path=/` and `Max-Age`. They intentionally lack `Secure` for loopback HTTP; an HTTPS deployment must add it.
- Changing account rotates the cookie and revokes that browser's old token. Different browser contexts have independent tokens. Tabs in the same browser profile share a cookie and therefore share an account; use a separate profile or normal + incognito window to test two people. The client detects shared-cookie identity changes before displaying returned conversations.
- Session recovery runs on startup, focus and every 20 seconds while visible. Protected API 401 responses clear the private UI. API responses are `Cache-Control: no-store`.

## Messaging rules

Customers can start conversations with server-verified pros or pros with a seeded booking relationship. Pros can initiate with customers from their server-seeded bookings, or reply to existing enquiries. Each customer–pro pair has one conversation, enforced by a unique constraint. Contact responses contain only scoped display information, never phone numbers, identity documents or payment data.

Messages receive UUIDs, server timestamps and a globally increasing SQLite sequence. Queries use that sequence for stable ordering and pagination. Bodies are trimmed, nonempty and at most 2,000 JavaScript UTF-16 code units; JSON requests are limited to 16 KiB. `clientId` is a per-send idempotency key, unique within the sender/conversation pair. Retrying the same key/body returns the original message; reusing it for a different body returns 409. The composer retains its draft/key after a failed send and clears only after server acknowledgement. Reloading discards unsent drafts.

Each participant has a monotonically increasing read cursor. A read request names an existing message **in that conversation**, preventing foreign or future cursor values. SQLite upserts only advance the cursor. Unread counts exclude the participant's own messages. A sender sees “Read” when the recipient's cursor covers that message. The receipt timestamp records when the cursor advanced, rather than a separate timestamp for every message.

The UI polls every two seconds while visible and refreshes on focus/online. It catches up through paginated message reads on reconnect. Only the active thread downloads history; inbox lists contain summaries. History is loaded in pages of 100 and currently retained in memory for the active account. This is a modest-volume test implementation, without push delivery, search indexing, retention jobs or virtualized long histories. Failed sends are retried explicitly by the user.

## HTTP contract

All mutation requests require `Content-Type: application/json` and `X-Siesie-Request: 1`. A supplied `Origin` must exactly match the loopback origin; cross-site requests and non-loopback Host headers are rejected. There are no permissive CORS headers. Authentication attempts are capped at 120 per minute per client IP for local automated/demo use.

| Method | Path | Input / response |
| --- | --- | --- |
| GET | `/api/health` | `{ ok, testMode }` |
| GET | `/api/session` | `{ session, user, testMode }`; session/user are null when logged out |
| POST | `/api/test/session` | `{ role, userId }`; creates or rotates a test session |
| POST | `/api/test/login` | `{ phone, code }`; session or `{ needsRegistration: true }` |
| POST | `/api/test/register` | `{ role, name, phone, area, services?, code }`; customer/pro only |
| POST | `/api/session/logout` | `{}`; revokes current session |
| GET | `/api/contacts` | `{ userId, contacts }`; scoped eligible contacts |
| GET | `/api/conversations` | `{ userId, conversations }`; member-only summaries, unread counts and cursors |
| POST | `/api/conversations` | `{ peerId }`; returns new (201) or existing (200) conversation |
| GET | `/api/conversations/:id` | Member-only summary, peer, last message and cursors |
| GET | `/api/conversations/:id/messages?after=0&limit=100` | `{ messages, nextCursor, hasMore }`; limit 1–100 |
| POST | `/api/conversations/:id/messages` | `{ body, clientId }`; persisted message |
| POST | `/api/conversations/:id/read` | `{ messageId }`; advances authenticated participant's cursor |

Errors use `{ error: string }`: 400 validation, 401 missing/expired session, 403 forbidden role/contact/origin, 404 unavailable conversation/disabled test endpoint, 409 conflicting key/phone, 413 oversized body, 415 wrong content type, 429 login throttling, 500 unexpected server failure. SQL uses bound parameters. Internal errors are logged on the server and omitted from responses.

## Deliberate limits

This is **test-mode identity**, not production authentication: anyone with local access can select known demo accounts. `SIESIE_TEST_MODE=0` disables all three test sign-in/registration endpoints and hides the preview controls. Production startup refuses demonstration sign-in. Do not expose the local server using a tunnel or public reverse proxy.

Booking changes, simulated verification approvals and payment state in `siesie.db` do **not** grant server messaging permissions. Server eligibility uses the verified seed and its relationships. A newly registered customer can contact verified seed pros; the pro can reply to that conversation. A newly registered pro remains unverified in the messaging database, even if the browser-only verification demo is completed. Moving booking/verification authority to the server is a separate slice; accepting browser-provided membership would break privacy.

Earlier `siesie.chat.v1` messages are not imported because browser-supplied authorship and membership are untrusted. New shared messages exist only in SQLite and the authenticated page's memory. The **Reset local demo journeys** control resets this browser's bookings/profiles, keeps the active identity and never deletes shared messages. For a fresh messaging database, stop the server and choose a new `SIESIE_DB_PATH`; keep the old file as a backup.

Before a real pilot: replace test identity with verified authentication, move booking/verification/payment authority to the backend, deploy HTTPS with Secure cookies and hardened origin configuration, use private file storage, and add operational rate limits, backups, retention and monitoring.

## Implementation reference

This project uses the SQLite module bundled with Node 24; no native npm database driver or separate database service is required. See the [Node 24 SQLite documentation](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html).
