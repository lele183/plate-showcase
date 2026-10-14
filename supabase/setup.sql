-- Run once in the Supabase SQL Editor for project gmsegfbejshohdgnolwb.
-- Creates the Yanco schema, storage buckets, and owner-based access policies.
-- The transaction rolls back if any statement fails.
begin;
create table if not exists public.yanco_schema_migrations(version text primary key, applied_at timestamptz default now());
alter table public.yanco_schema_migrations enable row level security;
revoke all on public.yanco_schema_migrations from anon,authenticated;
create table if not exists public.yanco_catalogs (
 id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users(id) on delete cascade,
 name text not null, status text not null default 'draft' check(status in ('draft','active','archived')),
 published boolean not null default false, source_path text, created_at timestamptz not null default now(),
 check(not published or owner_id is null)
);
create table if not exists public.yanco_collections (
 id text primary key, catalog_id uuid not null references public.yanco_catalogs(id) on delete cascade,
 data jsonb not null, created_at timestamptz not null default now(), unique(id,catalog_id)
);
create table if not exists public.yanco_items (
 id text primary key, catalog_id uuid not null references public.yanco_catalogs(id) on delete cascade,
 collection_id text not null, data jsonb not null,
 foreign key(collection_id,catalog_id) references public.yanco_collections(id,catalog_id) on delete cascade
);
create table if not exists public.yanco_uploads (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 path text not null unique, filename text not null, content_type text not null, size bigint not null check(size between 1 and 104857600),
 purpose text not null check(purpose in ('catalog','menu','food')), created_at timestamptz not null default now()
);
create table if not exists public.yanco_scenes (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null, data jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.yanco_sessions (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null, data jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.yanco_jobs (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 upload_id uuid references public.yanco_uploads(id) on delete set null,
 kind text not null check(kind in ('catalog','menu','food-preview')),
 status text not null default 'queued' check(status in ('queued','running','review','completed','failed','cancelled')),
 progress integer not null default 0 check(progress between 0 and 100), input jsonb not null default '{}', result jsonb,
 error text, run_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists yanco_catalog_owner on public.yanco_catalogs(owner_id,status);
create index if not exists yanco_collection_catalog on public.yanco_collections(catalog_id);
create index if not exists yanco_item_catalog on public.yanco_items(catalog_id);
create index if not exists yanco_item_collection on public.yanco_items(collection_id);
create index if not exists yanco_job_owner on public.yanco_jobs(owner_id,created_at);
alter table public.yanco_catalogs enable row level security;
alter table public.yanco_collections enable row level security;
alter table public.yanco_items enable row level security;
alter table public.yanco_uploads enable row level security;
alter table public.yanco_scenes enable row level security;
alter table public.yanco_sessions enable row level security;
alter table public.yanco_jobs enable row level security;
grant select on public.yanco_catalogs,public.yanco_collections,public.yanco_items to anon,authenticated;
grant insert,update,delete on public.yanco_catalogs,public.yanco_collections,public.yanco_items to authenticated;
grant select,insert,update,delete on public.yanco_uploads,public.yanco_scenes,public.yanco_sessions to authenticated;
grant select on public.yanco_jobs to authenticated;
grant all on public.yanco_catalogs,public.yanco_collections,public.yanco_items,public.yanco_uploads,public.yanco_scenes,public.yanco_sessions,public.yanco_jobs to service_role;
create policy yanco_catalog_read on public.yanco_catalogs for select using ((published and status='active') or owner_id=auth.uid());
create policy yanco_catalog_write on public.yanco_catalogs for all to authenticated using(owner_id=auth.uid() and not published) with check(owner_id=auth.uid() and not published);
create policy yanco_collection_read on public.yanco_collections for select using(exists(select 1 from public.yanco_catalogs c where c.id=catalog_id and ((c.published and c.status='active') or c.owner_id=auth.uid())));
create policy yanco_collection_write on public.yanco_collections for all to authenticated using(exists(select 1 from public.yanco_catalogs c where c.id=catalog_id and c.owner_id=auth.uid() and not c.published)) with check(exists(select 1 from public.yanco_catalogs c where c.id=catalog_id and c.owner_id=auth.uid() and not c.published));
create policy yanco_item_read on public.yanco_items for select using(exists(select 1 from public.yanco_catalogs c where c.id=catalog_id and ((c.published and c.status='active') or c.owner_id=auth.uid())));
create policy yanco_item_write on public.yanco_items for all to authenticated using(exists(select 1 from public.yanco_catalogs c where c.id=catalog_id and c.owner_id=auth.uid() and not c.published)) with check(exists(select 1 from public.yanco_catalogs c where c.id=catalog_id and c.owner_id=auth.uid() and not c.published));
create policy yanco_upload_owner on public.yanco_uploads for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid() and path like auth.uid()::text||'/%');
create policy yanco_scene_owner on public.yanco_scenes for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy yanco_session_owner on public.yanco_sessions for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy yanco_job_owner_read on public.yanco_jobs for select to authenticated using(owner_id=auth.uid());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('yanco-user-assets','yanco-user-assets',false,104857600,array['application/pdf','image/jpeg','image/png','image/webp','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
 ('yanco-catalog','yanco-catalog',true,104857600,array['application/pdf','image/webp','image/png','image/jpeg'])
on conflict(id) do nothing;
create policy yanco_private_asset_read on storage.objects for select to authenticated using(bucket_id='yanco-user-assets' and (storage.foldername(name))[1]=auth.uid()::text);
create policy yanco_private_asset_insert on storage.objects for insert to authenticated with check(bucket_id='yanco-user-assets' and (storage.foldername(name))[1]=auth.uid()::text);
create policy yanco_private_asset_delete on storage.objects for delete to authenticated using(bucket_id='yanco-user-assets' and (storage.foldername(name))[1]=auth.uid()::text);
create policy yanco_public_asset_read on storage.objects for select using(bucket_id='yanco-catalog');
create or replace function public.yanco_reserve_preview(p_owner uuid,p_upload uuid,p_input jsonb,p_user_limit int,p_site_limit int)
returns uuid language plpgsql security definer set search_path=public as $$
declare job_id uuid; begin
 perform pg_advisory_xact_lock(20261013);
 if not exists(select 1 from yanco_uploads where id=p_upload and owner_id=p_owner and purpose='food') then raise exception 'Upload is unavailable'; end if;
 select id into job_id from yanco_jobs where owner_id=p_owner and upload_id=p_upload and kind='food-preview' and status in ('queued','running','completed') order by created_at desc limit 1;
 if job_id is not null then return job_id; end if;
 if (select count(*) from yanco_jobs where kind='food-preview' and owner_id=p_owner and created_at>=date_trunc('day',now()))>=p_user_limit then raise exception 'Your daily preview allowance has been reached'; end if;
 if (select count(*) from yanco_jobs where kind='food-preview' and created_at>=date_trunc('day',now()))>=p_site_limit then raise exception 'Daily preview capacity has been reached'; end if;
 insert into yanco_jobs(owner_id,upload_id,kind,input) values(p_owner,p_upload,'food-preview',p_input) returning id into job_id;
 return job_id;
end $$;
revoke all on function public.yanco_reserve_preview(uuid,uuid,jsonb,int,int) from public,anon,authenticated;
grant execute on function public.yanco_reserve_preview(uuid,uuid,jsonb,int,int) to service_role;

insert into public.yanco_schema_migrations(version) values('202610130001_yanco.sql') on conflict(version) do nothing;
commit;
