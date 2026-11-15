-- Files in Storage (proposal §5: uploads are kept, logos can be uploaded).
-- 1. content-files: the original upload of a content version (PDF, Word, image). Written by the server only (service role,
--    after the audit route has parsed the file); read by whoever may see the content item.
-- 2. brand-assets: logo images. Members read; only the owner writes.
-- Both buckets are private: pages get short-lived signed URLs. Path layout: content-files/<org>/<version>/<file>,
-- brand-assets/<org>/<asset>/<file>.

-- content_versions.file_path already exists (P1 schema); add the original name and type
alter table public.content_versions add column file_name text, add column file_type text;

insert into storage.buckets (id, name, public, file_size_limit) values
  ('content-files', 'content-files', false, 10485760),
  ('brand-assets', 'brand-assets', false, 2097152)
on conflict (id) do nothing;

-- the subquery runs as the caller, so content_versions' own RLS (can_see_item) decides who may read a file
create policy content_files_read on storage.objects for select to authenticated
  using (bucket_id = 'content-files' and exists (select 1 from public.content_versions v where v.file_path = name));

create policy brand_assets_read on storage.objects for select to authenticated
  using (bucket_id = 'brand-assets' and private.my_role(((storage.foldername(name))[1])::uuid) is not null);
create policy brand_assets_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'brand-assets' and private.has_role(((storage.foldername(name))[1])::uuid, '{owner}'));
create policy brand_assets_update on storage.objects for update to authenticated
  using (bucket_id = 'brand-assets' and private.has_role(((storage.foldername(name))[1])::uuid, '{owner}'))
  with check (bucket_id = 'brand-assets' and private.has_role(((storage.foldername(name))[1])::uuid, '{owner}'));
create policy brand_assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'brand-assets' and private.has_role(((storage.foldername(name))[1])::uuid, '{owner}'));
