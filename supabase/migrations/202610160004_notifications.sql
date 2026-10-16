begin;
create function public.notify_business_event() returns trigger language plpgsql security definer set search_path='' as $$ declare target_user uuid; target_student uuid; heading text; body_text text; tid uuid; begin
if tg_table_name='invoices' and tg_op='INSERT' then
 heading='Nova mensalidade'; body_text='Uma mensalidade está disponível no financeiro.';
 select user_id into target_user from public.guardians where id=new.guardian_id and school_id=new.school_id;
 if target_user is not null then insert into public.notifications(school_id,user_id,name,content) values(new.school_id,target_user,heading,body_text); end if;
elsif tg_table_name='callups' and tg_op='INSERT' then
 insert into public.notifications(school_id,user_id,name,content) select new.school_id,g.user_id,'Convocação para jogo','Confira a convocação do atleta no portal da família.' from public.student_guardians sg join public.guardians g on g.id=sg.guardian_id and g.school_id=sg.school_id where sg.school_id=new.school_id and sg.student_id=new.student_id and g.user_id is not null and g.active;
elsif tg_table_name='training_sessions' and tg_op='UPDATE' then
 if new.status is distinct from old.status or new.starts_at is distinct from old.starts_at then
 insert into public.notifications(school_id,user_id,name,content) select distinct new.school_id,g.user_id,case when new.status='cancelled' then 'Treino cancelado' else 'Treino atualizado' end,new.name from public.enrollments e join public.student_guardians sg on sg.student_id=e.student_id and sg.school_id=e.school_id join public.guardians g on g.id=sg.guardian_id and g.school_id=sg.school_id where e.school_id=new.school_id and e.team_id=new.team_id and e.status='active' and g.active and g.user_id is not null;
 end if;
elsif tg_table_name='news' then
 if new.published and new.publish_at<=now() then
 if tg_op='UPDATE' then if old.published then return new; end if; end if;
 insert into public.notifications(school_id,user_id,name,content) select new.school_id,m.user_id,'Notícia da escola',new.name from public.school_memberships m where m.school_id=new.school_id and m.active;
 end if;
elsif tg_table_name='announcements' then
 if new.published and new.publish_at<=now() then
 if tg_op='UPDATE' then if old.published then return new; end if; end if;
 insert into public.notifications(school_id,user_id,name,content) select distinct new.school_id,m.user_id,'Novo comunicado',new.name from public.school_memberships m where m.school_id=new.school_id and m.active and (m.role in ('admin','secretary') or new.team_id is null or exists(select 1 from public.coaches c join public.teams t on t.coach_id=c.id and t.school_id=c.school_id where t.school_id=new.school_id and t.id=new.team_id and c.user_id=m.user_id) or exists(select 1 from public.guardians g join public.student_guardians sg on sg.guardian_id=g.id and sg.school_id=g.school_id join public.enrollments e on e.student_id=sg.student_id and e.school_id=sg.school_id where g.school_id=new.school_id and g.user_id=m.user_id and g.active and e.status='active' and e.team_id=new.team_id));
 end if;
end if;
return new; end $$;
create trigger invoice_notification after insert on public.invoices for each row execute function public.notify_business_event();
create trigger callup_notification after insert on public.callups for each row execute function public.notify_business_event();
create trigger training_notification after update on public.training_sessions for each row execute function public.notify_business_event();
create trigger news_notification after insert or update on public.news for each row execute function public.notify_business_event();
create trigger announcement_notification after insert or update on public.announcements for each row execute function public.notify_business_event();
revoke execute on function public.notify_business_event() from public,anon,authenticated;
commit;
