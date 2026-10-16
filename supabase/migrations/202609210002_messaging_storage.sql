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
