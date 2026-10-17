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
