begin;
-- Impede apropriação de cadastros e troca do cliente de cobrança pela API pública.
create function public.protect_account_links() returns trigger language plpgsql security definer set search_path='' as $$ begin
if current_setting('role',true)='authenticated' then
 if tg_op='INSERT' then if new.user_id is not null then raise exception 'Vínculo de conta reservado ao provisionamento.'; end if;
 elsif new.user_id is distinct from old.user_id then raise exception 'Vínculo de conta reservado ao provisionamento.'; end if;
 if tg_table_name='guardians' then
  if tg_op='INSERT' then if new.asaas_customer_id is not null then raise exception 'Cliente Asaas reservado à integração.'; end if;
  elsif new.asaas_customer_id is distinct from old.asaas_customer_id then raise exception 'Cliente Asaas reservado à integração.'; end if;
 end if;
end if;
return new; end $$;
create trigger guardian_account_guard before insert or update on public.guardians for each row execute function public.protect_account_links();
create trigger coach_account_guard before insert or update on public.coaches for each row execute function public.protect_account_links();
create function public.protect_reserved_invoice() returns trigger language plpgsql security definer set search_path='' as $$ begin if current_setting('role',true)='authenticated' and exists(select 1 from public.payment_requests where invoice_id=old.id) then raise exception 'Emissão já iniciada. Reconcilie a cobrança antes de alterar.'; end if; return new; end $$;
create trigger invoice_reservation_guard before update on public.invoices for each row execute function public.protect_reserved_invoice();
create function public.validate_callup() returns trigger language plpgsql security definer set search_path='' as $$ begin if not exists(select 1 from public.matches m join public.enrollments e on e.team_id=m.team_id and e.school_id=m.school_id where m.id=new.match_id and m.school_id=new.school_id and e.student_id=new.student_id and e.status='active') then raise exception 'O atleta deve estar matriculado na turma da partida.'; end if; return new; end $$;
create trigger callup_roster_guard before insert or update on public.callups for each row execute function public.validate_callup();
drop policy callups_read on public.callups;
create policy callups_read on public.callups for select to authenticated using(public.has_role(school_id,array['admin','secretary']::public.app_role[]) or public.is_guardian(school_id,student_id) or exists(select 1 from public.matches m where m.id=match_id and m.school_id=callups.school_id and public.can_coach(m.school_id,m.team_id)));
revoke execute on function public.protect_account_links(),public.protect_reserved_invoice(),public.validate_callup() from public,anon,authenticated;
commit;
