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
