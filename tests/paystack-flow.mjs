// End-to-end Paystack flows: the Edge Functions' shared logic against the real
// migrations in PGlite, with a scripted fake of the Paystack API.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { applyCharge, handleWebhook, PaystackError, processPayouts, resolveDispute, retryPayout, startCheckout, bankCode } from '../supabase/functions/_shared/payments.ts';

const SECRET = 'sk_test_siesie_flow';
const db = new PGlite();
const ids = {
  customer: '10000000-0000-4000-8000-000000000001',
  other: '10000000-0000-4000-8000-000000000002',
  worker: '20000000-0000-4000-8000-000000000001',
  admin: '30000000-0000-4000-8000-000000000001',
};
let checks = 0;
const pass = (name) => { checks++; console.log('PASS ' + name); };
async function as(who, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${who === 'service' ? 'service_role' : who ? 'authenticated' : 'anon'}`);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [ids[who] || '']);
    return (await tx.query(sql, params)).rows;
  });
}
const action = async (who, name, input) => (await as(who, 'select public.siesie_action($1,$2::jsonb) as result', [name, JSON.stringify(input)]))[0].result;
const job = async (id) => (await db.query('select status,data from public.siesie_jobs where id=$1', [id])).rows[0];
const notices = async (who) => (await db.query('select text from public.siesie_notices where user_id=$1', [ids[who]])).rows.map((r) => r.text);

// ── Fake Paystack ───────────────────────────────────────────────────────────
const paystack = {
  calls: [], transactions: new Map(), transfers: new Map(), refunds: [], recipients: 0,
  transferPlan: [], // per POST /transfer: 'success' | 'pending' | 'otp' | 'insufficient' | 'timeout-sent' | 'timeout-lost'
  pay(reference, pesewas, status = 'success') {
    this.transactions.set(reference, { reference, amount: pesewas, currency: 'GHS', status, channel: 'mobile_money', authorization: { bank: 'MTN', last4: '4567' }, paid_at: '2026-10-17T09:00:00.000Z' });
  },
  async call(method, path, body) {
    this.calls.push({ method, path, body });
    const [route, query = ''] = path.split('?');
    if (method === 'POST' && route === '/transaction/initialize') return { authorization_url: `https://checkout.paystack.com/${body.reference}`, reference: body.reference };
    if (method === 'GET' && route.startsWith('/transaction/verify/')) {
      const tx = this.transactions.get(route.slice('/transaction/verify/'.length));
      if (!tx) throw new PaystackError('Transaction reference not found', 400, false);
      return tx;
    }
    if (method === 'POST' && route === '/refund') { this.refunds.push(body); return { id: this.refunds.length, status: 'pending' }; }
    if (method === 'GET' && route === '/bank') {
      return query.includes('mobile_money')
        ? [{ name: 'MTN Mobile Money', code: 'MTN' }, { name: 'Vodafone Cash', code: 'VOD' }, { name: 'AirtelTigo Money', code: 'ATL' }]
        : [{ name: 'GCB Bank Limited', code: '040100' }, { name: 'Ecobank Ghana Limited', code: '130100' }, { name: 'CalBank PLC', code: '140100' }];
    }
    if (method === 'POST' && route === '/transferrecipient') return { recipient_code: `RCP_${++this.recipients}`, details: body };
    if (method === 'POST' && route === '/transfer') {
      if (this.transfers.has(body.reference)) throw new PaystackError('Duplicate Transfer Reference', 400, false);
      const plan = this.transferPlan.shift() ?? 'success';
      if (plan === 'insufficient') throw new PaystackError('Your balance is not enough to fulfil this request', 400, false);
      if (plan === 'timeout-lost') throw new PaystackError('Paystack could not be reached.', 0, true);
      const transfer = { reference: body.reference, amount: body.amount, status: plan === 'timeout-sent' ? 'success' : plan, transfer_code: `TRF_${this.transfers.size + 1}` };
      this.transfers.set(body.reference, transfer);
      if (plan === 'timeout-sent') throw new PaystackError('Paystack could not be reached.', 0, true);
      return transfer;
    }
    if (method === 'GET' && route.startsWith('/transfer/verify/')) {
      const transfer = this.transfers.get(route.slice('/transfer/verify/'.length));
      if (!transfer) throw new PaystackError('Transfer not found', 404, false);
      return transfer;
    }
    throw new Error(`Unexpected Paystack call ${method} ${path}`);
  },
  count(method, route) { return this.calls.filter((c) => c.method === method && c.path.split('?')[0] === route).length; },
};
const deps = {
  rpc: async (name, input) => (await as('service', 'select public.siesie_payments($1,$2::jsonb) as result', [name, JSON.stringify(input)]))[0].result,
  paystack: (method, path, body) => paystack.call(method, path, body),
};
const sign = (body) => createHmac('sha512', SECRET).update(body).digest('hex');
const webhook = (event, data, signature) => { const raw = JSON.stringify({ event, data }); return handleWebhook(deps, SECRET, raw, signature ?? sign(raw)); };

let bookings = 0;
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
async function quotedJob(amount = 200) {
  const id = `SS-FLOW${String(++bookings).padStart(4, '0')}-0001`;
  await action('customer', 'request_booking', { id, workerId: ids.worker, service: 'tiling', title: `Tiling job ${bookings}`, scope: 'Retile the kitchen floor and finish the edges neatly.', area: 'East Legon', address: 'Private street address', preferredDate: tomorrow, photos: [] });
  await action('worker', 'accept', { jobId: id, amount, date: tomorrow, note: '' });
  return id;
}
async function paidJob(amount = 200) {
  const id = await quotedJob(amount);
  const { reference } = await startCheckout(deps, { jobId: id, userId: ids.customer, email: 'customer@example.com', origin: 'https://siesie-marketplace.vercel.app' });
  paystack.pay(reference, amount * 100);
  assert.equal((await applyCharge(deps, reference)).outcome, 'recorded');
  return id;
}
async function completedJob(amount = 200) {
  const id = await paidJob(amount);
  await action('worker', 'complete', { jobId: id, note: 'All done', photos: [] });
  return id;
}

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
  `);
  for (const file of (await readdir('supabase/migrations')).sort()) await db.exec(await readFile('supabase/migrations/' + file, 'utf8'));
  for (const [who, id] of Object.entries(ids)) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [id, JSON.stringify({ role: who === 'worker' ? 'worker' : 'customer', name: who, phone: '0241234567', area: 'East Legon' })]);
  await db.query("update public.siesie_profiles set role='admin' where id=$1", [ids.admin]);
  for (const name of ['front', 'portrait']) await as('worker', "insert into storage.objects(bucket_id,name) values('siesie-private',$1)", [`${ids.worker}/verification/${name}.jpg`]);
  await action('worker', 'register_worker', {
    name: 'Kwame Mensah', phone: '0241234567', services: ['tiling'], baseArea: 'East Legon', areas: ['East Legon'], bio: 'Tiling kitchens and bathrooms with careful attention to detail.', yearsExperience: 4,
    pricing: { mode: 'quote', from: 100, to: 500, unit: 'per job' }, availability: { days: [1, 2, 3], note: '' },
    payout: { type: 'momo', network: 'mtn', number: '0241234567', name: 'Kwame Mensah' },
    ghanaCardNumber: 'GHA-123456789-0', frontPhoto: `storage://siesie-private/${ids.worker}/verification/front.jpg`, selfie: `storage://siesie-private/${ids.worker}/verification/portrait.jpg`,
  });
  await action('admin', 'verify_worker', { workerId: ids.worker, approve: true, note: 'Documents checked' });

  // ── Collection ────────────────────────────────────────────────────────────
  await assert.rejects(as('customer', "select public.siesie_payments('confirm_due','{}')"), /permission denied/);
  await assert.rejects(as(null, "select public.siesie_payments('confirm_due','{}')"), /permission denied/);
  await assert.rejects(as('customer', 'select * from public.siesie_checkouts'), /permission denied/);
  const j1 = await quotedJob(200);
  await assert.rejects(startCheckout(deps, { jobId: j1, userId: ids.other, email: 'x@example.com', origin: 'https://siesie-marketplace.vercel.app' }), /Booking unavailable/);
  const checkout = await startCheckout(deps, { jobId: j1, userId: ids.customer, email: 'customer@example.com', origin: 'https://siesie-marketplace.vercel.app' });
  const init = paystack.calls.at(-1).body;
  assert.equal(init.amount, 20000); assert.equal(init.currency, 'GHS'); assert.deepEqual(init.channels, ['mobile_money', 'card']);
  assert.equal(init.callback_url, `https://siesie-marketplace.vercel.app/jobs/${j1}?payment=${checkout.reference}`);
  assert.equal(checkout.url, `https://checkout.paystack.com/${checkout.reference}`);
  pass('Only the server can touch payment state; checkout belongs to the customer and charges the quote in pesewas');

  assert.equal((await applyCharge(deps, checkout.reference)).outcome, 'not_paid');
  assert.equal(await webhook('charge.success', { reference: checkout.reference }, 'f'.repeat(128)), 401);
  paystack.pay(checkout.reference, 20000, 'abandoned');
  assert.equal(await webhook('charge.success', { reference: checkout.reference }), 200);
  assert.equal((await job(j1)).status, 'quoted', 'A signed event is re-verified; Paystack said the charge did not succeed');
  paystack.pay(checkout.reference, 20000);
  assert.equal(await webhook('charge.success', { reference: checkout.reference }), 200);
  let row = await job(j1);
  assert.equal(row.status, 'in_progress');
  assert.deepEqual({ ...row.data.payment, paidAt: undefined }, { reference: checkout.reference, amount: 200, channel: 'momo', network: 'mtn', payer: 'MoMo ••• 567', paidAt: undefined });
  assert.equal(await webhook('charge.success', { reference: checkout.reference }), 200);
  assert.equal((await applyCharge(deps, checkout.reference)).outcome, 'handled');
  assert.equal((await job(j1)).data.events.filter((e) => e.text.startsWith('Payment of')).length, 1, 'Replays apply the payment once');
  assert.ok((await notices('worker')).some((t) => t.startsWith('Payment secured')));
  pass('Payments apply only after a signed event or customer return is re-verified with Paystack, exactly once');

  const j2 = await quotedJob(150);
  const first = await startCheckout(deps, { jobId: j2, userId: ids.customer, email: 'customer@example.com', origin: 'https://siesie-marketplace.vercel.app' });
  const second = await startCheckout(deps, { jobId: j2, userId: ids.customer, email: 'customer@example.com', origin: 'https://siesie-marketplace.vercel.app' });
  paystack.pay(first.reference, 15000); paystack.pay(second.reference, 15000);
  assert.equal((await applyCharge(deps, first.reference)).outcome, 'recorded');
  assert.equal((await applyCharge(deps, second.reference)).outcome, 'refund');
  assert.deepEqual(paystack.refunds.at(-1), { transaction: second.reference });
  assert.equal((await db.query('select status from public.siesie_checkouts where reference=$1', [second.reference])).rows[0].status, 'refunded');
  const j3 = await quotedJob(120);
  const short = await startCheckout(deps, { jobId: j3, userId: ids.customer, email: 'customer@example.com', origin: 'https://siesie-marketplace.vercel.app' });
  paystack.pay(short.reference, 1000);
  assert.equal((await applyCharge(deps, short.reference)).outcome, 'refund');
  assert.equal((await job(j3)).status, 'quoted');
  const j4 = await quotedJob(90);
  const late = await startCheckout(deps, { jobId: j4, userId: ids.customer, email: 'customer@example.com', origin: 'https://siesie-marketplace.vercel.app' });
  await action('customer', 'cancel', { jobId: j4 });
  paystack.pay(late.reference, 9000);
  assert.equal((await applyCharge(deps, late.reference)).outcome, 'refund');
  assert.equal((await job(j4)).status, 'cancelled');
  assert.equal(paystack.refunds.length, 3);
  pass('Second payments, wrong amounts and payments for withdrawn bookings are refunded in full, never applied');

  // ── Payouts ───────────────────────────────────────────────────────────────
  await action('worker', 'complete', { jobId: j1, note: 'Floor finished', photos: [] });
  await action('customer', 'confirm', { jobId: j1 });
  assert.deepEqual([(await job(j1)).data.payout.gross, (await job(j1)).data.payout.commission, (await job(j1)).data.payout.net], [200, 20, 180]);
  paystack.transferPlan.push('pending');
  let summary = await processPayouts(deps);
  assert.equal(summary.processing, 1);
  const recipient = paystack.calls.find((c) => c.path === '/transferrecipient').body;
  assert.deepEqual(recipient, { type: 'mobile_money', name: 'Kwame Mensah', account_number: '0241234567', bank_code: 'MTN', currency: 'GHS' });
  const transfer = paystack.calls.find((c) => c.path === '/transfer').body;
  assert.deepEqual(transfer, { source: 'balance', amount: 18000, recipient: 'RCP_1', reference: `${j1.toLowerCase()}-p1`, currency: 'GHS', reason: `Siesie payout for ${j1}` });
  row = await job(j1);
  assert.equal(row.status, 'confirmed'); assert.equal(row.data.payout.status, 'sending'); assert.equal(row.data.payout.destination, 'MoMo 024 ••• 567');
  assert.equal((await processPayouts(deps)).claimed, 0, 'A transfer in flight is not sent twice');
  assert.equal(await webhook('transfer.success', { reference: `${j1.toLowerCase()}-p1`, transfer_code: 'TRF_1' }), 200);
  row = await job(j1);
  assert.equal(row.status, 'closed'); assert.equal(row.data.payout.status, 'sent');
  assert.ok((await notices('worker')).some((t) => t.startsWith('GH₵ 180.00 sent to MoMo 024 ••• 567')));
  assert.equal(await webhook('transfer.success', { reference: `${j1.toLowerCase()}-p1` }), 200);
  assert.equal((await job(j1)).data.events.filter((e) => e.text.startsWith('Payout of')).length, 1);
  pass('Confirming queues 90% for the worker; Siesie keeps 10% and the transfer closes the job once, on Paystack\'s word');

  const j5 = await completedJob(300);
  await action('customer', 'confirm', { jobId: j5 });
  paystack.transferPlan.push('insufficient');
  summary = await processPayouts(deps);
  assert.equal(summary.failed, 1);
  row = await job(j5);
  assert.equal(row.data.payout.status, 'failed'); assert.match(row.data.payout.failure, /balance is not enough/);
  assert.ok((await notices('admin')).some((t) => t.includes('failed: Your balance is not enough')));
  assert.equal(paystack.count('POST', '/transferrecipient'), 1, 'The recipient is reused while payout details are unchanged');
  await assert.rejects(retryPayout(deps, { jobId: j5, adminId: ids.customer }), /Admin access required/);
  summary = await retryPayout(deps, { jobId: j5, adminId: ids.admin });
  assert.equal(summary.sent, 1);
  row = await job(j5);
  assert.equal(row.status, 'closed'); assert.equal(row.data.payout.reference, `${j5.toLowerCase()}-p2`);
  await assert.rejects(retryPayout(deps, { jobId: j5, adminId: ids.admin }), /Only a failed payout/);
  pass('A failed transfer alerts admins; only an admin can retry it, under a new transfer reference');

  const j6 = await completedJob(100);
  await action('customer', 'confirm', { jobId: j6 });
  paystack.transferPlan.push('timeout-sent');
  assert.equal((await processPayouts(deps)).unresolved, 1);
  assert.equal((await job(j6)).data.payout.status, 'sending');
  assert.equal((await processPayouts(deps)).claimed, 0);
  await db.query(`update public.siesie_jobs set data=jsonb_set(data,'{payout,claimedAt}',to_jsonb(now()-interval '11 minutes')) where id=$1`, [j6]);
  assert.equal((await processPayouts(deps)).sent, 1);
  assert.equal(paystack.calls.filter((c) => c.path === '/transfer' && c.body.reference === `${j6.toLowerCase()}-p1`).length, 1, 'An unanswered transfer that went through is never sent again');
  assert.equal((await job(j6)).status, 'closed');
  const j7 = await completedJob(100);
  await action('customer', 'confirm', { jobId: j7 });
  paystack.transferPlan.push('timeout-lost');
  assert.equal((await processPayouts(deps)).unresolved, 1);
  await db.query(`update public.siesie_jobs set data=jsonb_set(data,'{payout,claimedAt}',to_jsonb(now()-interval '11 minutes')) where id=$1`, [j7]);
  assert.equal((await processPayouts(deps)).sent, 1);
  assert.equal(paystack.transfers.get(`${j7.toLowerCase()}-p1`).status, 'success');
  pass('Unanswered transfers are checked with Paystack before any resend, so a timeout never pays twice');

  const j8 = await completedJob(250);
  await db.query(`update public.siesie_jobs set data=jsonb_set(data,'{confirmBy}',to_jsonb(now()-interval '1 minute')) where id=$1`, [j8]);
  summary = await processPayouts(deps);
  assert.equal(summary.confirmed, 1); assert.equal(summary.sent, 1);
  row = await job(j8);
  assert.equal(row.status, 'closed'); assert.equal(row.data.autoConfirmed, true); assert.equal(row.data.payout.net, 225);
  pass('An inspection window that runs out confirms the job and pays the worker automatically');

  const j9 = await paidJob(200);
  await action('customer', 'dispute', { jobId: j9, reason: 'poor_quality', details: 'Several tiles are loose and uneven.', evidence: [] });
  await assert.rejects(resolveDispute(deps, { jobId: j9, adminId: ids.worker, toWorker: 200, note: 'Trying to pay myself the full amount.' }), /Admin access required/);
  await assert.rejects(resolveDispute(deps, { jobId: j9, adminId: ids.admin, toWorker: 250, note: 'More than the customer paid here.' }), /between zero and the held amount/);
  const result = await resolveDispute(deps, { jobId: j9, adminId: ids.admin, toWorker: 120, note: 'Half the floor needs redoing; split agreed by phone.' });
  assert.equal(result.refunded, true); assert.equal(result.payouts.sent, 1);
  const paid = await job(j9);
  assert.deepEqual(paystack.refunds.at(-1), { transaction: paid.data.payment.reference, amount: 8000 });
  assert.equal(paid.status, 'closed'); assert.equal(paid.data.dispute.resolution.outcome, 'split');
  assert.equal(paid.data.refund.amount, 80); assert.equal(paid.data.refund.status, 'pending');
  assert.equal(paid.data.payout.net, 108); assert.equal(paid.data.payout.status, 'sent');
  assert.equal(await webhook('refund.processed', { transaction_reference: paid.data.payment.reference, id: 3 }), 200);
  assert.equal((await job(j9)).data.refund.status, 'processed');
  await assert.rejects(resolveDispute(deps, { jobId: j9, adminId: ids.admin, toWorker: 0, note: 'A second decision on the same case.' }), /already been resolved/);
  pass('Dispute decisions refund the customer\'s share through Paystack and pay the worker the rest less commission');

  await db.query(`update public.siesie_worker_private set payout='{"type":"bank","bank":"GCB Bank","number":"1234567890123","name":"Kwame Mensah"}' where id=$1`, [ids.worker]);
  const j10 = await completedJob(400);
  await action('customer', 'confirm', { jobId: j10 });
  assert.equal((await processPayouts(deps)).sent, 1);
  assert.deepEqual(paystack.calls.filter((c) => c.path === '/transferrecipient').at(-1).body, { type: 'ghipss', name: 'Kwame Mensah', account_number: '1234567890123', bank_code: '040100', currency: 'GHS' });
  assert.equal((await job(j10)).data.payout.destination, 'GCB Bank ••0123');
  assert.equal(bankCode('Ecobank Ghana', [{ name: 'Ecobank Ghana Limited', code: '130100' }, { name: 'GCB Bank Limited', code: '040100' }]), '130100');
  assert.equal(bankCode('Unknown Savings', [{ name: 'GCB Bank Limited', code: '040100' }]), null);
  pass('Changed payout details get a new Paystack recipient; bank names map to Paystack bank codes');

  console.log(`Completed ${checks} Paystack flow groups.`);
} catch (error) { console.error(error); process.exitCode = 1; }
finally { await db.close(); }
