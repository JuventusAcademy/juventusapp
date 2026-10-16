begin;
create table public.customer_requests(guardian_id uuid primary key references public.guardians, school_id uuid not null references public.schools, created_at timestamptz not null default now());
alter table public.customer_requests enable row level security;
revoke all on public.customer_requests from anon,authenticated;
create function public.reserve_invoice(iid uuid) returns public.invoices language plpgsql security definer set search_path='' as $$ declare inv public.invoices; begin
select * into inv from public.invoices where id=iid for update;
if not found or inv.status<>'pending' or inv.provider_id is not null or inv.amount<=0 then raise exception 'Mensalidade indisponível para emissão.'; end if;
if not exists(select 1 from public.guardians g where g.id=inv.guardian_id and g.school_id=inv.school_id and (g.cpf is not null or g.asaas_customer_id is not null)) then raise exception 'Cadastre o CPF do responsável financeiro antes de emitir.'; end if;
insert into public.payment_requests(invoice_id,school_id) values(inv.id,inv.school_id);
return inv; end $$;
revoke execute on function public.reserve_invoice(uuid) from public,anon,authenticated;
grant execute on function public.reserve_invoice(uuid) to service_role;
commit;
