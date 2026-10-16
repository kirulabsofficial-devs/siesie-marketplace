import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const ids = {
  customer: '10000000-0000-4000-8000-000000000001',
  other: '10000000-0000-4000-8000-000000000002',
  worker: '20000000-0000-4000-8000-000000000001',
  otherWorker: '20000000-0000-4000-8000-000000000002',
  admin: '30000000-0000-4000-8000-000000000001',
};
let checks = 0;
const pass = (name) => { checks++; console.log('PASS ' + name); };
async function as(who, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${who ? 'authenticated' : 'anon'}`);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [ids[who] || '']);
    return (await tx.query(sql, params)).rows;
  });
}
const action = async (who, name, input) => (await as(who, 'select public.siesie_action($1,$2::jsonb) as result', [name, JSON.stringify(input)]))[0].result;
const snapshot = async (who) => (await as(who, 'select public.siesie_snapshot() as result'))[0].result;
const chat = async (who, route, input = null, after = 0, limit = 100) => (await as(who, 'select public.siesie_chat($1,$2::jsonb,$3,$4) as result', [route, input === null ? null : JSON.stringify(input), after, limit]))[0].result;
const call = async (who, action, input = {}) => (await as(who, 'select public.siesie_call($1,$2::jsonb) as result', [action, JSON.stringify({ device: ids[who], ...input })]))[0].result;
try {
  // The managed auth/storage schemas are supplied by Supabase in deployment.
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
  pass('All migrations apply to an empty PostgreSQL database');
  for (const [who, id] of Object.entries(ids)) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [id, JSON.stringify({ role: who.includes('Worker') || who === 'worker' ? 'worker' : who === 'admin' ? 'admin' : 'customer', name: who, phone: '0241234567', area: 'East Legon' })]);
  assert.equal((await snapshot('admin')).session.role, 'customer', 'User metadata cannot grant admin access');
  await db.query("update public.siesie_profiles set role='admin' where id=$1", [ids.admin]);
  const guest = await snapshot(null);
  assert.equal(guest.session, null); assert.deepEqual(guest.jobs, []); assert.deepEqual(guest.workers, []);
  await assert.rejects(as(null, 'select * from public.siesie_profiles'), /permission denied/);
  await assert.rejects(as('customer', "update public.siesie_profiles set role='admin'"), /permission denied/);
  await assert.rejects(as('customer', 'select siesie_private.is_admin()'), /permission denied/);
  pass('Fresh database has no demo identities; guests and users cannot read tables or promote themselves');
  const photo = (user, folder, file) => `storage://siesie-private/${ids[user]}/${folder}/${file}.jpg`;
  const workerInput = {
    name: 'Real Worker', phone: '0241234567', services: ['tiling'], baseArea: 'East Legon', areas: ['East Legon'], bio: 'Tiling kitchens and bathrooms with careful attention to detail.', yearsExperience: 4,
    pricing: { mode: 'quote', from: 100, to: 500, unit: 'per job' }, availability: { days: [1,2,3], note: '' },
    payout: { type: 'momo', network: 'mtn', number: '0241234567', name: 'Real Worker' },
    ghanaCardNumber: 'GHA-123456789-0', frontPhoto: photo('worker','verification','front'), selfie: photo('worker','verification','portrait'),
  };
  for (const name of ['front','portrait']) await as('worker', "insert into storage.objects(bucket_id,name) values('siesie-private',$1)", [`${ids.worker}/verification/${name}.jpg`]);
  await assert.rejects(action('customer','register_worker',workerInput));
  await action('worker','register_worker',workerInput);
  assert.equal((await snapshot('worker')).workers[0].verification,'pending');
  assert.deepEqual((await snapshot(null)).workers,[]);
  await assert.rejects(action('worker','verify_worker',{workerId:ids.worker,approve:true,note:''}), /Admin/);
  await action('admin','verify_worker',{workerId:ids.worker,approve:true,note:'Documents checked'});
  const publicWorker=(await snapshot(null)).workers[0];
  assert.equal(publicWorker.verification,'verified'); assert.equal(publicWorker.phone,''); assert.equal(publicWorker.ghanaCard,null); assert.equal(publicWorker.payout.number,'');
  assert.equal((await as('other', "select * from storage.objects where bucket_id='siesie-private'")).length,0);
  assert.equal((await as('admin', "select * from storage.objects where bucket_id='siesie-private'")).length,2);
  await assert.rejects(as('other', "insert into storage.objects(bucket_id,name) values('siesie-private',$1)", [`${ids.worker}/verification/forged.jpg`]), /row-level security/);
  pass('Worker registration and admin verification keep identity images, phone and payout data private');
  const jid='SS-ABCDEF12-3456';
  const booking={id:jid,workerId:ids.worker,customerId:ids.other,service:'tiling',title:'Retile the bathroom',scope:'Install new bathroom floor tiles and finish all edges.',area:'East Legon',address:'Private customer street address',preferredDate:new Date(Date.now()+86400000).toISOString(),photos:[]};
  assert.equal(await action('customer','request_booking',booking),jid);
  assert.equal((await snapshot('customer')).jobs[0].customerId,ids.customer);
  assert.equal((await snapshot('worker')).jobs[0].address,'Shared after payment');
  assert.deepEqual((await snapshot('other')).jobs,[]);
  await assert.rejects(action('other','cancel',{jobId:jid}), /Booking unavailable/);
  await assert.rejects(action('customer','accept',{jobId:jid,amount:200,date:booking.preferredDate}), /not allowed/);
  await action('worker','accept',{jobId:jid,amount:200,date:booking.preferredDate,note:'Materials included'});
  assert.equal((await snapshot('customer')).jobs[0].status,'quoted');
  await assert.rejects(action('customer','recordPayment',{jobId:jid,amount:200}), /not allowed/);
  await assert.rejects(action('worker','complete',{jobId:jid,note:'Fake completion',photos:[]}), /not allowed/);
  await action('customer','cancel',{jobId:jid});
  assert.equal((await snapshot('worker')).jobs[0].status,'cancelled');
  await assert.rejects(action('worker','accept',{jobId:jid,amount:200,date:booking.preferredDate}), /not allowed/);
  pass('Bookings use the authenticated owner, enforce participant/state rules and reject client-forged payments');
  const c=(await chat('customer','/conversations',{peerId:ids.worker})).conversation;
  assert.equal((await chat('customer','/conversations',{peerId:ids.worker})).conversation.id,c.id);
  const message=(await chat('customer',`/conversations/${c.id}/messages`,{body:'Hello from a customer',clientId:'retry-1',senderId:ids.worker})).message;
  assert.equal(message.senderId,ids.customer);
  assert.equal((await chat('customer',`/conversations/${c.id}/messages`,{body:'Hello from a customer',clientId:'retry-1'})).message.id,message.id);
  await assert.rejects(chat('customer',`/conversations/${c.id}/messages`,{body:'Different retry',clientId:'retry-1'}), /already used/);
  await assert.rejects(chat('other',`/conversations/${c.id}/messages`), /unavailable/);
  await assert.rejects(chat('admin',`/conversations/${c.id}/messages`), /customer or professional/);
  assert.equal((await chat('worker','/conversations')).conversations[0].unreadCount,1);
  await chat('worker',`/conversations/${c.id}/read`,{messageId:message.id});
  assert.equal((await chat('worker','/conversations')).conversations[0].unreadCount,0);
  assert.equal((await chat('customer','/conversations')).conversations[0].peerReadCursor,message.sequence);
  await chat('worker',`/conversations/${c.id}/messages`,{body:'Hello from a professional',clientId:'reply'});
  const page=await chat('customer',`/conversations/${c.id}/messages`,null,0,1);
  assert.equal(page.messages.length,1); assert.equal(page.hasMore,true);
  pass('Shared messages enforce membership and sender identity, retries, unread counts, receipts and pagination');
  const callId=crypto.randomUUID();
  await assert.rejects(call('other','create',{callId,conversationId:c.id,mode:'voice'}), /conversation/);
  await assert.rejects(call('admin','sync'), /customer or pro/);
  const created=(await call('customer','create',{callId,conversationId:c.id,mode:'video'})).call;
  assert.equal(created.callerId,ids.customer); assert.equal(created.calleeId,ids.worker);
  assert.equal((await call('customer','create',{callId,conversationId:c.id,mode:'video'})).call.id,callId);
  await assert.rejects(call('worker','create',{callId:crypto.randomUUID(),conversationId:c.id,mode:'voice'}), /already on a call/);
  assert.equal((await call('worker','sync')).call.id,callId);
  await assert.rejects(call('customer','accept',{callId}), /already been/);
  await assert.rejects(call('other','sync',{callId}), /unavailable/);
  const signal={callId,kind:'offer',clientId:crypto.randomUUID(),payload:{type:'offer',sdp:'test-offer'}};
  await call('customer','signal',signal); await call('customer','signal',signal);
  assert.equal((await call('worker','sync',{callId})).signals.length,0,'SDP is not exposed before accepting');
  await call('worker','accept',{callId});
  assert.equal((await call('worker','sync',{callId})).signals.length,1);
  assert.equal((await call('worker','sync',{callId,device:ids.otherWorker})).owned,false);
  assert.equal((await call('worker','sync',{callId,device:ids.otherWorker})).signals.length,0);
  await assert.rejects(call('worker','end',{callId,device:ids.otherWorker}), /another device/);
  await assert.rejects(call('worker','signal',{...signal,clientId:crypto.randomUUID()}), /sender/);
  await call('worker','signal',{callId,kind:'answer',clientId:crypto.randomUUID(),payload:{type:'answer',sdp:'test-answer'}});
  assert.equal((await call('customer','sync',{callId})).signals[0].kind,'answer');
  for(let i=0;i<3;i++) assert.equal((await call('customer','relay',{callId})).allowed,true);
  await assert.rejects(call('customer','relay',{callId}), /limit reached/);
  await call('worker','end',{callId});
  assert.equal((await call('customer','sync',{callId})).call.state,'ended');
  assert.equal((await db.query('select * from public.siesie_call_signals where call_id=$1',[callId])).rows.length,0);
  await assert.rejects(call('customer','signal',signal), /ended/);
  const reverseId=crypto.randomUUID();
  await call('worker','create',{callId:reverseId,conversationId:c.id,mode:'voice'});
  await call('customer','decline',{callId:reverseId});
  assert.equal((await call('worker','sync',{callId:reverseId})).call.state,'declined');
  const missedId=crypto.randomUUID();
  await call('customer','create',{callId:missedId,conversationId:c.id,mode:'voice'});
  await db.query("update public.siesie_calls set created_at=now()-interval '46 seconds' where id=$1",[missedId]);
  assert.equal((await call('worker','sync',{callId:missedId})).call.state,'missed');
  assert.ok((await snapshot('worker')).notices.some(n=>n.text.includes('Missed voice call')));
  const disconnectedId=crypto.randomUUID();
  await call('worker','create',{callId:disconnectedId,conversationId:c.id,mode:'voice'});
  await call('customer','accept',{callId:disconnectedId});
  await db.query("update public.siesie_calls set caller_seen=now()-interval '91 seconds' where id=$1",[disconnectedId]);
  assert.equal((await call('customer','sync',{callId:disconnectedId})).call.state,'ended');
  await assert.rejects(as('customer','select * from public.siesie_call_signals'), /permission denied/);
  pass('Both call directions enforce membership, device ownership, busy limits, signaling privacy, expiry and relay limits');
  await assert.rejects(action('customer','settings',{commissionPct:0,confirmWindowHours:24}), /Admin/);
  await action('admin','settings',{commissionPct:12,confirmWindowHours:72});
  assert.equal((await snapshot('customer')).settings.commissionPct,12);
  await action('worker','read_notices',{userId:ids.customer});
  assert.ok((await snapshot('worker')).notices.every(n=>n.read));
  assert.ok((await snapshot('customer')).notices.some(n=>!n.read));
  pass('Admin settings and per-user notification updates are restricted');
  console.log(`Completed ${checks} Supabase contract groups.`);
} catch(error) { console.error(error.message); process.exitCode=1; }
finally { await db.close(); }
