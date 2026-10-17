import assert from 'node:assert/strict';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import { applyCharge, processPayouts, startCheckout } from '../supabase/functions/_shared/payments.ts';

// Isolated integration test: real PostgreSQL migrations, real UI and browser
// WebRTC; mocked Supabase HTTP auth/storage and local ICE instead of paid TURN.
// The payment Edge Functions run their real shared logic against a fake Paystack.
// This does not verify deployed Supabase, Paystack, email delivery or cross-network TURN.
process.env.VITE_SUPABASE_URL = 'https://siesie-test.supabase.co';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test_only';
const db = new PGlite();
const customer = '10000000-0000-4000-8000-000000000001';
const worker = '20000000-0000-4000-8000-000000000001';
const users = new Map();
let server, browser, lastPage, base;
// Fake Paystack: a checkout counts as paid once the browser has visited its page.
const paidCheckouts = new Map();
const paystack = async (method, path, body) => {
  const route = path.split('?')[0];
  if (method === 'POST' && route === '/transaction/initialize') { paidCheckouts.set(body.reference, { amount: body.amount, callback: body.callback_url, paid: false }); return { authorization_url: 'https://checkout.paystack.com/' + body.reference }; }
  if (method === 'GET' && route.startsWith('/transaction/verify/')) {
    const reference = route.split('/').at(-1), checkout = paidCheckouts.get(reference);
    return { reference, status: checkout?.paid ? 'success' : 'abandoned', amount: checkout?.amount ?? 0, currency: 'GHS', channel: 'mobile_money', authorization: { bank: 'MTN', last4: '4567' }, paid_at: new Date().toISOString() };
  }
  if (method === 'GET' && route === '/bank') return [{ name: 'MTN Mobile Money', code: 'MTN' }];
  if (method === 'POST' && route === '/transferrecipient') return { recipient_code: 'RCP_test' };
  if (method === 'POST' && route === '/transfer') return { reference: body.reference, status: 'success', transfer_code: 'TRF_test' };
  throw new Error('Unexpected Paystack call ' + method + ' ' + path);
};
const payments = {
  paystack,
  rpc: async (name, input) => db.transaction(async tx => { await tx.exec('set local role service_role'); return (await tx.query('select public.siesie_payments($1,$2::jsonb) as result', [name, JSON.stringify(input)])).rows[0].result; }),
};
const errors=[];
async function as(id, sql, params=[]) {
  return db.transaction(async tx => {
    await tx.exec(`set local role ${id ? 'authenticated':'anon'}`);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id || '']);
    return (await tx.query(sql,params)).rows;
  });
}
const jwt = id => ['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'test-signature'].join('.');
function account(id,email,name,role) {
  const user={id,email,role:'authenticated',aud:'authenticated',created_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{name,role,phone:'0241234567',area:'East Legon'}};
  users.set(id,user); return user;
}
const session = user => ({ access_token:jwt(user.id),refresh_token:'test-refresh-'+user.id,expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user });
const rpc = async (id,name,body) => {
  const routes={
    siesie_snapshot:['select public.siesie_snapshot() as result',[]],
    siesie_chat:['select public.siesie_chat($1,$2::jsonb,$3,$4) as result',[body.route,body.input == null ? null : JSON.stringify(body.input),body.after_sequence ?? 0,body.page_limit ?? 100]],
    siesie_action:['select public.siesie_action($1,$2::jsonb) as result',[body.action,JSON.stringify(body.input)]],
    siesie_call:['select public.siesie_call($1,$2::jsonb) as result',[body.action,JSON.stringify(body.input)]],
  };
  assert.ok(routes[name],`Unexpected RPC: ${name}`);
  return (await as(id,...routes[name]))[0].result;
};
async function context() {
  const ctx=await browser.newContext({viewport:{width:390,height:844},permissions:['microphone','camera']});
  await ctx.addInitScript(() => {
    window.__media=[]; window.__pcs=[];
    const media=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=async constraints => { const stream=await media(constraints); window.__media.push(stream); return stream; };
    const Peer=window.RTCPeerConnection;
    window.RTCPeerConnection=class extends Peer {
      constructor(config) { super({...config,iceServers:[],iceTransportPolicy:'all'}); window.__pcs.push(this); }
    };
  });
  await ctx.route('https://siesie-test.supabase.co/**',async route => {
    const req=route.request(),url=new URL(req.url());
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
    const respond=(data,status=200)=>route.fulfill({status,headers,body:JSON.stringify(data)});
    if(req.method()==='OPTIONS') return respond({});
    let id=null;
    const token=req.headers().authorization?.slice(7);
    if(token?.includes('.')) { try { id=JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub; } catch {} }
    let body={}; try { body=req.postDataJSON() || {}; } catch {}
    try {
      if(url.pathname==='/auth/v1/token') {
        const user=[...users.values()].find(u=>u.email===body.email);
        return user && body.password==='TestPassword123!' ? respond(session(user)) : respond({msg:'Invalid login credentials'},400);
      }
      if(url.pathname==='/auth/v1/signup') {
        const uid=crypto.randomUUID(); const user=account(uid,body.email,body.data.name,body.data.role);
        await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[uid,JSON.stringify(body.data)]);
        return respond(session(user));
      }
      if(url.pathname==='/auth/v1/user') return users.has(id) ? respond(users.get(id)) : respond({msg:'Invalid token'},401);
      if(url.pathname==='/auth/v1/logout') return respond({});
      if(url.pathname.startsWith('/rest/v1/rpc/')) return respond(await rpc(id,url.pathname.split('/').at(-1),body));
      if(url.pathname==='/functions/v1/paystack-checkout') {
        if(!users.has(id)) return respond({error:'Log in to pay.'},401);
        if(typeof body.verify==='string') return respond(await applyCharge(payments,body.verify));
        return respond({url:(await startCheckout(payments,{jobId:body.jobId,userId:id,email:users.get(id).email,origin:base})).url});
      }
      if(url.pathname==='/functions/v1/paystack-payouts') { await processPayouts(payments); return respond({ok:true}); }
      if(url.pathname==='/functions/v1/call-ice') {
        await rpc(id,'siesie_call',{action:'relay',input:body});
        return respond({iceServers:[{urls:'stun:127.0.0.1:9'}]});
      }
      throw new Error('Unexpected API route '+url.pathname);
    } catch(error) { if(process.env.DEBUG_TEST) console.error('API test error',url.pathname,error.message); return respond({message:error.message,error:error.message,code:error.code || 'TEST'},400); }
  });
  // Paying on Paystack's page: mark it paid and send the browser back, as Paystack does.
  await ctx.route('https://checkout.paystack.com/**',async route => {
    const checkout=paidCheckouts.get(new URL(route.request().url()).pathname.slice(1));
    if(!checkout) return route.fulfill({status:404,body:'Unknown checkout'});
    checkout.paid=true;
    return route.fulfill({status:302,headers:{location:checkout.callback}});
  });
  return ctx;
}
const stopped=async page=>page.waitForFunction(()=>window.__media.every(s=>s.getTracks().every(t=>t.readyState==='ended')));
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
    alter table storage.objects enable row level security; grant usage on schema storage to anon,authenticated;
    grant select,insert,update,delete on storage.objects to anon,authenticated;`);
  for(const file of (await readdir('supabase/migrations')).sort()) await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
  for(const user of [account(customer,'customer@example.test','Test Customer','customer'),account(worker,'pro@example.test','Test Pro','worker')]) {
    await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[user.id,JSON.stringify(user.user_metadata)]);
  }
  await db.query("update public.siesie_workers set verification='verified',data=$1 where id=$2",[JSON.stringify({services:['tiling'],areas:['East Legon'],baseArea:'East Legon',bio:'Experienced professional for bathroom tiling projects.',yearsExperience:4,pricing:{mode:'quote',from:100,to:500,unit:'per job'},availability:{days:[1,2,3],note:''},portfolio:[]}),worker]);
  const conversation=(await rpc(customer,'siesie_chat',{route:'/conversations',input:{peerId:worker}})).conversation.id;
  await mkdir('test-results',{recursive:true});
  await build({mode:'live',logLevel:'error',build:{outDir:'test-results/live-build',emptyOutDir:true}});
  server=await preview({mode:'live',logLevel:'error',build:{outDir:'test-results/live-build'},preview:{port:0,host:'127.0.0.1'}});
  base=server.resolvedUrls.local[0].replace(/\/$/,'');
  browser=await chromium.launch({headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
  const a=await context(),b=await context();
  const customerPage=await a.newPage(),proPage=await b.newPage();
  for(const page of [customerPage,proPage]) page.on('pageerror',error=>errors.push(error.message));
  await customerPage.goto(base+'/');
  await customerPage.getByRole('link',{name:'Bookings',exact:true}).click();
  await customerPage.waitForURL('**/login?**');
  await customerPage.getByRole('button',{name:'New to Siesie? Create an account',exact:true}).waitFor();
  console.log('PASS Guest booking navigation leads to real account login/signup');
  for(const [page,email,path] of [[customerPage,'customer@example.test',`/messages/${conversation}`],[proPage,'pro@example.test',`/work/messages/${conversation}`]]) {
    lastPage=page;
    await page.goto(base+`/login?as=${email.startsWith('pro')?'worker':'customer'}&next=${encodeURIComponent(path)}`);
    await page.getByLabel('Email address',{exact:true}).fill(email);
    await page.getByLabel('Password',{exact:true}).fill('TestPassword123!');
    await page.getByRole('button',{name:'Log in',exact:true}).click();
    await page.waitForURL(base+path);
    await page.getByRole('textbox',{name:'Write a message',exact:true}).waitFor();
  }
  await customerPage.getByRole('textbox',{name:'Write a message',exact:true}).fill('A real shared database message');
  await customerPage.getByRole('button',{name:'Send message',exact:true}).click();
  await proPage.getByRole('log').getByText('A real shared database message',{exact:true}).waitFor();
  console.log('PASS Independent logins and shared conversations use the live database RPCs');
  await customerPage.goto(base+`/book/${worker}`);
  await customerPage.getByLabel('What needs doing?',{exact:true}).fill('Retile our bathroom');
  await customerPage.getByLabel('Details',{exact:true}).fill('Replace the bathroom floor tiles and finish the edges neatly.');
  await customerPage.getByLabel('Area',{exact:true}).selectOption('East Legon');
  await customerPage.getByLabel('Preferred date',{exact:true}).fill(new Date(Date.now()+86400000).toISOString().slice(0,10));
  await customerPage.getByLabel('Address or landmark',{exact:true}).fill('14 Private Test Street');
  await customerPage.locator('button[type=submit][form=booking-form]').click();
  await customerPage.waitForURL('**/jobs/SS-*');
  const jobId=customerPage.url().split('/').at(-1);
  await proPage.goto(base+`/work/jobs/${jobId}`);
  await proPage.getByRole('button',{name:'Accept and set price',exact:true}).click();
  await proPage.getByLabel('Your price for the whole job',{exact:true}).fill('350');
  await proPage.getByRole('button',{name:'Send price to Test',exact:true}).click();
  await proPage.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal((await proPage.locator('body').innerText()).includes('14 Private Test Street'),false);
  await customerPage.reload();
  await customerPage.getByRole('button',{name:/^Pay /}).click();
  await customerPage.getByRole('button',{name:'Continue to Paystack',exact:true}).waitFor();
  await customerPage.screenshot({path:'test-results/live-paystack-dialog.png'});
  assert.equal((await db.query('select status from public.siesie_jobs where id=$1',[jobId])).rows[0].status,'quoted');
  console.log('PASS Booking and quote flow syncs across accounts; addresses stay private and checkout starts only on Paystack');
  await customerPage.getByRole('button',{name:'Continue to Paystack',exact:true}).click();
  await customerPage.waitForURL(new RegExp(`/jobs/${jobId}\\?payment=sie_[0-9a-f]{32}$`));
  await customerPage.getByRole('heading',{name:'Test is doing the job',exact:true}).waitFor();
  await customerPage.waitForURL(base+`/jobs/${jobId}`);
  await customerPage.getByText('Payment received. Siesie is holding it until you confirm the work.').waitFor();
  await customerPage.screenshot({path:'test-results/live-paystack-paid.png'});
  const paidJob=(await db.query('select status,data from public.siesie_jobs where id=$1',[jobId])).rows[0];
  assert.equal(paidJob.status,'in_progress'); assert.equal(paidJob.data.payment.amount,350); assert.equal(paidJob.data.payment.payer,'MoMo ••• 567');
  await proPage.goto(base+`/work/jobs/${jobId}`);
  await proPage.getByText('14 Private Test Street').first().waitFor();
  console.log('PASS Paying on Paystack returns to the job, which shows as paid only after the server verifies it; the address is then shared');
  await customerPage.goto(base+`/messages/${conversation}`);
  await proPage.goto(base+'/work/jobs');
  await customerPage.getByRole('button',{name:'Voice call Test Pro',exact:true}).click();
  await proPage.getByRole('button',{name:'Accept',exact:true}).click();
  await Promise.all([customerPage,proPage].map(p=>p.getByRole('status').filter({hasText:/^Connected$/}).waitFor()));
  await customerPage.getByRole('button',{name:'Mute microphone',exact:true}).click();
  assert.equal(await customerPage.evaluate(()=>window.__media.at(-1).getAudioTracks()[0].enabled),false);
  // Actual RTP flows between two PeerConnections; no fake connection state.
  await customerPage.waitForFunction(async()=>[...(await window.__pcs.at(-1).getStats()).values()].some(s=>s.type==='inbound-rtp'&&s.kind==='audio'&&s.packetsReceived>0));
  await customerPage.getByRole('button',{name:'End call',exact:true}).click();
  await proPage.getByText('Call ended',{exact:true}).waitFor();
  await stopped(customerPage); await stopped(proPage);
  console.log('PASS Customer-to-pro audio connects, receives RTP, mutes and stops both microphones on hang-up');
  await proPage.goto(base+`/work/messages/${conversation}`);
  await proPage.getByRole('button',{name:'Video call Test Customer',exact:true}).click();
  await customerPage.getByRole('button',{name:'Accept',exact:true}).click();
  await Promise.all([customerPage,proPage].map(p=>p.getByRole('status').filter({hasText:/^Connected$/}).waitFor()));
  await customerPage.waitForFunction(()=>{const video=document.querySelector('.call-remote-video');return video?.videoWidth>0;});
  await proPage.getByRole('button',{name:'Turn camera off',exact:true}).click();
  assert.equal(await proPage.evaluate(()=>window.__media.at(-1).getVideoTracks()[0].enabled),false);
  await customerPage.screenshot({path:'test-results/live-video-call.png'});
  await proPage.getByRole('button',{name:'End call',exact:true}).click();
  await customerPage.getByText('Call ended',{exact:true}).waitFor();
  await stopped(customerPage); await stopped(proPage);
  console.log('PASS Pro-to-customer video connects, renders remote frames and supports camera off and hang-up');
  await customerPage.getByRole('button',{name:'Voice call Test Pro',exact:true}).click();
  await proPage.getByRole('button',{name:'Decline',exact:true}).click();
  lastPage=customerPage;
  await customerPage.getByText('Call declined',{exact:true}).waitFor();
  await stopped(customerPage); await stopped(proPage);
  await customerPage.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied by test','NotAllowedError');};});
  await customerPage.getByRole('button',{name:'Video call Test Pro',exact:true}).click();
  await customerPage.getByRole('alert').filter({hasText:'Allow microphone access'}).waitFor();
  await stopped(customerPage);
  assert.ok(await customerPage.evaluate(()=>!Object.keys(localStorage).some(k=>k==='siesie.static-prototype.v1')));
  await customerPage.getByRole('button',{name:'Log out',exact:true}).click();
  await customerPage.waitForURL(base+'/');
  assert.equal(await customerPage.getByRole('textbox',{name:'Write a message',exact:true}).count(),0);
  await customerPage.goto(base+'/login?next=/jobs');
  await customerPage.getByRole('button',{name:'New to Siesie? Create an account',exact:true}).click();
  await customerPage.getByLabel('Email address',{exact:true}).fill('new@example.test');
  await customerPage.getByLabel('Password',{exact:true}).fill('TestPassword123!');
  await customerPage.getByLabel('Your name',{exact:true}).fill('New Customer');
  await customerPage.getByLabel('Phone number',{exact:true}).fill('0241234567');
  await customerPage.getByLabel('Your area',{exact:true}).selectOption('East Legon');
  await customerPage.getByRole('button',{name:'Create account',exact:true}).click();
  await customerPage.waitForURL(base+'/jobs');
  await customerPage.getByText('No bookings yet.',{exact:true}).waitFor();
  await customerPage.reload();
  await customerPage.getByText('No bookings yet.',{exact:true}).waitFor();
  console.log('PASS New account form provisions an isolated customer profile and retains the session on reload');
  assert.deepEqual(errors,[]);
  console.log('PASS Incoming calls across pages, decline, permission denial, logout, cleanup and live/demo separation; no browser errors');
} catch(error) { console.error(error); if(lastPage) console.error(await lastPage.locator('body').innerText()); process.exitCode=1; }
finally { await browser?.close(); await new Promise(resolve=>server ? server.httpServer.close(resolve):resolve()); await db.close(); }
