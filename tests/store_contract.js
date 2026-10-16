async () => {
  const s = await import('/src/data/store.ts');
  const passed = [];
  function assert(value, message) { if (!value) throw new Error(message); }
  async function fails(action, message) {
    const before = JSON.stringify(s.getDb());
    let threw = false;
    try { await action(); } catch { threw = true; }
    assert(threw, message);
    assert(JSON.stringify(s.getDb()) === before, `Rejected action mutated state: ${message}`);
  }
  const actor = (role, id) => s.signIn(role, id ?? ({customer:'c_ama',worker:'w_kwame',admin:'a_adjoa'})[role]);
  const tomorrow = new Date(Date.now() + 86400_000).toISOString();
  const input = { customerId:'c_ama',workerId:'w_kwame',service:'tiling',title:'Contract test tiling',scope:'Install tiles on the kitchen wall and finish the grout.',address:'East Legon, sample house',area:'East Legon',preferredDate:tomorrow,photos:[] };
  const job = (id) => s.getDb().jobs.find((j) => j.id === id);
  let reference = 0;
  function payment(id, amount = 1000) { s.recordPayment(id, {reference:`test-pay-${++reference}`,amount,channel:'momo',network:'mtn',payer:'024 *** 456'}); }
  async function paidJob() {
    await actor('customer'); const id = s.requestBooking(input);
    await actor('worker'); s.acceptRequest(id, 1000, tomorrow, 'Labour included.');
    await actor('customer'); payment(id); return id;
  }

  s.resetDemo();
  await actor('customer');
  await fails(() => s.requestBooking({...input, workerId:'missing'}), 'Unknown worker accepted');
  await fails(() => s.requestBooking({...input, area:'Unknown town'}), 'Unsupported area accepted');
  await fails(() => s.requestBooking({...input, customerId:'c_kojo'}), 'Customer impersonation accepted');
  await fails(() => s.requestBooking({...input, preferredDate:'2000-01-01'}), 'Past booking date accepted');
  const id = s.requestBooking(input);
  await fails(() => s.acceptRequest(id, 1000, tomorrow, ''), 'Customer accepted worker request');
  await actor('worker','w_yaw');
  await fails(() => s.acceptRequest(id, 1000, tomorrow, ''), 'Another worker accepted the request');
  await actor('worker');
  for (const amount of [NaN, Infinity, 0, -1, 0.001, 1_000_001]) await fails(() => s.acceptRequest(id, amount, tomorrow, ''), `Invalid price ${amount}`);
  await fails(() => s.acceptRequest(id, 1000, 'not-a-date', ''), 'Invalid quote date accepted');
  const originalPct = s.getDb().settings.commissionPct;
  s.acceptRequest(id, 1000, tomorrow, 'Includes labour.');
  await actor('admin'); s.updateSettings({commissionPct:20,confirmWindowHours:72});
  await actor('customer');
  await fails(() => payment(id, 999), 'Mismatched payment accepted');
  payment(id);
  await fails(() => payment(id), 'Duplicate job payment accepted');
  await fails(() => s.confirmCompletion(id), 'Customer confirmed before worker completion');
  await actor('admin'); await fails(() => s.releasePayout(id, 'early-transfer'), 'Early payout released');
  await actor('worker'); s.markComplete(id, 'Finished and cleaned the site.', []);
  const deadline = job(id).confirmBy;
  await actor('admin'); s.updateSettings({commissionPct:25,confirmWindowHours:24});
  assert(job(id).confirmBy === deadline, 'Existing inspection deadline changed');
  await actor('customer'); s.confirmCompletion(id);
  assert(job(id).payout.commission === 1000 * originalPct / 100, 'Agreed fee changed after settings update');
  assert(job(id).payout.net + job(id).payout.commission === 1000, 'Payout did not reconcile');
  await fails(() => s.releasePayout(id, 'transfer-1'), 'Customer could release admin payout');
  await fails(() => s.leaveReview(id, 'customer', 6, ''), 'Invalid star rating accepted');
  s.leaveReview(id, 'customer', 5, 'Good work.');
  await fails(() => s.leaveReview(id, 'customer', 5, ''), 'Duplicate review accepted');
  await actor('admin'); s.releasePayout(id, 'transfer-1');
  await fails(() => s.releasePayout(id, 'transfer-2'), 'Payout sent twice');
  assert(job(id).status === 'closed', 'Paid job not closed');
  passed.push('Ownership, invalid amounts/dates, payment matching, release ordering, duplicate payout/review rejection');
  passed.push('Commission snapshot and existing inspection deadline survive settings changes');

  const disputeId = await paidJob();
  s.openDispute(disputeId, 'poor_quality', 'The tiles are loose and the grout is incomplete.', []);
  await actor('worker'); s.respondToDispute(disputeId, 'I can return to repair the remaining tiles.', []);
  await actor('admin');
  await fails(() => s.releasePayout(disputeId, 'blocked-transfer'), 'Disputed funds released through normal queue');
  await fails(() => s.resolveDispute(disputeId, NaN, 'Decision based on inspection.', ''), 'NaN split accepted');
  await fails(() => s.resolveDispute(disputeId, 1001, 'Decision based on inspection.', ''), 'Over-allocation accepted');
  await fails(() => s.resolveDispute(disputeId, 700, 'short', 't2'), 'Missing decision reason accepted');
  s.resolveDispute(disputeId, 700, 'Refund the unfinished portion, pay for completed tiling.', 'split-transfer');
  assert(job(disputeId).payout.net + job(disputeId).payout.commission + job(disputeId).refund.amount === 1000, 'Split did not conserve funds');
  assert(s.escrowState(job(disputeId)) === 'split', 'Split not displayed');
  await fails(() => s.resolveDispute(disputeId, 700, 'Repeat the earlier decision.', 't3'), 'Dispute resolved twice');
  passed.push('Dispute freeze, worker response, split reconciliation and repeat-resolution rejection');

  for (const [amount, expected] of [[0,'refunded'],[1000,'released']]) {
    const j = await paidJob();
    s.openDispute(j, 'unfinished', 'A decision is needed after inspecting the work.', []);
    await actor('admin');
    s.resolveDispute(j, amount, 'Inspected the evidence and recorded the agreed outcome.', `outcome-${amount}`);
    assert(s.escrowState(job(j)) === expected, `Incorrect ${expected} outcome`);
    assert((job(j).payout?.net ?? 0) + (job(j).payout?.commission ?? 0) + (job(j).refund?.amount ?? 0) === 1000, 'Resolution lost funds');
  }
  passed.push('Full-refund and full-release outcomes reconcile');

  const due = await paidJob(); await actor('worker'); s.markComplete(due, 'Complete.', []);
  const frozen = await paidJob(); s.openDispute(frozen, 'unfinished', 'The work is incomplete, please investigate.', []);
  const originalNow = Date.now;
  try { Date.now = () => originalNow() + 200 * 3600_000; s.sweepExpiredWindows(); }
  finally { Date.now = originalNow; }
  assert(job(due).status === 'confirmed' && job(due).payout.status === 'queued', 'Expired work not queued');
  assert(job(frozen).status === 'disputed' && !job(frozen).payout, 'Sweep released disputed funds');
  const events = job(due).events.length;
  s.sweepExpiredWindows(); assert(job(due).events.length === events, 'Sweep queued duplicate payout');
  passed.push('Inspection expiry queues once and leaves disputed funds frozen');

  await actor('admin');
  for (const settings of [{commissionPct:NaN,confirmWindowHours:48},{commissionPct:31,confirmWindowHours:48},{commissionPct:12,confirmWindowHours:0},{commissionPct:12,confirmWindowHours:24.5}]) await fails(() => s.updateSettings(settings), 'Invalid settings accepted');
  const pending = s.getDb().workers.find((w) => w.verification === 'pending');
  if (pending && !pending.ghanaCard?.frontPhoto) await fails(() => s.reviewVerification(pending.id, true, ''), 'Applicant approved without documents');
  const profile = structuredClone(s.getDb().workers.find((w) => w.id === 'w_kwame'));
  const registration = {...profile, phone:'024' + String(Date.now()).slice(-7),name:'Test Applicant',ghanaCardNumber:'GHA-123456789-0',frontPhoto:'data:image/png;base64,test',selfie:'data:image/png;base64,test'};
  await fails(() => s.registerWorker({...registration,phone:profile.phone}), 'Duplicate phone registered');
  const newId = await s.registerWorker(registration);
  assert(s.getDb().workers.find((w) => w.id === newId).verification === 'pending', 'New worker not pending');
  await fails(() => s.updateWorker('w_kwame',{bio:'Trying to change another worker profile.'}), 'Another worker profile updated');
  await fails(() => s.updateWorker(newId,{pricing:{mode:'quote',from:500,to:50,unit:'per job'}}), 'Reversed price range accepted');
  await actor('admin'); s.reviewVerification(newId, false, 'Please provide a clearer identity photo.');
  await actor('worker',newId); s.resubmitVerification(newId,'GHA-123456789-0');
  await actor('admin'); s.reviewVerification(newId,true,'Identity documents reviewed.');
  assert(s.getDb().workers.find((w) => w.id === newId).verification === 'verified', 'Verification did not complete');
  passed.push('Settings bounds, registration validation, profile ownership and verification/resubmission cycle');
  const saved = JSON.parse(localStorage.getItem('siesie.db'));
  assert(saved.jobs.find((j) => j.id === id).payout.reference === 'transfer-1', 'Payout not persisted');
  passed.push('Local persistence of completed payout records');
  s.resetDemo();
  await actor('customer');
  return passed;
}
