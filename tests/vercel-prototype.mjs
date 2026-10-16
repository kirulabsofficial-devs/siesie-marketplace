import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { chromium } from 'playwright';

// Serve only static files, following the Vercel rewrite. There is deliberately
// no API here, so using the server transport makes this regression fail.
const root = resolve('vercel-dist');
const config = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'));
assert.deepEqual(config.rewrites, [{ source: '/(.*)', destination: '/index.html' }]);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
let apiRequests = 0;
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.startsWith('/api/')) { apiRequests++; res.writeHead(404); res.end('No API deployed'); return; }
    const file = resolve(root, '.' + decodeURIComponent(pathname));
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    const target = await stat(file).then((info) => info.isFile() ? file : resolve(root, 'index.html')).catch(() => resolve(root, 'index.html'));
    res.setHeader('Content-Type', mime[extname(target)] || 'application/octet-stream');
    res.end(await readFile(target));
  } catch { res.writeHead(500); res.end(); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
await mkdir('test-results', { recursive: true });
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const visit = async (path) => { await page.goto(base + path); await page.waitForLoadState('networkidle'); };
  const logout = async () => {
    await page.getByRole('button', { name: 'Log out of prototype', exact: true }).click();
    await page.waitForURL(base + '/');
    await page.getByRole('link', { name: 'Log in', exact: true }).waitFor();
  };
  const choose = async (role) => {
    const switcher = page.getByRole('button', { name: 'Switch view', exact: true });
    if (await switcher.isVisible()) await switcher.click();
    await page.getByRole('button', { name: `View prototype as ${role}`, exact: true }).click();
    await page.waitForURL(base + ({ customer: '/jobs', pro: '/work', admin: '/admin' })[role]);
  };
  const login = async (phone) => {
    await page.getByLabel('Phone number', { exact: true }).fill(phone);
    await page.getByRole('button', { name: 'Send code', exact: true }).click();
    await page.getByLabel('6-digit code', { exact: true }).fill('123456');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  };
  const send = async (body) => {
    await page.getByRole('textbox', { name: 'Write a message', exact: true }).fill(body);
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await page.getByRole('log').getByText(body, { exact: true }).waitFor();
  };
  await visit('/');
  await page.getByRole('heading', { name: 'Your home. Sorted.', exact: true }).waitFor();
  await page.getByRole('button', { name: 'View prototype as customer', exact: true }).waitFor();
  assert.equal(await page.getByRole('alert').count(), 0);
  const dock = page.getByRole('navigation', { name: 'Primary', exact: true });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (width < 1024) for (const label of ['Home', 'Explore', 'Bookings', 'Messages', 'Account']) {
      assert.equal(await dock.getByRole('link', { name: label, exact: true }).isVisible(), true);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Overflow at ${width}`);
  }
  await page.screenshot({ path: 'test-results/vercel-home-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/vercel-home-mobile.png' });
  await dock.getByRole('link', { name: 'Explore', exact: true }).click();
  await page.waitForURL(base + '/search');
  await page.reload();
  await dock.getByRole('link', { name: 'Home', exact: true }).click();
  await page.waitForURL(base + '/');
  console.log('PASS Static landing and public routes work without an API; guest navigation fits mobile and desktop.');

  await dock.getByRole('link', { name: 'Bookings', exact: true }).click();
  await page.getByRole('heading', { name: 'Log in or sign up', exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('next'), '/jobs');
  await login('0249876512');
  await page.getByRole('heading', { name: 'Create your account', exact: true }).waitFor();
  await page.getByLabel('Your name', { exact: true }).fill('Vercel Sample Customer');
  await page.getByLabel('Your area', { exact: true }).selectOption('East Legon');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.waitForURL(base + '/jobs');
  await page.reload();
  await page.getByRole('heading', { name: 'My jobs', exact: true }).waitFor();
  await visit('/book/w_kwame');
  await page.getByLabel('What needs doing?').fill('Vercel sample booking');
  await page.getByLabel('Details', { exact: true }).fill('A sample bathroom floor tiling request for the static prototype.');
  await page.getByLabel('Area', { exact: true }).selectOption('East Legon');
  await page.getByLabel('Preferred date', { exact: true }).fill(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
  await page.getByLabel('Address or landmark').fill('Sample house near the junction');
  await page.getByRole('button', { name: 'Send request', exact: true }).click();
  await page.waitForURL(/\/jobs\/SS-/);
  const bookingUrl = page.url();
  await page.reload();
  await page.getByRole('heading', { name: 'Vercel sample booking', exact: true }).waitFor();
  await logout();
  await page.goto(bookingUrl);
  await page.getByRole('heading', { name: 'Log in or sign up', exact: true }).waitFor();
  await login('0249876512');
  await page.waitForURL(bookingUrl);
  await page.getByRole('heading', { name: 'Vercel sample booking', exact: true }).waitFor();
  console.log('PASS New account, booking, reload, logout and returning through a protected deep link.');

  await choose('customer');
  await visit('/messages?to=w_kwame');
  await page.waitForURL(/\/messages\/[a-z0-9-]+$/);
  const conversationId = page.url().split('/').at(-1);
  await send('Hello from the Vercel prototype.');
  await page.reload();
  await page.getByRole('log').getByText('Hello from the Vercel prototype.', { exact: true }).waitFor();
  await choose('pro');
  await visit('/work/messages/' + conversationId);
  await page.getByRole('log').getByText('Hello from the Vercel prototype.', { exact: true }).waitFor();
  await send('Your message is saved in this browser.');
  await choose('customer');
  await visit('/messages/' + conversationId);
  await page.getByRole('log').getByText('Your message is saved in this browser.', { exact: true }).waitFor();
  await page.locator('.outgoing').filter({ hasText: 'Hello from the Vercel prototype.' }).getByText('Read', { exact: true }).waitFor();
  await page.screenshot({ path: 'test-results/vercel-messages-mobile.png' });
  await choose('admin');
  await page.getByRole('heading', { level: 1 }).waitFor();
  console.log('PASS Customer/pro messaging, reply, read receipt and admin view on static hosting.');

  const isolated = await browser.newContext();
  const other = await isolated.newPage();
  other.on('pageerror', (error) => errors.push(error.message));
  await other.goto(base);
  await other.getByRole('link', { name: 'Log in', exact: true }).waitFor();
  await other.getByRole('button', { name: 'View prototype as customer', exact: true }).click();
  await other.waitForURL(base + '/jobs');
  await other.goto(base + '/messages');
  await other.getByRole('heading', { name: 'A little hello. A great start.', exact: true }).waitFor();
  assert.equal(await other.getByText('Hello from the Vercel prototype.', { exact: true }).count(), 0);
  await isolated.close();
  await logout();
  await page.reload();
  await page.getByRole('link', { name: 'Log in', exact: true }).waitFor();
  assert.equal(apiRequests, 0, 'A static build must never request an undeployed API');
  assert.deepEqual(errors, []);
  console.log('PASS Visitors have independent browser data; logout survives reload; zero API requests or page errors.');
} catch (error) {
  const page = browser?.contexts()[0]?.pages()[0];
  if (page) await page.screenshot({ path: 'test-results/vercel-failure.png', fullPage: true });
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
}
