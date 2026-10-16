// Extended compatibility checks for the existing browser-local demo journeys.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../server/index.mjs';

const directory = await mkdtemp(join(tmpdir(), 'siesie-marketplace-'));
const app = await startServer({ port: 0, databasePath: join(directory, 'test.sqlite'), dev: true, testMode: true });
const base = `http://127.0.0.1:${app.server.address().port}`;
await mkdir('test-results', { recursive: true });
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const visit = async (path) => { await page.goto(base + path); await page.waitForLoadState('networkidle'); };
  const role = async (name) => {
    if (await page.getByRole('button', { name: 'Switch view' }).isVisible()) await page.getByRole('button', { name: 'Switch view' }).click();
    await page.getByRole('button', { name: `View prototype as ${name}`, exact: true }).click();
    await page.waitForURL(base + ({ customer: '/jobs', pro: '/work', admin: '/admin' })[name]);
  };
  await visit('/');
  const results = await page.evaluate(`(${await readFile('tests/store_contract.js', 'utf8')})()`);
  results.forEach((result) => console.log('PASS ' + result));
  await visit('/'); await role('admin');
  await visit('/admin/disputes/SS-10455');
  await page.getByLabel('Decision', { exact: true }).selectOption('split');
  await page.getByLabel('Worker allocation before fee (GH₵)').fill('400');
  await page.getByLabel('Reason for the decision').fill('Pay for the pipe repair; refund the unfinished ceiling repair.');
  await page.getByRole('button', { name: 'Review decision' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Record test resolution' }).click();
  await page.getByRole('heading', { name: 'Decision recorded', exact: true }).waitFor();
  await visit('/admin/transactions');
  await page.getByLabel('Search transactions').fill('SS-10455');
  await page.getByLabel('Payment state').selectOption('split');
  assert.equal(await page.locator('summary').count(), 1);
  await page.locator('summary').click();
  await page.getByRole('heading', { name: 'Payment record' }).waitFor();
  console.log('PASS Dispute decision, filtered transaction and receipt journey');

  await visit('/join');
  await page.getByLabel('Full name', { exact: true }).fill('QA Sample Worker');
  await page.getByLabel('Phone number', { exact: true }).fill('0249876540');
  await page.locator('label').filter({ has: page.getByRole('checkbox', { name: 'Cleaning', exact: true }) }).click();
  await page.getByLabel('About your work').fill('I offer careful home cleaning and reliable deep cleaning services.');
  await page.getByLabel('Base area', { exact: true }).selectOption('East Legon');
  await page.getByLabel('Payout phone number').fill('0249876540');
  await page.getByLabel('Account holder name').fill('QA Sample Worker');
  await page.getByLabel('Ghana Card number').fill('GHA-123456789-0');
  const sample = { name: 'sample.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3foAAAAASUVORK5CYII=', 'base64') };
  await page.getByLabel('Add ID photo', { exact: true }).setInputFiles(sample);
  await page.getByLabel('Add portrait', { exact: true }).setInputFiles(sample);
  await page.getByRole('button', { name: 'Submit for verification' }).click();
  await page.waitForURL(base + '/work');
  const { session } = await (await page.request.get(base + '/api/session')).json();
  assert.equal(session.role, 'worker');
  await role('admin'); await visit('/admin/verifications');
  const application = page.locator('section').filter({ has: page.getByRole('heading', { name: 'QA Sample Worker', exact: true }) });
  await application.getByRole('button', { name: 'Review application' }).click();
  await page.getByRole('checkbox', { name: /I reviewed the submitted documents/ }).check();
  await page.getByRole('button', { name: 'Approve worker', exact: true }).click();
  await visit('/workers/' + session.userId);
  await page.getByRole('heading', { name: 'QA Sample Worker', exact: true }).waitFor();
  console.log('PASS Worker registration, sample uploads, local verification and public profile journey');

  await role('pro'); await visit('/work/profile');
  await page.getByLabel('About your work').fill('Updated tiling profile with bathroom and kitchen installation experience.');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await page.reload();
  assert.equal(await page.getByLabel('About your work').inputValue(), 'Updated tiling profile with bathroom and kitchen installation experience.');
  console.log('PASS Profile edits remain durable in the original local demo');
  const routes = {
    pro: ['/work', '/work/jobs', '/work/jobs/SS-10482', '/work/earnings', '/work/profile'],
    admin: ['/admin', '/admin/verifications', '/admin/payouts', '/admin/disputes', '/admin/disputes/SS-10455', '/admin/transactions', '/admin/settings'],
    customer: ['/', '/search', '/workers/w_kwame', '/book/w_kwame', '/jobs', '/join', '/login'],
  };
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [account, paths] of Object.entries(routes)) {
      await role(account);
      for (const path of paths) {
        await visit(path);
        assert.ok(await page.getByRole('heading', { level: 1 }).count(), `Missing heading: ${path}`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Overflow ${path} at ${width}`);
      }
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS Existing routes render on desktop and mobile without page errors');
} catch (error) {
  const page = browser?.contexts()[0]?.pages()[0];
  if (page) await page.screenshot({ path: 'test-results/marketplace-failure.png', fullPage: true });
  console.error(error); process.exitCode = 1;
} finally {
  await browser?.close(); await app.close(); await rm(directory, { recursive: true, force: true });
}
