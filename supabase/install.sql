-- Run once in your Supabase SQL editor. Review first.
-- Atomic setup: a failure rolls back all changes. No demo users or payments are seeded.
begin;

-- 202609210001_marketplace.sql
-- Siesie live data. No sample identities, jobs, documents or payments are seeded.
create schema if not exists siesie_private;
revoke all on schema siesie_private from public;

create table public.siesie_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('customer','worker','admin')),
  name text not null check (length(name) between 2 and 100),
  phone text not null default '', area text not null default '',
  created_at timestamptz not null default now()
);
create table public.siesie_workers (
  id uuid primary key references public.siesie_profiles(id) on delete cascade,
  verification text not null default 'not_submitted' check (verification in ('not_submitted','pending','verified','rejected')),
  verification_note text, data jsonb not null default '{}'::jsonb
);
create table public.siesie_worker_private (
  id uuid primary key references public.siesie_workers(id) on delete cascade,
  payout jsonb not null default '{}'::jsonb,
  documents jsonb
);
create table public.siesie_jobs (
  id text primary key,
  customer_id uuid not null references public.siesie_profiles(id),
  worker_id uuid not null references public.siesie_workers(id),
  status text not null default 'requested' check (status in ('requested','quoted','declined','cancelled','in_progress','completed','confirmed','disputed','closed')),
  data jsonb not null,
  created_at timestamptz not null default now(),
  check (customer_id <> worker_id)
);
create index on public.siesie_jobs(customer_id, created_at desc);
create index on public.siesie_jobs(worker_id, created_at desc);
create table public.siesie_settings (
  id boolean primary key default true check (id),
  commission_pct numeric not null default 10 check (commission_pct between 0 and 30),
  confirm_window_hours integer not null default 48 check (confirm_window_hours between 24 and 168)
);
insert into public.siesie_settings(id) values (true);
create table public.siesie_notices (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.siesie_profiles(id) on delete cascade,
  text text not null, job_id text references public.siesie_jobs(id), created_at timestamptz not null default now(), read boolean not null default false
);
create index on public.siesie_notices(user_id, created_at desc);
create table public.siesie_conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.siesie_profiles(id),
  worker_id uuid not null references public.siesie_workers(id),
  created_at timestamptz not null default now(), unique(customer_id,worker_id)
);
create table public.siesie_messages (
  id uuid primary key default gen_random_uuid(), sequence bigint generated always as identity unique,
  conversation_id uuid not null references public.siesie_conversations(id) on delete cascade,
  sender_id uuid not null references public.siesie_profiles(id),
  body text not null check (length(trim(body)) between 1 and 2000),
  client_id text not null check (length(client_id) between 1 and 100),
  created_at timestamptz not null default now(), unique(conversation_id,sender_id,client_id)
);
create index on public.siesie_messages(conversation_id,sequence);
create table public.siesie_read_cursors (
  conversation_id uuid not null references public.siesie_conversations(id) on delete cascade,
  user_id uuid not null references public.siesie_profiles(id), sequence bigint not null default 0,
  read_at timestamptz not null default now(), primary key(conversation_id,user_id)
);

-- Direct browser writes are denied. The narrowly scoped RPCs below validate
-- membership, roles and state transitions inside the database transaction.
do $$ declare t text; begin
  foreach t in array array['profiles','workers','worker_private','jobs','settings','notices','conversations','messages','read_cursors'] loop
    execute format('alter table public.siesie_%I enable row level security',t);
    execute format('revoke all on public.siesie_%I from anon, authenticated',t);
  end loop;
end $$;

create function siesie_private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.siesie_profiles where id=auth.uid() and role='admin');
$$;
create function siesie_private.new_account() returns trigger language plpgsql security definer set search_path = '' as $$
declare r text; n text;
begin
  r := case when new.raw_user_meta_data->>'role'='worker' then 'worker' else 'customer' end;
  n := left(trim(coalesce(new.raw_user_meta_data->>'name','')),100);
  if length(n)<2 then n := 'New member'; end if;
  insert into public.siesie_profiles(id,role,name,phone,area)
    values(new.id,r,n,left(coalesce(new.raw_user_meta_data->>'phone',''),30),left(coalesce(new.raw_user_meta_data->>'area',''),100));
  if r='worker' then
    insert into public.siesie_workers(id) values(new.id);
    insert into public.siesie_worker_private(id) values(new.id);
  end if;
  return new;
end $$;
create trigger siesie_new_account after insert on auth.users for each row execute function siesie_private.new_account();

-- Also provision profiles for accounts created before this migration was applied.
insert into public.siesie_profiles(id,role,name,phone,area)
select id,case when raw_user_meta_data->>'role'='worker' then 'worker' else 'customer' end,
  case when length(trim(coalesce(raw_user_meta_data->>'name','')))<2 then 'New member' else left(trim(raw_user_meta_data->>'name'),100) end,
  left(coalesce(raw_user_meta_data->>'phone',''),30),left(coalesce(raw_user_meta_data->>'area',''),100)
from auth.users on conflict(id) do nothing;
insert into public.siesie_workers(id) select id from public.siesie_profiles where role='worker' on conflict(id) do nothing;
insert into public.siesie_worker_private(id) select id from public.siesie_workers on conflict(id) do nothing;

create function siesie_private.job_view(j public.siesie_jobs) returns jsonb language sql stable set search_path = '' as $$
  select j.data || jsonb_build_object('id',j.id,'customerId',j.customer_id,'workerId',j.worker_id,'status',j.status,'createdAt',j.created_at)
    || case when j.worker_id=auth.uid() and j.status in ('requested','quoted','declined','cancelled') then jsonb_build_object('address','Shared after payment') else '{}'::jsonb end;
$$;
create function siesie_private.worker_view(w public.siesie_workers) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id',w.id,'name',p.name,'phone',case when p.id=auth.uid() or siesie_private.is_admin() or exists(select 1 from public.siesie_jobs j where j.worker_id=w.id and j.customer_id=auth.uid() and j.status in ('in_progress','completed','confirmed','disputed','closed')) then p.phone else '' end,
    'joinedAt',p.created_at,'verification',w.verification,'verificationNote',case when p.id=auth.uid() or siesie_private.is_admin() then w.verification_note else null end,
    'services',coalesce(w.data->'services','[]'),'areas',coalesce(w.data->'areas','[]'),'baseArea',coalesce(w.data->>'baseArea',p.area),'bio',coalesce(w.data->>'bio',''),
    'pricing',coalesce(w.data->'pricing','{"mode":"quote","from":100,"to":500,"unit":"per job"}'),
    'availability',coalesce(w.data->'availability','{"days":[],"note":""}'),'yearsExperience',coalesce(w.data->'yearsExperience','0'),
    'portfolio',coalesce(w.data->'portfolio','[]'),
    'payout',case when p.id=auth.uid() or siesie_private.is_admin() then priv.payout else '{"type":"momo","network":"mtn","number":"","name":""}'::jsonb end,
    'ghanaCard',case when p.id=auth.uid() or siesie_private.is_admin() then priv.documents else null end,
    'rating', (select round(avg((j.data#>>'{customerReview,rating}')::numeric),1) from public.siesie_jobs j where j.worker_id=w.id and j.status in ('confirmed','closed')),
    'reviewCount',(select count(*) from public.siesie_jobs j where j.worker_id=w.id and j.data ? 'customerReview'),
    'jobsDone',(select count(*) from public.siesie_jobs j where j.worker_id=w.id and j.status in ('confirmed','closed'))
  ) from public.siesie_profiles p join public.siesie_worker_private priv on priv.id=p.id where p.id=w.id;
$$;
create function public.siesie_snapshot() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('version',3,
    'session',(select jsonb_build_object('userId',id,'role',role) from public.siesie_profiles where id=auth.uid()),
    'customers',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'phone',case when p.id=auth.uid() or siesie_private.is_admin() or exists(select 1 from public.siesie_jobs j where j.customer_id=p.id and j.worker_id=auth.uid() and j.status in ('in_progress','completed','confirmed','disputed','closed')) then p.phone else '' end,'area',p.area,'joinedAt',p.created_at)) from public.siesie_profiles p where p.role='customer' and (p.id=auth.uid() or siesie_private.is_admin() or exists(select 1 from public.siesie_jobs j where j.customer_id=p.id and j.worker_id=auth.uid()))),'[]'),
    'workers',coalesce((select jsonb_agg(siesie_private.worker_view(w)) from public.siesie_workers w where w.verification='verified' or w.id=auth.uid() or siesie_private.is_admin() or exists(select 1 from public.siesie_jobs j where j.worker_id=w.id and j.customer_id=auth.uid())),'[]'),
    'admins',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'phone',phone)) from public.siesie_profiles where role='admin' and id=auth.uid()),'[]'),
    'jobs',coalesce((select jsonb_agg(siesie_private.job_view(j) order by j.created_at desc) from public.siesie_jobs j where auth.uid() in (j.customer_id,j.worker_id) or siesie_private.is_admin()),'[]'),
    'notices',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'to',n.user_id,'text',n.text,'jobId',n.job_id,'at',n.created_at,'read',n.read) order by n.created_at desc) from public.siesie_notices n where n.user_id=auth.uid()),'[]'),
    'settings',(select jsonb_build_object('commissionPct',commission_pct,'confirmWindowHours',confirm_window_hours) from public.siesie_settings where id)
  );
$$;

create function siesie_private.check_photos(photos jsonb, folder text, bucket text default 'siesie-private') returns void language plpgsql set search_path = '' as $$
declare p jsonb; prefix text := 'storage://'||bucket||'/'||auth.uid()||'/'||folder||'/';
begin
  if jsonb_typeof(photos) is distinct from 'array' then raise exception 'Add up to six photos.'; end if;
  if jsonb_array_length(photos)>6 then raise exception 'Add up to six photos.'; end if;
  for p in select value from jsonb_array_elements(photos) loop
    if coalesce(p->>'src','') not like prefix||'%' or length(p->>'caption')>200 then raise exception 'Upload your photos before submitting.'; end if;
    if not exists(select 1 from storage.objects o where o.bucket_id=bucket and o.name=substring(p->>'src' from length('storage://'||bucket||'/')+1)) then raise exception 'Upload your photos before submitting.'; end if;
  end loop;
end $$;
create function siesie_private.check_worker(d jsonb) returns void language plpgsql set search_path = '' as $$
begin
  if jsonb_typeof(d->'services') is distinct from 'array' or jsonb_typeof(d->'areas') is distinct from 'array' or jsonb_typeof(d#>'{availability,days}') is distinct from 'array' then raise exception 'Choose services, areas and available days.'; end if;
  if d->>'yearsExperience' is null or d#>>'{pricing,from}' is null or d#>>'{pricing,to}' is null
    or coalesce(d#>>'{pricing,mode}','') not in ('quote','fixed') or coalesce(d->>'baseArea','')='' then raise exception 'Complete your experience and pricing.'; end if;
  if exists(select 1 from jsonb_array_elements_text(d#>'{availability,days}') day where day !~ '^[0-6]$') or jsonb_array_length(d->'areas') not between 1 and 100 then raise exception 'Choose valid areas and working days.'; end if;
  if length(trim(coalesce(d->>'bio','')))<20 or length(d->>'bio')>1200 or jsonb_array_length(coalesce(d->'services','[]')) not between 1 and 3
    or exists(select 1 from jsonb_array_elements_text(d->'services') s where s not in ('tiling','cleaning','maintenance'))
    or not (coalesce(d->'areas','[]') ? (d->>'baseArea'))
    or (d->>'yearsExperience')::numeric not between 0 and 60
    or (d#>>'{pricing,from}')::numeric not between 0.01 and 1000000
    or (d#>>'{pricing,to}')::numeric not between (d#>>'{pricing,from}')::numeric and 1000000
    or length(trim(coalesce(d#>>'{pricing,unit}','')))=0
    or jsonb_array_length(coalesce(d#>'{availability,days}','[]')) not between 1 and 7
    then raise exception 'Complete the services, areas, experience, pricing and availability fields.'; end if;
end $$;
create function public.siesie_action(action text,input jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor public.siesie_profiles; w public.siesie_workers; j public.siesie_jobs; cfg public.siesie_settings;
  jid text := input->>'jobId'; d jsonb; amount numeric; other uuid; next_status text; event text; docs jsonb; wid uuid;
begin
  select * into actor from public.siesie_profiles where id=auth.uid();
  if actor.id is null then raise exception 'Log in to continue.' using errcode='42501'; end if;
  if octet_length(input::text)>100000 then raise exception 'Request is too large.'; end if;
  select * into cfg from public.siesie_settings where id;
  if action='read_notices' then
    update public.siesie_notices set read=true where user_id=actor.id; return 'null';
  elsif action='settings' then
    if actor.role<>'admin' then raise exception 'Admin access required.' using errcode='42501'; end if;
    update public.siesie_settings set commission_pct=(input->>'commissionPct')::numeric, confirm_window_hours=(input->>'confirmWindowHours')::integer where id;
    return 'null';
  elsif action in ('register_worker','update_worker','portfolio','verify_worker','resubmit_verification') then
    wid := case when action='register_worker' then actor.id else (input->>'workerId')::uuid end;
    select * into w from public.siesie_workers where id=wid for update;
    if w.id is null then raise exception 'Worker not found.'; end if;
    if action='verify_worker' then
      if actor.role<>'admin' then raise exception 'Admin access required.' using errcode='42501'; end if;
      if w.verification<>'pending' then raise exception 'This submission has already been reviewed.'; end if;
      select documents into docs from public.siesie_worker_private where id=wid;
      if (input->>'approve')::boolean and (docs->>'frontPhoto' is null or docs->>'selfie' is null) then raise exception 'Both identity photos are required.'; end if;
      if not (input->>'approve')::boolean and length(trim(coalesce(input->>'note','')))<10 then raise exception 'Explain what needs correcting.'; end if;
      update public.siesie_workers set verification=case when (input->>'approve')::boolean then 'verified' else 'rejected' end,verification_note=input->>'note' where id=wid;
      insert into public.siesie_notices(user_id,text) values(wid,case when (input->>'approve')::boolean then 'Your profile is verified and visible to customers.' else 'Please update your verification: '||(input->>'note') end);
    else
      if actor.role<>'worker' or actor.id<>wid then raise exception 'You can only edit your own profile.' using errcode='42501'; end if;
      if action='portfolio' then
        perform siesie_private.check_photos(jsonb_build_array(input->'photo'),'portfolio','siesie-portfolio');
        update public.siesie_workers set data=jsonb_set(data,'{portfolio}',jsonb_build_array(input->'photo')||coalesce(data->'portfolio','[]')) where id=wid;
      elsif action='resubmit_verification' then
        if w.verification not in ('rejected','not_submitted') then raise exception 'This submission is already under review.'; end if;
      else
        if action='register_worker' and w.verification not in ('not_submitted','rejected') then raise exception 'Your profile has already been submitted.'; end if;
        d := w.data || (select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(input) where key in ('services','areas','baseArea','bio','pricing','availability','yearsExperience'));
        perform siesie_private.check_worker(d);
        if coalesce(input#>>'{payout,type}','') not in ('momo','bank') or length(trim(coalesce(input#>>'{payout,name}','')))<2 or coalesce(input#>>'{payout,number}','') !~ '^[+0-9]{6,20}$' then raise exception 'Complete your payout details.'; end if;
        update public.siesie_workers set data=d where id=wid;
        update public.siesie_worker_private set payout=input->'payout' where id=wid;
        if action='register_worker' then
          if length(trim(coalesce(input->>'name','')))<2 or coalesce(input->>'phone','') !~ '^0[235][0-9]{8}$' then raise exception 'Add a valid name and Ghana phone number.'; end if;
          update public.siesie_profiles set name=trim(input->>'name'),phone=input->>'phone',area=input->>'baseArea' where id=wid;
        end if;
      end if;
      if action in ('register_worker','resubmit_verification') then
        if coalesce(input->>'ghanaCardNumber','') !~ '^GHA-[0-9]{9}-[0-9]$' then raise exception 'Use the Ghana Card format GHA-123456789-0.'; end if;
        select documents into docs from public.siesie_worker_private where id=wid;
        docs := coalesce(docs,'{}') || jsonb_strip_nulls(jsonb_build_object('number',input->>'ghanaCardNumber','submittedAt',now(),'frontPhoto',input->>'frontPhoto','selfie',input->>'selfie'));
        perform siesie_private.check_photos(jsonb_build_array(jsonb_build_object('src',docs->>'frontPhoto'),jsonb_build_object('src',docs->>'selfie')),'verification');
        update public.siesie_worker_private set documents=docs where id=wid;
        update public.siesie_workers set verification='pending',verification_note=null where id=wid;
      end if;
    end if;
    return to_jsonb(wid);
  elsif action='request_booking' then
    if actor.role<>'customer' then raise exception 'Customer access required.' using errcode='42501'; end if;
    select * into w from public.siesie_workers where id=(input->>'workerId')::uuid and verification='verified' for share;
    if w.id is null or (w.data->'services' ? (input->>'service')) is not true or (w.data->'areas' ? (input->>'area')) is not true then raise exception 'Choose a verified worker who covers this service and area.'; end if;
    jid := input->>'id';
    if coalesce(jid,'') !~ '^SS-[A-Z0-9-]{12,36}$' or length(trim(coalesce(input->>'title',''))) not between 4 and 200 or length(trim(coalesce(input->>'scope',''))) not between 20 and 4000 or length(trim(coalesce(input->>'address',''))) not between 4 and 500 or coalesce((input->>'preferredDate')::date,'1900-01-01')<current_date then raise exception 'Complete the job title, details, address and date.'; end if;
    perform siesie_private.check_photos(coalesce(input->'photos','[]'),'jobs/'||jid);
    d := (select jsonb_object_agg(key,value) from jsonb_each(input) where key in ('service','title','scope','area','address','preferredDate','photos'));
    d := d || jsonb_build_object('events',jsonb_build_array(jsonb_build_object('at',now(),'by','customer','text','Booking requested')));
    insert into public.siesie_jobs(id,customer_id,worker_id,data) values(jid,actor.id,w.id,d);
    insert into public.siesie_notices(user_id,text,job_id) values(w.id,'New booking request: '||(input->>'title'),jid);
    return to_jsonb(jid);
  end if;
  select * into j from public.siesie_jobs where id=jid for update;
  if j.id is null or actor.id not in (j.customer_id,j.worker_id) then raise exception 'Booking unavailable.' using errcode='42501'; end if;
  d := j.data; next_status := j.status; other := case when actor.id=j.customer_id then j.worker_id else j.customer_id end;
  if action='cancel' and actor.id=j.customer_id and j.status in ('requested','quoted') then next_status:='cancelled'; event:='Request withdrawn';
  elsif action='accept' and actor.id=j.worker_id and j.status='requested' then
    if not exists(select 1 from public.siesie_workers where id=actor.id and verification='verified') then raise exception 'Verification is required before accepting jobs.'; end if;
    amount := round((input->>'amount')::numeric,2);
    if amount is null or amount not between 0.01 and 1000000 or coalesce((input->>'date')::date,'1900-01-01')<current_date then raise exception 'Enter a valid price and start date.'; end if;
    d := d || jsonb_build_object('quote',jsonb_build_object('amount',amount,'date',input->>'date','note',left(input->>'note',600),'at',now(),'commissionPct',cfg.commission_pct));
    next_status:='quoted'; event:='Quote received. Pay to confirm the booking.';
  elsif action='decline' and actor.id=j.worker_id and j.status='requested' then
    next_status:='declined'; event:='Request declined'; d:=d||jsonb_build_object('declineReason',left(input->>'reason',600));
  elsif action='complete' and actor.id=j.worker_id and j.status='in_progress' then
    perform siesie_private.check_photos(coalesce(input->'photos','[]'),'jobs/'||jid);
    d:=d||jsonb_build_object('completedAt',now(),'completionNote',left(input->>'note',1200),'completionPhotos',input->'photos','confirmBy',now()+make_interval(hours=>cfg.confirm_window_hours));
    next_status:='completed'; event:='Work marked complete. Please check the work.';
  elsif action='confirm' and actor.id=j.customer_id and j.status='completed' then
    amount:=(d#>>'{payment,amount}')::numeric;
    if amount is null then raise exception 'A verified payment is required.'; end if;
    d:=d||jsonb_build_object('confirmedAt',now(),'payout',jsonb_build_object('reference',gen_random_uuid(),'gross',amount,'commission',round(amount*(d#>>'{quote,commissionPct}')::numeric/100,2),'net',amount-round(amount*(d#>>'{quote,commissionPct}')::numeric/100,2),'destination','Verified payout account','status','queued','queuedAt',now()));
    next_status:='confirmed'; event:='Customer confirmed completion. Payout queued.';
  elsif action='dispute' and actor.id=j.customer_id and j.status in ('in_progress','completed') then
    if coalesce(input->>'reason','') not in ('unfinished','poor_quality','damage','no_show','other') or length(trim(coalesce(input->>'details',''))) not between 15 and 4000 then raise exception 'Choose a reason and explain the problem.'; end if;
    perform siesie_private.check_photos(coalesce(input->'evidence','[]'),'jobs/'||jid);
    d:=d||jsonb_build_object('dispute',jsonb_build_object('reason',input->>'reason','details',input->>'details','evidence',input->'evidence','openedAt',now()));
    next_status:='disputed'; event:='A dispute was opened. Payment release is paused.';
  elsif action='dispute_response' and actor.id=j.worker_id and j.status='disputed' then
    if length(trim(coalesce(input->>'text',''))) not between 15 and 4000 then raise exception 'Explain your side in at least 15 characters.'; end if;
    perform siesie_private.check_photos(coalesce(input->'evidence','[]'),'jobs/'||jid);
    d:=jsonb_set(d,'{dispute,workerResponse}',jsonb_build_object('text',input->>'text','evidence',input->'evidence','at',now())); event:='Worker responded to the dispute';
  elsif action='review' and j.status in ('confirmed','closed') then
    if coalesce(input->>'rating','') !~ '^[1-5]$' then raise exception 'Choose a rating from 1 to 5.'; end if;
    event:=case when actor.id=j.customer_id then 'customerReview' else 'workerReview' end;
    if d ? event then raise exception 'You already reviewed this booking.'; end if;
    d:=d||jsonb_build_object(event,jsonb_build_object('rating',(input->>'rating')::integer,'text',left(input->>'text',2000),'at',now())); event:='Review posted';
  else raise exception 'This action is not allowed for this booking.' using errcode='42501';
  end if;
  d:=jsonb_set(d,'{events}',coalesce(d->'events','[]')||jsonb_build_array(jsonb_build_object('at',now(),'by',actor.role,'text',event)));
  update public.siesie_jobs set data=d,status=next_status where id=jid;
  insert into public.siesie_notices(user_id,text,job_id) values(other,event,jid);
  return 'null';
end $$;

revoke all on all functions in schema siesie_private from public,anon,authenticated;
revoke all on function public.siesie_snapshot() from public;
grant execute on function public.siesie_snapshot() to anon,authenticated;
revoke all on function public.siesie_action(text,jsonb) from public;
grant execute on function public.siesie_action(text,jsonb) to authenticated;


-- 202609210002_messaging_storage.sql
create function siesie_private.contact_view(uid uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',p.id,'role',p.role,'name',p.name,'area',p.area,'services',coalesce(w.data->'services','[]'))
    from public.siesie_profiles p left join public.siesie_workers w on w.id=p.id where p.id=uid;
$$;
create function siesie_private.message_view(m public.siesie_messages) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('id',m.id,'sequence',m.sequence,'senderId',m.sender_id,'body',m.body,'createdAt',m.created_at);
$$;
create function siesie_private.conversation_view(c public.siesie_conversations) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',c.id,'customerId',c.customer_id,'workerId',c.worker_id,'createdAt',c.created_at,
    'peer',siesie_private.contact_view(case when c.customer_id=auth.uid() then c.worker_id else c.customer_id end),
    'lastMessage',(select siesie_private.message_view(m) from public.siesie_messages m where m.conversation_id=c.id order by sequence desc limit 1),
    'readCursor',coalesce((select sequence from public.siesie_read_cursors where conversation_id=c.id and user_id=auth.uid()),0),
    'peerReadCursor',coalesce((select sequence from public.siesie_read_cursors where conversation_id=c.id and user_id<>auth.uid()),0),
    'peerReadAt',(select read_at from public.siesie_read_cursors where conversation_id=c.id and user_id<>auth.uid()),
    'unreadCount',(select count(*) from public.siesie_messages m where m.conversation_id=c.id and sender_id<>auth.uid() and sequence>coalesce((select sequence from public.siesie_read_cursors where conversation_id=c.id and user_id=auth.uid()),0)));
$$;
create function public.siesie_chat(route text,input jsonb default null,after_sequence bigint default 0,page_limit integer default 100)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.siesie_profiles; c public.siesie_conversations; m public.siesie_messages;
  peer uuid; cid uuid; customer uuid; worker uuid; suffix text; messages jsonb;
begin
  select * into actor from public.siesie_profiles where id=auth.uid();
  if actor.id is null or actor.role not in ('customer','worker') then raise exception 'Log in as a customer or professional to use messaging.' using errcode='42501'; end if;
  if route='/contacts' and input is null then
    return jsonb_build_object('userId',actor.id,'contacts',coalesce((select jsonb_agg(siesie_private.contact_view(p.id) order by p.name) from public.siesie_profiles p where
      (actor.role='customer' and p.role='worker' and (exists(select 1 from public.siesie_workers w where w.id=p.id and w.verification='verified') or exists(select 1 from public.siesie_jobs j where j.customer_id=actor.id and j.worker_id=p.id) or exists(select 1 from public.siesie_conversations conv where conv.customer_id=actor.id and conv.worker_id=p.id))) or
      (actor.role='worker' and p.role='customer' and (exists(select 1 from public.siesie_jobs j where j.worker_id=actor.id and j.customer_id=p.id) or exists(select 1 from public.siesie_conversations conv where conv.worker_id=actor.id and conv.customer_id=p.id)))),'[]'));
  elsif route='/conversations' and input is null then
    return jsonb_build_object('userId',actor.id,'conversations',coalesce((select jsonb_agg(siesie_private.conversation_view(item) order by coalesce((select max(created_at) from public.siesie_messages msg where msg.conversation_id=item.id),item.created_at) desc) from public.siesie_conversations item where actor.id in (item.customer_id,item.worker_id)),'[]'));
  elsif route='/conversations' and input is not null then
    peer:=(input->>'peerId')::uuid;
    customer:=case when actor.role='customer' then actor.id else peer end;
    worker:=case when actor.role='worker' then actor.id else peer end;
    if not exists(select 1 from public.siesie_profiles where id=customer and role='customer') or not exists(select 1 from public.siesie_workers where id=worker) or not (
      (actor.role='customer' and exists(select 1 from public.siesie_workers where id=worker and verification='verified'))
      or exists(select 1 from public.siesie_jobs where customer_id=customer and worker_id=worker)
      or exists(select 1 from public.siesie_conversations where customer_id=customer and worker_id=worker)
    ) then raise exception 'You cannot contact this account.' using errcode='42501'; end if;
    insert into public.siesie_conversations(customer_id,worker_id) values(customer,worker) on conflict(customer_id,worker_id) do nothing;
    select * into c from public.siesie_conversations where customer_id=customer and worker_id=worker;
    return jsonb_build_object('conversation',siesie_private.conversation_view(c));
  end if;
  if route !~ '^/conversations/[a-f0-9-]{36}(/(messages|read))?$' then raise exception 'Conversation unavailable.'; end if;
  cid:=split_part(route,'/',3)::uuid; suffix:=split_part(route,'/',4);
  select * into c from public.siesie_conversations where id=cid and actor.id in (customer_id,worker_id) for update;
  if c.id is null then raise exception 'Conversation unavailable.' using errcode='42501'; end if;
  if suffix='' and input is null then return jsonb_build_object('conversation',siesie_private.conversation_view(c));
  elsif suffix='messages' and input is null then
    if after_sequence<0 or page_limit not between 1 and 100 then raise exception 'Invalid message cursor or page size.'; end if;
    select coalesce(jsonb_agg(siesie_private.message_view(item) order by item.sequence),'[]') into messages from (select * from public.siesie_messages where conversation_id=cid and sequence>after_sequence order by sequence limit page_limit) item;
    return jsonb_build_object('messages',messages,'nextCursor',coalesce((messages->-1->>'sequence')::bigint,after_sequence),'hasMore',exists(select 1 from public.siesie_messages where conversation_id=cid and sequence>coalesce((messages->-1->>'sequence')::bigint,after_sequence)));
  elsif suffix='messages' and input is not null then
    if length(trim(coalesce(input->>'body',''))) not between 1 and 2000 or length(coalesce(input->>'clientId','')) not between 1 and 100 then raise exception 'Enter a message of up to 2,000 characters.'; end if;
    insert into public.siesie_messages(conversation_id,sender_id,body,client_id) values(cid,actor.id,trim(input->>'body'),input->>'clientId') on conflict(conversation_id,sender_id,client_id) do nothing;
    select * into m from public.siesie_messages where conversation_id=cid and sender_id=actor.id and client_id=input->>'clientId';
    if m.body<>trim(input->>'body') then raise exception 'This message key was already used.'; end if;
    return jsonb_build_object('message',siesie_private.message_view(m));
  elsif suffix='read' and input is not null then
    select * into m from public.siesie_messages where id=(input->>'messageId')::uuid and conversation_id=cid;
    if m.id is null then raise exception 'Read cursor must refer to a message in this conversation.'; end if;
    insert into public.siesie_read_cursors(conversation_id,user_id,sequence) values(cid,actor.id,m.sequence)
      on conflict(conversation_id,user_id) do update set sequence=excluded.sequence,read_at=now() where public.siesie_read_cursors.sequence<excluded.sequence;
    return jsonb_build_object('conversation',siesie_private.conversation_view(c));
  end if;
  raise exception 'Action unavailable.';
end $$;
revoke all on all functions in schema siesie_private from public,anon,authenticated;
revoke all on function public.siesie_chat(text,jsonb,bigint,integer) from public;
grant execute on function public.siesie_chat(text,jsonb,bigint,integer) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('siesie-private','siesie-private',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('siesie-portfolio','siesie-portfolio',true,5242880,array['image/jpeg','image/png','image/webp']);
create function public.siesie_can_read_file(path text) returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and (
    split_part(path,'/',1)=auth.uid()::text or siesie_private.is_admin() or
    (split_part(path,'/',2)='jobs' and exists(select 1 from public.siesie_jobs j where j.id=split_part(path,'/',3) and auth.uid() in (j.customer_id,j.worker_id)))
  );
$$;
revoke all on function public.siesie_can_read_file(text) from public;
grant execute on function public.siesie_can_read_file(text) to authenticated;
create policy siesie_private_read on storage.objects for select to authenticated
  using(bucket_id='siesie-private' and public.siesie_can_read_file(name));
create policy siesie_private_upload on storage.objects for insert to authenticated
  with check(bucket_id='siesie-private' and split_part(name,'/',1)=auth.uid()::text and split_part(name,'/',2) in ('verification','jobs'));
create policy siesie_portfolio_upload on storage.objects for insert to authenticated
  with check(bucket_id='siesie-portfolio' and split_part(name,'/',1)=auth.uid()::text and split_part(name,'/',2)='portfolio');


-- 202609210003_calls.sql
-- Signaling only: audio and video travel over WebRTC, never through these tables.
create table public.siesie_calls (
  id uuid primary key,
  conversation_id uuid not null references public.siesie_conversations(id) on delete cascade,
  caller_id uuid not null references public.siesie_profiles(id),
  callee_id uuid not null references public.siesie_profiles(id),
  mode text not null check (mode in ('voice','video')),
  state text not null default 'ringing' check (state in ('ringing','accepted','declined','ended','missed')),
  caller_device uuid not null, callee_device uuid,
  caller_seen timestamptz not null default now(), callee_seen timestamptz,
  caller_relays integer not null default 0, callee_relays integer not null default 0,
  created_at timestamptz not null default now(), accepted_at timestamptz, ended_at timestamptz,
  check (caller_id<>callee_id)
);
create index on public.siesie_calls(caller_id,created_at desc);
create index on public.siesie_calls(callee_id,created_at desc);
create table public.siesie_call_signals (
  sequence bigint generated always as identity primary key,
  call_id uuid not null references public.siesie_calls(id) on delete cascade,
  sender_id uuid not null references public.siesie_profiles(id),
  client_id uuid not null, kind text not null check (kind in ('offer','answer','candidate')),
  payload jsonb not null, unique(call_id,sender_id,client_id)
);
create unique index on public.siesie_call_signals(call_id,kind) where kind in ('offer','answer');
alter table public.siesie_calls enable row level security;
alter table public.siesie_call_signals enable row level security;
revoke all on public.siesie_calls,public.siesie_call_signals from anon,authenticated;

create function siesie_private.call_view(c public.siesie_calls) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('id',c.id,'conversationId',c.conversation_id,'callerId',c.caller_id,'calleeId',c.callee_id,
    'mode',c.mode,'state',c.state,'createdAt',c.created_at,'acceptedAt',c.accepted_at,
    'peerName',(select name from public.siesie_profiles where id=case when auth.uid()=c.caller_id then c.callee_id else c.caller_id end));
$$;
create function public.siesie_call(action text,input jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); device uuid:=(input->>'device')::uuid; cid uuid:=(input->>'callId')::uuid;
  c public.siesie_calls; conv public.siesie_conversations; peer uuid; expired public.siesie_calls;
  sig public.siesie_call_signals; k text:=input->>'kind'; signal_payload jsonb:=input->'payload';
begin
  if actor is null or not exists(select 1 from public.siesie_profiles where id=actor and role in ('customer','worker')) then raise exception 'Log in as a customer or pro to call.' using errcode='42501'; end if;
  if device is null or coalesce(octet_length(input::text),0)>80000 then raise exception 'Invalid call request.'; end if;
  -- Sorted participant locks serialize call creation, including opposite-direction calls.
  if action='create' then
    select * into conv from public.siesie_conversations where id=(input->>'conversationId')::uuid and actor in (customer_id,worker_id);
    if conv.id is null then raise exception 'Open a conversation with this person first.' using errcode='42501'; end if;
    peer:=case when actor=conv.customer_id then conv.worker_id else conv.customer_id end;
    perform pg_advisory_xact_lock(hashtextextended(least(actor,peer)::text,13));
    perform pg_advisory_xact_lock(hashtextextended(greatest(actor,peer)::text,13));
  end if;
  for expired in update public.siesie_calls set state=case when state='ringing' then 'missed' else 'ended' end,ended_at=now()
    where (actor in (caller_id,callee_id) or peer in (caller_id,callee_id)) and state in ('ringing','accepted') and (
      (state='ringing' and created_at<now()-interval '45 seconds') or caller_seen<now()-interval '90 seconds' or
      (state='accepted' and callee_seen<now()-interval '90 seconds') or created_at<now()-interval '1 hour') returning * loop
    delete from public.siesie_call_signals where call_id=expired.id;
    if expired.state='missed' then insert into public.siesie_notices(user_id,text) values(expired.callee_id,'Missed '||expired.mode||' call from '||(select name from public.siesie_profiles where id=expired.caller_id)); end if;
  end loop;
  if action='create' then
    select * into c from public.siesie_calls where id=cid;
    if c.id is not null then
      if c.caller_id=actor and c.caller_device=device and c.conversation_id=conv.id and c.mode=input->>'mode' then return jsonb_build_object('call',siesie_private.call_view(c),'signals','[]'::jsonb,'owned',true); end if;
      raise exception 'Call identifier already used.';
    end if;
    if exists(select 1 from public.siesie_calls where state in ('ringing','accepted') and (actor in (caller_id,callee_id) or peer in (caller_id,callee_id))) then raise exception 'One of you is already on a call. Try again shortly.'; end if;
    if (select count(*) from public.siesie_calls where caller_id=actor and created_at>now()-interval '5 minutes')>=8 then raise exception 'Please wait a few minutes before calling again.'; end if;
    insert into public.siesie_calls(id,conversation_id,caller_id,callee_id,mode,caller_device) values(cid,conv.id,actor,peer,input->>'mode',device) returning * into c;
  else
    if cid is null and action='sync' then
      select * into c from public.siesie_calls where actor in (caller_id,callee_id) and state in ('ringing','accepted') order by created_at desc limit 1;
    else
      select * into c from public.siesie_calls where id=cid and actor in (caller_id,callee_id) for update;
    end if;
    if c.id is null then
      if action='sync' and cid is null then return jsonb_build_object('call',null,'signals','[]'::jsonb,'owned',false); end if;
      raise exception 'Call unavailable.' using errcode='42501';
    end if;
    if action='accept' then
      if c.callee_id<>actor or c.state<>'ringing' then raise exception 'This call has already been answered or ended.'; end if;
      update public.siesie_calls set state='accepted',callee_device=device,callee_seen=now(),accepted_at=now() where id=c.id returning * into c;
    elsif action='decline' then
      if c.callee_id<>actor or c.state<>'ringing' then raise exception 'This call has already been answered or ended.'; end if;
      update public.siesie_calls set state='declined',ended_at=now() where id=c.id returning * into c;
    elsif action in ('end','signal','relay') then
      if (actor=c.caller_id and device<>c.caller_device) or (actor=c.callee_id and device is distinct from c.callee_device) then raise exception 'This call is open on another device.' using errcode='42501'; end if;
      if action='end' then
        update public.siesie_calls set state='ended',ended_at=now() where id=c.id and state in ('ringing','accepted') returning * into expired;
        if expired.id is not null then c:=expired; end if;
      else
        if c.state not in ('ringing','accepted') then raise exception 'This call has ended.'; end if;
        if action='relay' then
          if (actor=c.caller_id and c.caller_relays>=3) or (actor=c.callee_id and c.callee_relays>=3) then raise exception 'Call connection limit reached. Start a new call.'; end if;
          update public.siesie_calls set caller_relays=caller_relays+case when actor=caller_id then 1 else 0 end,callee_relays=callee_relays+case when actor=callee_id then 1 else 0 end where id=c.id;
          return jsonb_build_object('allowed',true);
        end if;
        if k not in ('offer','answer','candidate') or k is null or jsonb_typeof(signal_payload) is distinct from 'object' then raise exception 'Invalid call signal.'; end if;
        if (k='offer' and actor<>c.caller_id) or (k='answer' and (actor<>c.callee_id or c.state<>'accepted')) then raise exception 'Invalid call signal sender.' using errcode='42501'; end if;
        if (k in ('offer','answer') and (signal_payload->>'type' is distinct from k or length(coalesce(signal_payload->>'sdp','')) not between 1 and 65000)) or
           (k='candidate' and length(coalesce(signal_payload->>'candidate','')) not between 1 and 4000) then raise exception 'Invalid call signal payload.'; end if;
        select * into sig from public.siesie_call_signals where call_id=c.id and sender_id=actor and client_id=(input->>'clientId')::uuid;
        if sig.sequence is not null then
          if sig.kind<>k or sig.payload<>signal_payload then raise exception 'Signal key already used.'; end if;
        else
          if (select count(*) from public.siesie_call_signals where call_id=c.id and sender_id=actor)>=200 then raise exception 'Too many call signals.'; end if;
          insert into public.siesie_call_signals(call_id,sender_id,client_id,kind,payload) values(c.id,actor,(input->>'clientId')::uuid,k,signal_payload);
        end if;
      end if;
    elsif action<>'sync' then raise exception 'Unknown call action.';
    end if;
  end if;
  if c.state in ('declined','ended','missed') then delete from public.siesie_call_signals where call_id=c.id;
  elsif action='sync' then
    update public.siesie_calls set caller_seen=case when actor=caller_id and device=caller_device then now() else caller_seen end,
      callee_seen=case when actor=callee_id and device=callee_device then now() else callee_seen end where id=c.id;
  end if;
  return jsonb_build_object('call',siesie_private.call_view(c),
    'owned',case when actor=c.caller_id then device=c.caller_device else device is not distinct from c.callee_device end,
    'signals',coalesce((select jsonb_agg(jsonb_build_object('sequence',sequence,'kind',kind,'payload',payload) order by sequence)
      from public.siesie_call_signals where call_id=c.id and sender_id<>actor and sequence>coalesce((input->>'after')::bigint,0)
        and (device=c.caller_device and actor=c.caller_id or device=c.callee_device and actor=c.callee_id)),'[]'));
end $$;
revoke all on function siesie_private.call_view(public.siesie_calls) from public,anon,authenticated;
revoke all on function public.siesie_call(text,jsonb) from public,anon;
grant execute on function public.siesie_call(text,jsonb) to authenticated;


-- 202610170001_paystack.sql
-- Paystack collection, payouts and refunds.
--
-- Money only moves on Paystack's word. Browsers start a checkout through the
-- paystack-checkout Edge Function; every state change below is made by Edge
-- Functions holding the service-role key, after Paystack has confirmed it.
-- Siesie keeps the commission pinned on the quote: the worker is sent the payout's
-- net amount and the rest stays in the Paystack balance. Paystack's own fees come
-- out of that commission, so customers pay exactly the quote.

alter table public.siesie_worker_private add column paystack_recipient jsonb;

create table public.siesie_checkouts (
  reference text primary key check (reference ~ '^sie_[0-9a-f]{32}$'),
  job_id text not null references public.siesie_jobs(id),
  customer_id uuid not null references public.siesie_profiles(id),
  amount numeric not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending','paid','refund_due','refunded')),
  created_at timestamptz not null default now(), settled_at timestamptz
);
create index on public.siesie_checkouts(job_id, created_at desc);
create table public.siesie_transfers (
  reference text primary key,
  job_id text not null references public.siesie_jobs(id),
  amount numeric not null check (amount > 0),
  status text not null default 'sending' check (status in ('sending','processing','success','failed','reversed')),
  transfer_code text, failure text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.siesie_transfers(job_id);
alter table public.siesie_checkouts enable row level security;
alter table public.siesie_transfers enable row level security;
revoke all on public.siesie_checkouts, public.siesie_transfers from anon, authenticated;

create function siesie_private.add_event(d jsonb, actor text, msg text) returns jsonb language sql set search_path = '' as $$
  select jsonb_set(d,'{events}',coalesce(d->'events','[]')||jsonb_build_array(jsonb_build_object('at',now(),'by',actor,'text',msg)));
$$;
create function siesie_private.cedis(amount numeric) returns text language sql immutable set search_path = '' as $$
  select 'GH₵ '||to_char(amount,'FM999,999,990.00');
$$;
create function siesie_private.payout_destination(p jsonb) returns text language sql immutable set search_path = '' as $$
  select case when p->>'type'='momo' then 'MoMo '||left(coalesce(p->>'number',''),3)||' ••• '||right(coalesce(p->>'number',''),3)
    else coalesce(nullif(p->>'bank',''),'Bank')||' ••'||right(coalesce(p->>'number',''),4) end;
$$;
create function siesie_private.queue_payout(d jsonb, gross numeric, destination text) returns jsonb language sql set search_path = '' as $$
  with pct as (select coalesce((d#>>'{quote,commissionPct}')::numeric,(select commission_pct from public.siesie_settings where id)) as v)
  select d||jsonb_build_object('payout',jsonb_build_object('reference',gen_random_uuid(),'gross',gross,
    'commission',round(gross*pct.v/100,2),'net',gross-round(gross*pct.v/100,2),
    'destination',destination,'status','queued','queuedAt',now(),'attempts',0)) from pct;
$$;
create function siesie_private.notify_admins(msg text, jid text) returns void language sql set search_path = '' as $$
  insert into public.siesie_notices(user_id,text,job_id) select id,msg,jid from public.siesie_profiles where role='admin';
$$;

create function public.siesie_payments(action text, input jsonb default '{}') returns jsonb language plpgsql security definer set search_path = '' as $$
declare j public.siesie_jobs; c public.siesie_checkouts; t public.siesie_transfers; priv public.siesie_worker_private;
  d jsonb; amount numeric; w numeric; back numeric; ref text; st text; outcome text; summary text; title text;
  result jsonb := '[]'; n integer := 0;
begin
  if action='begin_checkout' then
    select * into j from public.siesie_jobs where id=input->>'jobId' for update;
    if j.id is null or j.customer_id::text is distinct from lower(input->>'userId') then raise exception 'Booking unavailable.' using errcode='42501'; end if;
    if j.status<>'quoted' then raise exception 'This booking is not waiting for payment.'; end if;
    if (select count(*) from public.siesie_checkouts where job_id=j.id and created_at>now()-interval '1 hour')>=10 then raise exception 'Too many payment attempts. Please wait an hour and try again.'; end if;
    amount := round((j.data#>>'{quote,amount}')::numeric,2);
    ref := 'sie_'||replace(gen_random_uuid()::text,'-','');
    insert into public.siesie_checkouts(reference,job_id,customer_id,amount) values(ref,j.id,j.customer_id,amount);
    return jsonb_build_object('reference',ref,'amount',amount);

  -- Paystack verified a successful charge. Applies it once, or marks it for a full
  -- refund when the booking can no longer take it (withdrawn, already paid, wrong amount).
  elsif action='charge_success' then
    select * into c from public.siesie_checkouts where reference=input->>'reference' for update;
    if c.reference is null then return jsonb_build_object('outcome','unknown'); end if;
    if c.status<>'pending' then return jsonb_build_object('outcome','handled','status',c.status); end if;
    amount := round((input->>'amount')::numeric,2);
    select * into j from public.siesie_jobs where id=c.job_id for update;
    title := '“'||(j.data->>'title')||'”';
    if input->>'currency' is distinct from 'GHS' or amount is distinct from c.amount or j.status<>'quoted'
      or round((j.data#>>'{quote,amount}')::numeric,2) is distinct from c.amount then
      update public.siesie_checkouts set status='refund_due',settled_at=now() where reference=c.reference;
      insert into public.siesie_notices(user_id,text,job_id) values(c.customer_id,'A payment for '||title||' could not be applied to the booking, so it is being refunded in full.',j.id);
      return jsonb_build_object('outcome','refund','reference',c.reference);
    end if;
    d := j.data||jsonb_build_object('payment',jsonb_strip_nulls(jsonb_build_object('reference',c.reference,'amount',c.amount,
      'channel',case when input->>'channel'='card' then 'card' else 'momo' end,
      'network',case when input->>'network' in ('mtn','telecel','airteltigo') then input->>'network' end,
      'payer',left(coalesce(nullif(input->>'payer',''),'Paystack'),40),
      'paidAt',coalesce(to_jsonb(nullif(input->>'paidAt','')),to_jsonb(now())))));
    d := siesie_private.add_event(d,'system','Payment of '||siesie_private.cedis(c.amount)||' received through Paystack. Siesie holds it until the work is confirmed.');
    update public.siesie_jobs set data=d,status='in_progress' where id=j.id;
    update public.siesie_checkouts set status='paid',settled_at=now() where reference=c.reference;
    insert into public.siesie_notices(user_id,text,job_id) values
      (j.worker_id,'Payment secured for '||title||'. You can start the job.',j.id),
      (j.customer_id,'Payment received for '||title||'. Siesie holds it until you confirm the work.',j.id);
    return jsonb_build_object('outcome','recorded','jobId',j.id);

  -- Refund progress for a payment reference: orphaned checkouts and dispute refunds.
  elsif action='refund_update' then
    st := input->>'status';
    if st is null or st not in ('pending','processing','processed','failed','check') then raise exception 'Unknown refund status.'; end if;
    if st not in ('failed','check') then
      update public.siesie_checkouts set status='refunded',settled_at=now() where reference=input->>'reference' and status='refund_due';
    end if;
    for j in select * from public.siesie_jobs where data#>>'{payment,reference}'=input->>'reference' and data ? 'refund' for update loop
      continue when j.data#>>'{refund,status}'='processed' and st<>'processed';
      d := jsonb_set(j.data,'{refund}',((j.data->'refund')-'failure')||jsonb_strip_nulls(jsonb_build_object('status',st,'providerId',input->>'refundId',
        'failure',case when st in ('failed','check') then left(coalesce(input->>'failure','Paystack did not confirm the refund.'),300) end)));
      update public.siesie_jobs set data=d where id=j.id;
      if st in ('failed','check') then
        perform siesie_private.notify_admins('The refund for “'||(j.data->>'title')||'” needs attention: '||coalesce(left(input->>'failure',200),'Paystack did not confirm it.'),j.id);
      end if;
      n := n+1;
    end loop;
    if st in ('failed','check') and n=0 then
      select * into c from public.siesie_checkouts where reference=input->>'reference';
      if c.reference is not null then
        perform siesie_private.notify_admins('Refunding unapplied payment '||c.reference||' ('||siesie_private.cedis(c.amount)||') needs attention: '||coalesce(left(input->>'failure',200),'Paystack did not confirm it.'),c.job_id);
      end if;
    end if;
    return to_jsonb(n);

  -- Inspection windows that ran out without a dispute count as confirmed.
  elsif action='confirm_due' then
    for j in select * from public.siesie_jobs where status='completed' and (data->>'confirmBy')::timestamptz<=now() and data#>>'{payment,amount}' is not null
        order by created_at for update skip locked loop
      select * into priv from public.siesie_worker_private where id=j.worker_id;
      d := siesie_private.queue_payout(j.data||jsonb_build_object('confirmedAt',j.data->'confirmBy','autoConfirmed',true),(j.data#>>'{payment,amount}')::numeric,siesie_private.payout_destination(priv.payout));
      d := siesie_private.add_event(d,'system','The inspection window closed with no problem reported. Payout queued.');
      update public.siesie_jobs set data=d,status='confirmed' where id=j.id;
      insert into public.siesie_notices(user_id,text,job_id) values
        (j.worker_id,'The inspection window on “'||(j.data->>'title')||'” closed with no problem reported. Your payout is on its way.',j.id),
        (j.customer_id,'The inspection window on “'||(j.data->>'title')||'” closed, so the payment is being released to your pro.',j.id);
      n := n+1;
    end loop;
    return to_jsonb(n);

  -- Claims queued payouts for sending, plus sends that never reported back. A new
  -- attempt gets a new transfer reference; a stale one keeps its reference so the
  -- Edge Function can ask Paystack what happened before sending anything again.
  elsif action='claim_payouts' then
    for j in select * from public.siesie_jobs where status in ('confirmed','closed')
        and (data#>>'{payout,status}'='queued' or (data#>>'{payout,status}'='sending' and (data#>>'{payout,claimedAt}')::timestamptz<now()-interval '10 minutes'))
        order by created_at limit least(greatest(coalesce((input->>'limit')::integer,20),1),50) for update skip locked loop
      select * into priv from public.siesie_worker_private where id=j.worker_id;
      d := j.data;
      if d#>>'{payout,status}'='queued' then
        d := jsonb_set(d,'{payout,attempts}',to_jsonb(coalesce((d#>>'{payout,attempts}')::integer,0)+1));
        ref := lower(j.id)||'-p'||(d#>>'{payout,attempts}');
        insert into public.siesie_transfers(reference,job_id,amount) values(ref,j.id,(d#>>'{payout,net}')::numeric);
      else
        ref := d#>>'{payout,transferRef}';
      end if;
      d := jsonb_set(d,'{payout}',((d->'payout')-'failure')||jsonb_build_object('status','sending','transferRef',ref,'claimedAt',now(),'destination',siesie_private.payout_destination(priv.payout)));
      update public.siesie_jobs set data=d where id=j.id;
      result := result||jsonb_build_array(jsonb_build_object('jobId',j.id,'workerId',j.worker_id,'reference',ref,'amount',(d#>>'{payout,net}')::numeric,
        'stale',j.data#>>'{payout,status}'='sending','payout',priv.payout,
        'recipient',case when priv.paystack_recipient->'payout'=priv.payout then priv.paystack_recipient->>'code' end));
    end loop;
    return result;

  -- Caches the Paystack recipient for the payout details it was created from.
  elsif action='save_recipient' then
    update public.siesie_worker_private set paystack_recipient=jsonb_build_object('code',input->>'code','payout',input->'payout')
      where id::text=lower(input->>'workerId') and payout=input->'payout';
    return 'null';

  elsif action='transfer_update' then
    st := input->>'status';
    if st is null or st not in ('processing','success','failed','reversed') then raise exception 'Unknown transfer status.'; end if;
    select * into t from public.siesie_transfers where reference=input->>'reference' for update;
    if t.reference is null then return jsonb_build_object('outcome','unknown'); end if;
    if t.status=st or t.status='reversed' or (t.status='success' and st<>'reversed') or (t.status='failed' and st<>'success') then
      return jsonb_build_object('outcome','handled');
    end if;
    update public.siesie_transfers set status=st,transfer_code=coalesce(input->>'transferCode',transfer_code),updated_at=now(),
      failure=case when st in ('failed','reversed') then left(coalesce(input->>'failure','Paystack did not complete the transfer.'),300) end
      where reference=t.reference;
    if st='processing' then return jsonb_build_object('outcome','processing'); end if;
    select * into j from public.siesie_jobs where id=t.job_id for update;
    title := '“'||(j.data->>'title')||'”';
    if j.data#>>'{payout,transferRef}' is distinct from t.reference then
      perform siesie_private.notify_admins('Paystack reported '||st||' for an earlier payout attempt on '||title||' ('||t.reference||'). Check the Paystack dashboard.',j.id);
      return jsonb_build_object('outcome','earlier_attempt');
    end if;
    if st='success' then
      d := jsonb_set(j.data,'{payout}',(j.data->'payout')||jsonb_build_object('status','sent','sentAt',now(),'reference',t.reference));
      d := siesie_private.add_event(d,'system','Payout of '||siesie_private.cedis(t.amount)||' sent to '||(d#>>'{payout,destination}')||'.');
      update public.siesie_jobs set data=d,status=case when status='confirmed' then 'closed' else status end where id=j.id;
      insert into public.siesie_notices(user_id,text,job_id) values(j.worker_id,siesie_private.cedis(t.amount)||' sent to '||(d#>>'{payout,destination}')||' for '||title||'.',j.id);
      return jsonb_build_object('outcome','sent');
    end if;
    d := jsonb_set(j.data,'{payout}',((j.data->'payout')-'sentAt')||jsonb_build_object('status','failed','failure',left(coalesce(input->>'failure','Paystack did not complete the transfer.'),300)));
    d := siesie_private.add_event(d,'system','The payout transfer '||case when st='reversed' then 'was reversed' else 'failed' end||'. Siesie will retry after checking the details.');
    update public.siesie_jobs set data=d,status=case when status='closed' and j.data#>'{dispute,resolution}' is null then 'confirmed' else status end where id=j.id;
    perform siesie_private.notify_admins('The payout for '||title||' '||case when st='reversed' then 'was reversed' else 'failed' end||': '||coalesce(left(input->>'failure',200),'no reason given')||'.',j.id);
    insert into public.siesie_notices(user_id,text,job_id) values(j.worker_id,'Your payout for '||title||' did not go through. Check your payout details in your profile. Siesie will retry.',j.id);
    return jsonb_build_object('outcome','failed');

  elsif action in ('retry_payout','resolve_dispute') then
    if not exists(select 1 from public.siesie_profiles where id::text=lower(input->>'adminId') and role='admin') then raise exception 'Admin access required.' using errcode='42501'; end if;
    select * into j from public.siesie_jobs where id=input->>'jobId' for update;
    if j.id is null then raise exception 'Booking unavailable.'; end if;
    if action='retry_payout' then
      if j.data#>>'{payout,status}' is distinct from 'failed' then raise exception 'Only a failed payout can be retried.'; end if;
      d := siesie_private.add_event(jsonb_set(j.data,'{payout,status}','"queued"'),'admin','Payout retry requested.');
      update public.siesie_jobs set data=d where id=j.id;
      return 'null';
    end if;
    if j.status<>'disputed' then raise exception 'This dispute has already been resolved.'; end if;
    amount := (j.data#>>'{payment,amount}')::numeric;
    w := round((input->>'toWorker')::numeric,2);
    if amount is null or w is null or w<0 or w>amount then raise exception 'The worker allocation must be between zero and the held amount.'; end if;
    if length(trim(coalesce(input->>'note','')))<15 then raise exception 'Explain the decision in at least 15 characters.'; end if;
    back := amount-w;
    outcome := case when back=0 then 'release' when w=0 then 'refund' else 'split' end;
    summary := case outcome when 'release' then 'full release of '||siesie_private.cedis(w)||' to the worker'
      when 'refund' then 'full refund of '||siesie_private.cedis(back)
      else siesie_private.cedis(w)||' to the worker and '||siesie_private.cedis(back)||' refunded' end;
    d := jsonb_set(j.data,'{dispute,resolution}',jsonb_build_object('outcome',outcome,'toWorker',w,'toCustomer',back,'note',left(trim(input->>'note'),1200),'at',now()));
    if w>0 then
      select * into priv from public.siesie_worker_private where id=j.worker_id;
      d := siesie_private.queue_payout(d,w,siesie_private.payout_destination(priv.payout));
    end if;
    if back>0 then
      d := d||jsonb_build_object('refund',jsonb_build_object('reference',j.data#>>'{payment,reference}','amount',back,'destination',coalesce(j.data#>>'{payment,payer}','Original payment method'),'at',now(),'status','pending'));
    end if;
    d := siesie_private.add_event(d,'admin','Dispute resolved: '||summary||'.');
    update public.siesie_jobs set data=d,status='closed' where id=j.id;
    insert into public.siesie_notices(user_id,text,job_id) values
      (j.customer_id,'Your dispute on “'||(j.data->>'title')||'” is resolved: '||summary||'.',j.id),
      (j.worker_id,'The dispute on “'||(j.data->>'title')||'” is resolved: '||summary||'.',j.id);
    return jsonb_build_object('payout',w>0,'refund',case when back>0 then jsonb_build_object('reference',j.data#>>'{payment,reference}','amount',back,'full',w=0) end);
  end if;
  raise exception 'Unknown payment action.';
end $$;

revoke all on all functions in schema siesie_private from public,anon,authenticated;
revoke all on function public.siesie_payments(text,jsonb) from public,anon,authenticated;
grant execute on function public.siesie_payments(text,jsonb) to service_role;


commit;
