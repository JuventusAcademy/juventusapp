begin;
drop policy private_document_read on storage.objects;
create policy private_document_read on storage.objects for select to authenticated using(bucket_id='student-documents' and exists(select 1 from public.documents d where d.storage_path=storage.objects.name));
commit;
