import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, request as httpRequest } from 'node:http';
import { openDatabase } from '../server/database.mjs';
import { createApi } from '../server/api.mjs';

async function serve(path, options = { testMode: true }) {
  const db = openDatabase(path);
  const server = createServer(createApi(db, options));
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return { db, base: `http://127.0.0.1:${server.address().port}`, close: async () => { server.closeAllConnections(); await new Promise((done) => server.close(done)); db.close(); } };
}
function client(app, initialCookie = '') {
  let cookie = initialCookie;
  return {
    get cookie() { return cookie; },
    async request(path, data, headers = {}) {
      const r = await fetch(app.base + '/api' + path, { method: data === undefined ? 'GET' : 'POST',
        headers: { ...(cookie ? { Cookie: cookie } : {}), ...(data === undefined ? {} : { 'Content-Type': 'application/json', 'X-Siesie-Request': '1' }), ...headers },
        body: data === undefined ? undefined : JSON.stringify(data) });
      if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
      return { status: r.status, data: await r.json(), headers: r.headers };
    },
    async login(role, userId) { const r = await this.request('/test/session', { role, userId }); assert.equal(r.status, 200); return r; },
  };
}

test('durable sessions and scoped messaging contract', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'siesie-api-'));
  const path = join(dir, 'test.sqlite');
  let app = await serve(path);
  const customer = client(app), pro = client(app), other = client(app), admin = client(app), guest = client(app);
  let id, first, second, savedCookie;
  try {
    await t.test('starts logged out; anonymous reads and mutations are refused', async () => {
      assert.equal((await guest.request('/session')).data.session, null);
      for (const route of ['/conversations', '/contacts', '/conversations/unknown/messages']) assert.equal((await guest.request(route)).status, 401);
      assert.equal((await guest.request('/conversations', { peerId: 'w_kwame' })).status, 401);
    });
    await t.test('independent HttpOnly durable cookies; role and identity cannot be forged', async () => {
      const r = await customer.login('customer', 'c_ama');
      assert.match(r.headers.get('set-cookie'), /HttpOnly; SameSite=Strict; Max-Age=604800/);
      assert.equal(r.headers.get('cache-control'), 'no-store');
      await pro.login('worker', 'w_kwame'); await other.login('customer', 'c_kojo'); await admin.login('admin', 'a_adjoa');
      assert.notEqual(customer.cookie, pro.cookie);
      assert.equal((await customer.request('/session')).data.session.userId, 'c_ama');
      assert.equal((await pro.request('/session')).data.session.userId, 'w_kwame');
      assert.equal((await guest.request('/test/session', { role: 'admin', userId: 'c_ama' })).status, 401);
      assert.equal((await client(app, 'siesie_session=forged').request('/conversations')).status, 401);
      assert.ok(app.db.prepare('SELECT token_hash FROM sessions').all().every((r) => r.token_hash.length === 64 && !customer.cookie.includes(r.token_hash)));
    });
    await t.test('contact scope and server-owned eligibility ignore browser changes', async () => {
      const contacts = (await customer.request('/contacts')).data.contacts;
      assert.ok(contacts.some((u) => u.id === 'w_kwame'));
      assert.ok(contacts.every((u) => !('phone' in u) && !('ghanaCard' in u) && !('payout' in u)));
      assert.equal((await customer.request('/conversations', { peerId: 'c_kojo' })).status, 403);
      assert.equal((await customer.request('/conversations', { peerId: 'missing' })).status, 403);
      const unrelatedPro = client(app); await unrelatedPro.login('worker', 'w_abena');
      const noJob = app.db.prepare("SELECT id FROM users WHERE role='customer' AND id NOT IN (SELECT customer_id FROM job_memberships WHERE worker_id='w_abena')").get();
      assert.ok(noJob);
      assert.equal((await unrelatedPro.request('/conversations', { peerId: noJob.id })).status, 403);
      assert.equal((await customer.request('/conversations', { peerId: 'w_kwame', customerId: 'c_kojo' })).status, 400);
    });
    await t.test('pair uniqueness under concurrent conversation creation', async () => {
      const replies = await Promise.all(Array.from({ length: 6 }, () => customer.request('/conversations', { peerId: 'w_kwame' })));
      assert.ok(replies.every((r) => r.status === 200 || r.status === 201));
      id = replies[0].data.conversation.id;
      assert.equal(new Set(replies.map((r) => r.data.conversation.id)).size, 1);
      assert.equal((await pro.request('/conversations', { peerId: 'c_ama' })).data.conversation.id, id);
    });
    await t.test('every private endpoint checks membership, including writes and read cursors; admin has no override', async () => {
      assert.deepEqual((await other.request('/conversations')).data.conversations, []);
      for (const [suffix, data] of [['', undefined], ['/messages', undefined], ['/messages', { body: 'intrusion', clientId: 'x' }], ['/read', { messageId: 'x' }]]) {
        const actual = await other.request(`/conversations/${id}${suffix}`, data);
        const missing = await other.request(`/conversations/missing${suffix}`, data);
        assert.equal(actual.status, 404); assert.deepEqual(actual.data, missing.data);
        assert.equal((await admin.request(`/conversations/${id}${suffix}`, data)).status, 403);
      }
      assert.equal((await admin.request('/contacts')).status, 403);
    });
    await t.test('message validation, actor injection, retry idempotency and concurrency', async () => {
      for (const invalid of ['', '   ', 'x'.repeat(2001), 17, null]) assert.equal((await customer.request(`/conversations/${id}/messages`, { body: invalid, clientId: 'bad' })).status, 400);
      assert.equal((await customer.request(`/conversations/${id}/messages`, { body: 'spoof', clientId: 'bad', senderId: 'w_kwame' })).status, 400);
      first = (await customer.request(`/conversations/${id}/messages`, { body: 'Hello Kwame', clientId: 'first' })).data.message;
      const duplicate = await customer.request(`/conversations/${id}/messages`, { body: 'Hello Kwame', clientId: 'first' });
      assert.equal(duplicate.status, 200); assert.equal(duplicate.data.message.id, first.id);
      assert.equal((await customer.request(`/conversations/${id}/messages`, { body: 'changed', clientId: 'first' })).status, 409);
      second = (await pro.request(`/conversations/${id}/messages`, { body: 'Hello Ama', clientId: 'reply' })).data.message;
      const sent = await Promise.all(Array.from({ length: 12 }, (_, i) => (i % 2 ? pro : customer).request(`/conversations/${id}/messages`, { body: `Concurrent ${i}`, clientId: `concurrent-${i}` })));
      assert.ok(sent.every((r) => r.status === 201));
      const messages = (await customer.request(`/conversations/${id}/messages`)).data.messages;
      assert.equal(messages.length, 14); assert.equal(new Set(messages.map((m) => m.id)).size, 14);
      assert.ok(messages.every((m, i) => !i || m.sequence > messages[i - 1].sequence));
    });
    await t.test('stable bounded pagination and safe input parsing', async () => {
      const a = (await customer.request(`/conversations/${id}/messages?limit=3`)).data;
      const b = (await customer.request(`/conversations/${id}/messages?limit=3&after=${a.nextCursor}`)).data;
      assert.equal(a.messages.length, 3); assert.equal(a.hasMore, true);
      assert.ok(b.messages[0].sequence > a.messages.at(-1).sequence);
      assert.equal((await customer.request(`/conversations/${id}/messages?limit=101`)).status, 400);
      assert.equal((await customer.request(`/conversations/${id}/messages?after=-1`)).status, 400);
      const badJson = await fetch(app.base + '/api/conversations', { method: 'POST', headers: { Cookie: customer.cookie, 'Content-Type':'application/json', 'X-Siesie-Request':'1' }, body: '{' });
      assert.equal(badJson.status, 400);
      assert.equal((await customer.request(`/conversations/${id}/messages`, { body: 'x'.repeat(17000), clientId: 'huge' })).status, 413);
    });
    await t.test('read cursors are per participant, monotonic and cannot read future or foreign messages', async () => {
      const before = (await pro.request(`/conversations/${id}`)).data.conversation;
      assert.equal(before.unreadCount, 7);
      await pro.request(`/conversations/${id}/read`, { messageId: first.id });
      assert.equal((await pro.request(`/conversations/${id}`)).data.conversation.unreadCount, 6);
      const all = (await pro.request(`/conversations/${id}/messages`)).data.messages;
      const latest = all.at(-1);
      await pro.request(`/conversations/${id}/read`, { messageId: latest.id });
      await pro.request(`/conversations/${id}/read`, { messageId: first.id });
      const after = (await pro.request(`/conversations/${id}`)).data.conversation;
      assert.equal(after.readCursor, latest.sequence); assert.equal(after.unreadCount, 0);
      const own = (await customer.request(`/conversations/${id}`)).data.conversation;
      assert.equal(own.peerReadCursor, latest.sequence); assert.ok(own.peerReadAt); assert.equal(own.unreadCount, 7);
      assert.equal((await pro.request(`/conversations/${id}/read`, { messageId: 'future' })).status, 400);
      const foreign = (await other.request('/conversations', { peerId: 'w_abena' })).data.conversation.id;
      const fm = (await other.request(`/conversations/${foreign}/messages`, { body: 'private', clientId: 'foreign' })).data.message;
      assert.equal((await pro.request(`/conversations/${id}/read`, { messageId: fm.id })).status, 400);
      const next = (await customer.request(`/conversations/${id}/messages`, { body: 'Not seen yet', clientId: 'later' })).data.message;
      assert.ok(next.sequence > after.readCursor);
      assert.equal((await pro.request(`/conversations/${id}`)).data.conversation.unreadCount, 1);
    });
    await t.test('CSRF and hostile hosts are refused', async () => {
      assert.equal((await customer.request('/session/logout', {}, { Origin: 'https://evil.example' })).status, 403);
      assert.equal((await customer.request('/session/logout', {}, { 'X-Siesie-Request': '' })).status, 403);
      const hostileHostStatus = await new Promise((done, reject) => {
        const req = httpRequest(app.base + '/api/session', { headers: { Host: 'evil.example' } }, (res) => { res.resume(); done(res.statusCode); });
        req.on('error', reject); req.end();
      });
      assert.equal(hostileHostStatus, 403);
      assert.equal((await customer.request('/session')).data.session.userId, 'c_ama');
    });
    await t.test('session rotation and logout revoke the previous token without affecting other sessions', async () => {
      const old = customer.cookie;
      await customer.login('customer', 'c_ama');
      assert.equal((await client(app, old).request('/conversations')).status, 401);
      savedCookie = customer.cookie;
      const proCookie = pro.cookie;
      await pro.request('/session/logout', {});
      assert.equal((await client(app, proCookie).request('/conversations')).status, 401);
      assert.equal((await customer.request('/session')).data.session.userId, 'c_ama');
    });
    await t.test('sessions, messages and cursors survive a server restart', async () => {
      await app.close(); app = await serve(path);
      const restored = client(app, savedCookie);
      assert.equal((await restored.request('/session')).data.session.userId, 'c_ama');
      assert.equal((await restored.request(`/conversations/${id}/messages`)).data.messages.length, 15);
      assert.ok((await restored.request(`/conversations/${id}`)).data.conversation.peerReadCursor >= second.sequence);
      app.db.prepare('UPDATE sessions SET expires_at=0').run();
      assert.equal((await restored.request('/conversations')).status, 401);
      assert.equal((await restored.request('/session')).data.session, null);
    });
    await t.test('demo login and registration can be disabled; unknown users cannot become admins', async () => {
      const tester = client(app);
      assert.equal((await tester.request('/test/register', { role: 'admin', name: 'No', phone: '0201000000', area: 'Osu', code: '123456' })).status, 400);
      assert.equal((await tester.request('/test/login', { phone: '0244123456', code: 'wrong' })).status, 401);
      const r = await tester.request('/test/register', { role: 'customer', name: 'Test Customer', phone: '0201000000', area: 'Osu', code: '123456' });
      assert.equal(r.status, 200); assert.equal(r.data.session.role, 'customer');
      assert.equal((await tester.request('/test/login', { phone: '0201000000', code: '123456' })).data.session.userId, r.data.session.userId);
      await app.close(); app = await serve(path, { testMode: false });
      const disabled = client(app);
      for (const route of ['/test/session','/test/login','/test/register']) assert.equal((await disabled.request(route, {})).status, 404);
    });
  } finally { await app.close(); await rm(dir, { recursive: true, force: true }); }
});
