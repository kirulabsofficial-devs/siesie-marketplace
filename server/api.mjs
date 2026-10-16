import { createHash, randomBytes, randomUUID } from 'node:crypto';

const COOKIE = 'siesie_session';
const TTL = 7 * 24 * 60 * 60 * 1000;
const hash = (value) => createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };
function text(value, name, max = 100) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(400, `Enter a valid ${name} (1–${max} characters).`);
  return value.trim();
}
async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) fail(415, 'Use application/json.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16_384) fail(413, 'Request is too large.');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
    return value;
  } catch { fail(400, 'Send a valid JSON object.'); }
}
function fields(value, allowed) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) fail(400, 'Unexpected request field.');
}
const userView = (u) => ({ id: u.id, role: u.role, name: u.name, area: u.area, services: JSON.parse(u.services) });
const messageView = (m) => m && ({ id: m.id, sequence: m.sequence, senderId: m.sender_id, body: m.body, createdAt: m.created_at });

export function createApi(db, { testMode = false, sessionTtl = TTL } = {}) {
  const loginAttempts = new Map();
  const tokenFrom = (req) => req.headers.cookie?.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  function actor(req) {
    const token = tokenFrom(req);
    return token && db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=? AND s.expires_at>?`).get(hash(token), Date.now());
  }
  function revoke(req) {
    const token = tokenFrom(req);
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));
  }
  function session(req, res, u) {
    revoke(req);
    db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
    const token = randomBytes(32).toString('base64url');
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(hash(token), u.id, Date.now() + sessionTtl);
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.ceil(sessionTtl / 1000)}`);
    return { session: { role: u.role, userId: u.id }, user: { ...userView(u), phone: u.phone, joinedAt: u.joined_at }, testMode };
  }
  function membership(id, u) {
    // Deliberately return the same response for missing and someone else's conversations.
    const c = db.prepare('SELECT * FROM conversations WHERE id=? AND (customer_id=? OR worker_id=?)').get(id, u.id, u.id);
    if (!c) fail(404, 'Conversation unavailable.');
    return c;
  }
  function conversationView(c, u) {
    const peerId = u.id === c.customer_id ? c.worker_id : c.customer_id;
    const peer = db.prepare('SELECT * FROM users WHERE id=?').get(peerId);
    const cursor = db.prepare('SELECT sequence, read_at FROM read_cursors WHERE conversation_id=? AND user_id=?').get(c.id, u.id);
    const peerCursor = db.prepare('SELECT sequence, read_at FROM read_cursors WHERE conversation_id=? AND user_id=?').get(c.id, peerId);
    const last = db.prepare('SELECT * FROM messages WHERE conversation_id=? ORDER BY sequence DESC LIMIT 1').get(c.id);
    const unread = db.prepare('SELECT count(*) AS n FROM messages WHERE conversation_id=? AND sender_id<>? AND sequence>?').get(c.id, u.id, cursor?.sequence || 0);
    return { id: c.id, customerId: c.customer_id, workerId: c.worker_id, createdAt: c.created_at,
      peer: userView(peer), lastMessage: messageView(last) || null, unreadCount: unread.n,
      readCursor: cursor?.sequence || 0, peerReadCursor: peerCursor?.sequence || 0, peerReadAt: peerCursor?.read_at || null };
  }
  return async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, value) => { res.writeHead(status); res.end(JSON.stringify(value)); };
    try {
      // This slice is intentionally local-only, including Host validation against DNS rebinding.
      if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host || '')) fail(403, 'Use the local development address.');
      const url = new URL(req.url, `http://${req.headers.host}`);
      const path = url.pathname;
      const method = req.method;
      if (!['GET', 'HEAD'].includes(method)) {
        if (req.headers['x-siesie-request'] !== '1' || (req.headers.origin && req.headers.origin !== url.origin) || req.headers['sec-fetch-site'] === 'cross-site') fail(403, 'Request origin is not allowed.');
      }
      if (method === 'GET' && path === '/api/health') return send(200, { ok: true, testMode });
      if (method === 'GET' && path === '/api/session') {
        const u = actor(req);
        return send(200, { session: u ? { role: u.role, userId: u.id } : null,
          user: u ? { ...userView(u), phone: u.phone, joinedAt: u.joined_at } : null, testMode });
      }
      if (method === 'POST' && path === '/api/session/logout') {
        revoke(req);
        res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
        return send(200, { ok: true });
      }
      if (method === 'POST' && ['/api/test/session', '/api/test/register', '/api/test/login'].includes(path)) {
        if (!testMode) fail(404, 'Test accounts are disabled.');
        const key = req.socket.remoteAddress;
        const limit = loginAttempts.get(key);
        const bucket = !limit || limit.until < Date.now() ? { count: 0, until: Date.now() + 60_000 } : limit;
        loginAttempts.set(key, bucket);
        if (++bucket.count > 120) fail(429, 'Too many attempts. Try again in a minute.');
        const input = await body(req);
        let u;
        if (path === '/api/test/session') {
          fields(input, ['role', 'userId']);
          u = db.prepare('SELECT * FROM users WHERE id=? AND role=?').get(text(input.userId, 'account'), text(input.role, 'role'));
        } else if (path === '/api/test/login') {
          fields(input, ['phone', 'code']);
          if (input.code !== '123456') fail(401, 'The demo code is 123456.');
          u = db.prepare('SELECT * FROM users WHERE phone=?').get(text(input.phone, 'phone').replace(/\D/g, '').replace(/^233/, '0'));
          if (!u) return send(200, { needsRegistration: true });
        } else {
          fields(input, ['role', 'name', 'phone', 'area', 'services', 'code']);
          if (!['customer', 'worker'].includes(input.role) || input.code !== '123456') fail(400, 'Choose a customer or pro demo account.');
          const name = text(input.name, 'name');
          const phone = text(input.phone, 'phone').replace(/\D/g, '').replace(/^233/, '0');
          if (!/^0\d{9}$/.test(phone)) fail(400, 'Enter a 10-digit phone number.');
          const area = text(input.area, 'area');
          const services = input.services || [];
          if (!Array.isArray(services) || services.length > 3 || services.some((s) => !['tiling','cleaning','maintenance'].includes(s))) fail(400, 'Invalid services.');
          if (db.prepare('SELECT id FROM users WHERE phone=?').get(phone)) fail(409, 'This phone number already has an account. Log in instead.');
          const id = `${input.role === 'customer' ? 'c' : 'w'}_${randomUUID()}`;
          db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, 0, ?, ?)').run(id, input.role, name, phone, area, JSON.stringify(services), now());
          u = db.prepare('SELECT * FROM users WHERE id=?').get(id);
        }
        if (!u) fail(401, 'Account not found.');
        return send(200, session(req, res, u));
      }
      const u = actor(req);
      if (!u) fail(401, 'Your session has ended. Choose a prototype account to continue.');
      if (u.role === 'admin') fail(403, 'Private messaging is available to customers and pros.');
      if (path === '/api/contacts' && method === 'GET') {
        const contacts = u.role === 'customer'
          ? db.prepare(`SELECT * FROM users WHERE role='worker' AND (verified=1 OR id IN (SELECT worker_id FROM job_memberships WHERE customer_id=?) OR id IN (SELECT worker_id FROM conversations WHERE customer_id=?)) ORDER BY name`).all(u.id, u.id)
          : db.prepare(`SELECT * FROM users WHERE role='customer' AND (id IN (SELECT customer_id FROM job_memberships WHERE worker_id=?) OR id IN (SELECT customer_id FROM conversations WHERE worker_id=?)) ORDER BY name`).all(u.id, u.id);
        return send(200, { userId: u.id, contacts: contacts.map(userView) });
      }
      if (path === '/api/conversations' && method === 'GET') {
        const rows = db.prepare('SELECT * FROM conversations WHERE customer_id=? OR worker_id=?').all(u.id, u.id);
        return send(200, { userId: u.id, conversations: rows.map((c) => conversationView(c, u)).sort((a,b) => (b.lastMessage?.sequence || 0) - (a.lastMessage?.sequence || 0) || b.createdAt.localeCompare(a.createdAt)) });
      }
      if (path === '/api/conversations' && method === 'POST') {
        const input = await body(req); fields(input, ['peerId']);
        const peerId = text(input.peerId, 'contact');
        const customerId = u.role === 'customer' ? u.id : peerId;
        const workerId = u.role === 'worker' ? u.id : peerId;
        const existing = db.prepare('SELECT * FROM conversations WHERE customer_id=? AND worker_id=?').get(customerId, workerId);
        if (existing) return send(200, { conversation: conversationView(existing, u) });
        const peer = db.prepare('SELECT * FROM users WHERE id=?').get(peerId);
        const hasJob = db.prepare('SELECT 1 FROM job_memberships WHERE customer_id=? AND worker_id=?').get(customerId, workerId);
        if (!peer || peer.role !== (u.role === 'customer' ? 'worker' : 'customer') || (!hasJob && (u.role === 'worker' || !peer.verified))) fail(403, 'You cannot start a conversation with this account.');
        const id = randomUUID();
        db.prepare('INSERT INTO conversations VALUES (?, ?, ?, ?)').run(id, customerId, workerId, now());
        return send(201, { conversation: conversationView(membership(id, u), u) });
      }
      const match = path.match(/^\/api\/conversations\/([a-zA-Z0-9_-]+)(?:\/(messages|read))?$/);
      if (!match) fail(404, 'Endpoint not found.');
      const c = membership(match[1], u);
      if (!match[2] && method === 'GET') return send(200, { conversation: conversationView(c, u) });
      if (match[2] === 'messages' && method === 'GET') {
        const after = Number(url.searchParams.get('after') || 0);
        const limit = Number(url.searchParams.get('limit') || 100);
        if (!Number.isSafeInteger(after) || after < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) fail(400, 'Invalid message cursor or page size.');
        const rows = db.prepare('SELECT * FROM messages WHERE conversation_id=? AND sequence>? ORDER BY sequence LIMIT ?').all(c.id, after, limit + 1);
        const messages = rows.slice(0, limit).map(messageView);
        return send(200, { messages, hasMore: rows.length > limit, nextCursor: messages.at(-1)?.sequence || after });
      }
      if (match[2] === 'messages' && method === 'POST') {
        const input = await body(req); fields(input, ['body', 'clientId']);
        const message = text(input.body, 'message', 2000);
        const clientId = text(input.clientId, 'message key', 100);
        const existing = db.prepare('SELECT * FROM messages WHERE conversation_id=? AND sender_id=? AND client_id=?').get(c.id, u.id, clientId);
        if (existing) {
          if (existing.body !== message) fail(409, 'This message key was already used.');
          return send(200, { message: messageView(existing) });
        }
        const id = randomUUID();
        db.prepare('INSERT INTO messages (id, conversation_id, sender_id, body, created_at, client_id) VALUES (?, ?, ?, ?, ?, ?)').run(id, c.id, u.id, message, now(), clientId);
        return send(201, { message: messageView(db.prepare('SELECT * FROM messages WHERE id=?').get(id)) });
      }
      if (match[2] === 'read' && method === 'POST') {
        const input = await body(req); fields(input, ['messageId']);
        const message = db.prepare('SELECT sequence FROM messages WHERE id=? AND conversation_id=?').get(text(input.messageId, 'message'), c.id);
        if (!message) fail(400, 'Read cursor must refer to a message in this conversation.');
        // Monotonic cursor: delayed requests cannot un-read messages or mark unseen future messages read.
        db.prepare(`INSERT INTO read_cursors VALUES (?, ?, ?, ?) ON CONFLICT(conversation_id, user_id)
          DO UPDATE SET sequence=excluded.sequence, read_at=excluded.read_at WHERE excluded.sequence>read_cursors.sequence`).run(c.id, u.id, message.sequence, now());
        return send(200, { conversation: conversationView(c, u) });
      }
      fail(405, 'Method not allowed.');
    } catch (error) {
      if (!(error instanceof HttpError)) console.error('API error:', error);
      if (!res.headersSent) send(error.status || 500, { error: error.status ? error.message : 'Something went wrong. Please try again.' });
      else res.end();
    }
  };
}
