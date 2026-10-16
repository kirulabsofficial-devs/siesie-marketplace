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
