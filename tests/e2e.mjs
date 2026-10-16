import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startServer } from '../server/index.mjs';

const dir = await mkdtemp(join(tmpdir(), 'siesie-e2e-'));
const databasePath = join(dir, 'test.sqlite');
const output = resolve('test-results');
await mkdir(output, { recursive: true });
let app = await startServer({ port: 0, databasePath, testMode: true });
const port = app.server.address().port;
const base = `http://127.0.0.1:${port}`;
let browser;
const passed = [], errors = [];
const record = (message) => { passed.push(message); console.log(`PASS ${message}`); };
const waitFor = async (fn, label) => {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) { if (await fn()) return; await new Promise((r) => setTimeout(r, 150)); }
  throw new Error(`Timed out: ${label}`);
};
const visible = (locator) => locator.waitFor({ state: 'visible', timeout: 15000 });
const json = async (context, path) => (await context.request.get(base + '/api' + path)).json();
const post = async (context, path, data) => context.request.post(base + '/api' + path, { data, headers: { 'X-Siesie-Request': '1' } });
async function choose(page, role) {
  const switcher = page.getByRole('button', { name: 'Switch view' });
  if (await switcher.isVisible()) await switcher.click();
  await page.getByRole('button', { name: `View prototype as ${role}`, exact: true }).click();
  await page.waitForURL(base + (role === 'customer' ? '/jobs' : role === 'pro' ? '/work' : '/admin'));
}
async function send(page, message) {
  await page.getByRole('textbox', { name: 'Write a message' }).fill(message);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await visible(page.getByRole('log').getByText(message, { exact: true }));
  await waitFor(async () => await page.getByRole('textbox', { name: 'Write a message' }).inputValue() === '', 'composer clears after server acknowledgement');
}

try {
  browser = await chromium.launch({ headless: true });
  const customerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const proContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const customer = await customerContext.newPage(), pro = await proContext.newPage();
  for (const page of [customer, pro]) page.on('pageerror', (e) => errors.push(e.message));

  await customer.goto(base);
  await visible(customer.getByRole('heading', { name: 'Your home. Sorted.' }));
  await visible(customer.getByRole('link', { name: 'Log in', exact: true }));
  assert.equal((await json(customerContext, '/session')).session, null);
  await customer.evaluate(() => { const db = JSON.parse(localStorage.getItem('siesie.db') || '{}'); db.session = { role: 'admin', userId: 'a_adjoa' }; localStorage.setItem('siesie.db', JSON.stringify(db)); });
  await customer.reload();
  await visible(customer.getByRole('link', { name: 'Log in', exact: true }));
  await customer.screenshot({ path: join(output, 'landing-desktop.png'), fullPage: true });
  record('Fresh browsers and legacy localStorage identities stay logged out on the landing page');
  await choose(customer, 'customer');
  await pro.goto(base); await choose(pro, 'pro');
  assert.equal((await json(customerContext, '/session')).session.userId, 'c_ama');
  assert.equal((await json(proContext, '/session')).session.userId, 'w_kwame');
  assert.equal(await customer.evaluate(() => document.cookie.includes('siesie_session')), false);
  assert.ok((await customerContext.cookies()).find((c) => c.name === 'siesie_session').httpOnly);
  await customer.reload();
  await visible(customer.getByRole('button', { name: 'Switch view' }));
  record('Two isolated browser contexts choose separate accounts; HttpOnly sessions survive reload');

  await customer.goto(base + '/messages?to=w_kwame');
  await customer.waitForURL(/\/messages\/[a-z0-9-]+$/);
  const conversationId = customer.url().split('/').at(-1);
  await visible(customer.getByRole('heading', { name: 'Kwame Asante', exact: true }));
  await customer.bringToFront(); await send(customer, 'Can you help with my kitchen tiles?');
  await pro.bringToFront();
  await waitFor(async () => (await json(proContext, '/conversations')).conversations[0]?.unreadCount === 1, 'unread count for pro');
  await visible(pro.getByRole('navigation', { name: 'Worker', exact: true }).getByRole('link', { name: /Messages.*1/ }));
  await pro.goto(base + '/work/messages');
  await pro.getByRole('link', { name: /Ama Owusu/ }).click();
  await visible(pro.getByRole('log').getByText('Can you help with my kitchen tiles?', { exact: true }));
  await waitFor(async () => (await json(proContext, `/conversations/${conversationId}`)).conversation.unreadCount === 0, 'opening conversation advances read cursor');
  await send(pro, 'Absolutely. I can visit on Thursday.');
  await customer.bringToFront();
  await visible(customer.getByRole('log').getByText('Absolutely. I can visit on Thursday.', { exact: true }));
  await visible(customer.locator('.outgoing').filter({ hasText: 'Can you help' }).getByText('Read', { exact: true }));
  await customer.screenshot({ path: join(output, 'messages-desktop.png'), fullPage: true });
  record('Customer and pro exchange messages, see unread badges and receive read receipts across browsers');

  let interrupted = false;
  await customer.route(`**/api/conversations/${conversationId}/messages`, async (route) => {
    if (route.request().method() === 'POST' && !interrupted) { interrupted = true; await route.fetch(); await route.abort('failed'); }
    else await route.continue();
  });
  const retryMessage = 'Please bring a few tile samples.';
  await customer.getByRole('textbox', { name: 'Write a message' }).fill(retryMessage);
  await customer.getByRole('button', { name: 'Send message', exact: true }).click();
  await visible(customer.getByRole('alert').filter({ hasText: 'Cannot reach Siesie' }));
  assert.equal(await customer.getByRole('textbox', { name: 'Write a message' }).inputValue(), retryMessage);
  await customer.getByRole('button', { name: 'Send message', exact: true }).click();
  await waitFor(async () => await customer.getByRole('textbox', { name: 'Write a message' }).inputValue() === '', 'retry completes');
  assert.equal((await json(customerContext, `/conversations/${conversationId}/messages`)).messages.filter((m) => m.body === retryMessage).length, 1);
  await customer.unroute(`**/api/conversations/${conversationId}/messages`);
  record('A lost send response retains the draft; retry creates exactly one durable message');

  const outsider = await browser.newContext();
  await post(outsider, '/test/session', { role: 'customer', userId: 'c_kojo' });
  assert.deepEqual((await json(outsider, '/conversations')).conversations, []);
  for (const suffix of ['', '/messages']) assert.equal((await outsider.request.get(`${base}/api/conversations/${conversationId}${suffix}`)).status(), 404);
  assert.equal((await post(outsider, `/conversations/${conversationId}/messages`, { body: 'forged', clientId: 'forged' })).status(), 404);
  assert.equal((await post(outsider, `/conversations/${conversationId}/read`, { messageId: 'forged' })).status(), 404);
  await post(outsider, '/test/session', { role: 'admin', userId: 'a_adjoa' });
  assert.equal((await outsider.request.get(`${base}/api/conversations/${conversationId}/messages`)).status(), 403);
  await outsider.close();
  record('Another customer and an admin cannot read, send to, or mark a private conversation read');

  await app.close(); app = await startServer({ port, databasePath, testMode: true });
  await customer.reload(); await pro.reload();
  await visible(customer.getByRole('log').getByText(retryMessage, { exact: true }));
  await visible(pro.getByRole('log').getByText(retryMessage, { exact: true }));
  assert.equal((await json(customerContext, '/session')).session.userId, 'c_ama');
  assert.equal((await json(proContext, '/session')).session.userId, 'w_kwame');
  record('Both sessions and shared message history survive a real server restart');

  await customer.setViewportSize({ width: 390, height: 844 });
  await visible(customer.getByRole('textbox', { name: 'Write a message' }));
  assert.equal(await customer.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await customer.screenshot({ path: join(output, 'messages-mobile.png'), fullPage: true });
  await customer.getByRole('button', { name: 'Log out of prototype' }).click();
  await customer.waitForURL(base + '/');
  await customer.reload();
  await visible(customer.getByRole('link', { name: 'Log in', exact: true }));
  assert.equal((await json(customerContext, '/session')).session, null);
  assert.equal((await json(proContext, '/session')).session.userId, 'w_kwame');
  await customer.screenshot({ path: join(output, 'landing-mobile.png'), fullPage: true });
  for (const width of [320, 390, 768, 1440]) {
    await customer.setViewportSize({ width, height: 900 });
    assert.equal(await customer.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `landing overflow ${width}`);
    if (width <= 390) {
      const copy = await customer.locator('.hero-copy').boundingBox();
      const photo = await customer.locator('.hero-visual').boundingBox();
      assert.ok(photo.x > copy.x && Math.abs(photo.y - copy.y) < 15, `Mobile hero stays side by side at ${width}`);
      await customer.locator('.hero-stage').screenshot({ path: join(output, `mobile-hero-${width}.png`) });
    }
  }
  await customer.goto(base + '/search');
  const services = customer.getByRole('navigation', { name: 'Browse services' });
  await services.getByRole('link', { name: 'Plumbers', exact: true }).click();
  await customer.waitForURL(/service=maintenance.*q=plumbing/);
  await waitFor(async () => await services.getByRole('link', { name: 'Plumbers', exact: true }).getAttribute('aria-current') === 'page', 'plumbing selected indicator');
  await services.getByRole('link', { name: 'Cleaners', exact: true }).click();
  await customer.waitForURL(/service=cleaning$/);
  await waitFor(async () => await services.getByRole('link', { name: 'Cleaners', exact: true }).getAttribute('aria-current') === 'page', 'cleaning selected indicator');
  await visible(customer.getByRole('heading', { name: 'Cleaning, taken care of.', exact: true }));
  await customer.setViewportSize({ width: 390, height: 844 });
  await services.screenshot({ path: join(output, 'service-icons-mobile.png') });
  await customer.setViewportSize({ width: 1440, height: 1000 });
  record('Mobile chat and landing fit the viewport; logout returns home and leaves the other browser signed in');

  // Preserve the local demo journey while identity changes go through server sessions.
  await choose(customer, 'customer');
  await customer.goto(base + '/book/w_kwame');
  await customer.getByLabel('What needs doing?').fill('E2E bathroom tiling');
  await customer.getByLabel('Details', { exact: true }).fill('Retile the bathroom floor and finish the edges with matching grout.');
  await customer.getByLabel('Area', { exact: true }).selectOption('East Legon');
  await customer.getByLabel('Preferred date', { exact: true }).fill(new Date(Date.now() + 2 * 86400000).toISOString().slice(0,10));
  await customer.getByLabel('Address or landmark').fill('Sample house by the junction');
  await customer.getByRole('button', { name: 'Send request to Kwame' }).click();
  await customer.waitForURL(/\/jobs\/SS-/);
  const jobId = customer.url().split('/').at(-1);
  await choose(customer, 'pro'); await customer.goto(base + '/work/jobs/' + jobId);
  await customer.getByRole('button', { name: 'Accept and set price' }).click();
  await customer.getByLabel('Your price for the whole job').fill('1000');
  await customer.getByRole('button', { name: 'Send price to Ama' }).click();
  await visible(customer.getByText('Accepted · awaiting payment', { exact: true }));
  await choose(customer, 'customer'); await customer.goto(base + '/jobs/' + jobId);
  await customer.getByRole('button', { name: /^Pay GH₵/ }).click();
  let dialog = customer.getByRole('dialog');
  await dialog.getByRole('button', { name: /^Pay GH₵/ }).click();
  await dialog.getByRole('button', { name: 'Approve on phone' }).click();
  await visible(dialog.getByRole('heading', { name: 'Payment held', exact: true }));
  await dialog.getByRole('button', { name: 'Back to the job' }).click();
  await choose(customer, 'pro'); await customer.goto(base + '/work/jobs/' + jobId);
  await customer.getByRole('button', { name: 'Mark job complete' }).click();
  await customer.getByLabel('What did you do?').fill('All tiles laid and grouted. Site cleaned.');
  await customer.getByRole('button', { name: 'Mark complete', exact: true }).click();
  await visible(customer.getByText('Done · awaiting check', { exact: true }));
  await choose(customer, 'customer'); await customer.goto(base + '/jobs/' + jobId);
  await customer.getByRole('button', { name: 'Confirm and release payment', exact: true }).click();
  await customer.getByRole('dialog').getByRole('button', { name: /^Yes, release/ }).click();
  await choose(customer, 'admin'); await customer.goto(base + '/admin/payouts');
  const card = customer.locator('section').filter({ has: customer.getByRole('heading', { name: 'E2E bathroom tiling', exact: true }) });
  await card.getByRole('button', { name: 'Review payout' }).click();
  await customer.getByRole('dialog').getByRole('button', { name: 'Simulate payout release' }).click();
  await waitFor(() => customer.evaluate((id) => JSON.parse(localStorage.getItem('siesie.db')).jobs.find((j) => j.id === id).status === 'closed', jobId), 'payout completed');
  await customer.reload();
  assert.equal(await customer.evaluate((id) => JSON.parse(localStorage.getItem('siesie.db')).jobs.find((j) => j.id === id).status, jobId), 'closed');
  record('Existing booking → quote → simulated MoMo payment → completion → confirmation → admin payout journey still works');

  // Expiry also clears cached private UI; no manually selected role bypasses the server.
  app.db.prepare("UPDATE sessions SET expires_at=0 WHERE user_id='w_kwame'").run();
  await pro.reload();
  await pro.waitForURL(/\/login\?/);
  assert.equal(await pro.getByRole('log').count(), 0);
  assert.deepEqual(errors, []);
  record('Expired sessions redirect out of private pages; no uncaught browser errors');
  await writeFile(join(output, 'results.json'), JSON.stringify({ passed, errors }, null, 2));
  console.log(`Completed ${passed.length} end-to-end groups.`);
} catch (error) {
  if (browser) for (const [i, context] of browser.contexts().entries()) { const page = context.pages()[0]; if (page) await page.screenshot({ path: join(output, `failure-${i}.png`), fullPage: true }).catch(() => {}); }
  console.error(error); process.exitCode = 1;
} finally {
  await browser?.close(); await app.close(); await rm(dir, { recursive: true, force: true });
}
