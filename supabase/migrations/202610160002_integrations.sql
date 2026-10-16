begin;
alter table public.guardians add column cpf text check(cpf is null or cpf ~ '^[0-9]{11}$');
alter table public.invoices add constraint competence_month check(extract(day from competence)=1);
create table public.payment_requests (invoice_id uuid primary key references public.invoices, school_id uuid not null references public.schools, state text not null default 'processing' check(state in ('processing','completed','uncertain')), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.payment_requests enable row level security;
revoke all on public.payment_requests from anon,authenticated;

-- Só o servidor atribui papéis. Também associa o usuário convidado ao cadastro existente.
create function public.provision_member(sid uuid,uid uuid,member_role public.app_role,member_email text) returns void language plpgsql security definer set search_path='' as $$ begin
insert into public.school_memberships(school_id,user_id,role) values(sid,uid,member_role);
if member_role='guardian' then update public.guardians set user_id=uid where school_id=sid and lower(email)=lower(member_email) and (user_id is null or user_id=uid); if not found then raise exception 'Cadastre o responsável com este e-mail antes de convidá-lo.'; end if; end if;
if member_role='coach' then update public.coaches set user_id=uid where school_id=sid and lower(email)=lower(member_email) and (user_id is null or user_id=uid); if not found then raise exception 'Cadastre o professor com este e-mail antes de convidá-lo.'; end if; end if;
end $$;
revoke execute on function public.provision_member(uuid,uuid,public.app_role,text) from public,anon,authenticated;
grant execute on function public.provision_member(uuid,uuid,public.app_role,text) to service_role;

-- Aplica o estado canônico consultado no provedor, dentro de uma transação idempotente.
create function public.apply_asaas_state(iid uuid,eid text,event_name text,remote_id text,remote_status text,remote_amount numeric,remote_url text,payment_date timestamptz) returns void language plpgsql security definer set search_path='' as $$ declare inv public.invoices; mapped text; begin
select * into inv from public.invoices where id=iid for update;
if not found then raise exception 'Mensalidade não encontrada'; end if;
if inv.provider_id is not null and inv.provider_id<>remote_id then raise exception 'Identificador do provedor divergente'; end if;
if inv.amount<>remote_amount then raise exception 'Valor divergente do provedor. Requer conciliação manual.'; end if;
mapped=case remote_status when 'RECEIVED' then 'paid' when 'RECEIVED_IN_CASH' then 'paid' when 'CONFIRMED' then 'processing' when 'OVERDUE' then 'overdue' when 'PENDING' then 'pending' when 'REFUNDED' then 'refunded' when 'DELETED' then 'cancelled' else null end;
if mapped is null then raise exception 'Estado do provedor requer revisão: %',remote_status; end if;
insert into public.payment_events(id,school_id,invoice_id,event_type) values(eid,inv.school_id,iid,event_name) on conflict(id) do nothing;
if not found then return; end if;
update public.invoices set provider_id=remote_id,provider_url=remote_url,status=mapped,paid_at=case when mapped='paid' then coalesce(payment_date,now()) else inv.paid_at end where id=iid;
if mapped='paid' then insert into public.payments(school_id,invoice_id,provider_id,amount,paid_at) values(inv.school_id,iid,remote_id,remote_amount,coalesce(payment_date,now())) on conflict(provider_id) do nothing; end if;
if mapped='paid' and inv.status<>'paid' then insert into public.notifications(school_id,user_id,name,content) select inv.school_id,g.user_id,'Pagamento confirmado','O pagamento da mensalidade foi confirmado pela escola.' from public.guardians g join public.school_memberships m on m.school_id=g.school_id and m.user_id=g.user_id where g.id=inv.guardian_id and g.school_id=inv.school_id and g.user_id is not null and m.active; end if;
update public.payment_requests set state='completed',updated_at=now() where invoice_id=iid;
end $$;
revoke execute on function public.apply_asaas_state(uuid,text,text,text,text,numeric,text,timestamptz) from public,anon,authenticated;
grant execute on function public.apply_asaas_state(uuid,text,text,text,text,numeric,text,timestamptz) to service_role;

-- Convocação: responsável apenas confirma o próprio vínculo, sem poder editar atletas ou partida.
create function public.confirm_callup(cid uuid,answer boolean) returns void language plpgsql security definer set search_path='' as $$ declare c public.callups; begin select * into c from public.callups where id=cid; if not public.is_guardian(c.school_id,c.student_id) then raise exception 'Acesso não autorizado'; end if; update public.callups set confirmed=answer where id=cid; end $$;
revoke execute on function public.confirm_callup(uuid,boolean) from public,anon;
grant execute on function public.confirm_callup(uuid,boolean) to authenticated;

-- Índices dos vínculos consultados pelas políticas.
create index on public.guardians(school_id,user_id);
create index on public.student_guardians(school_id,student_id,guardian_id);
create index on public.enrollments(school_id,student_id,team_id,status);
create index on public.coaches(school_id,user_id);
create index on public.training_sessions(school_id,starts_at);
create index on public.invoices(school_id,due_date,status);
create index on public.invoices(school_id,paid_at) where status='paid';
create index on public.notifications(school_id,user_id,created_at);
create index on public.school_memberships(user_id,school_id) where active;
commit;
