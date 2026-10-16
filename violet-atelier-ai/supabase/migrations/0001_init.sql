-- Violet Atelier AI · esquema inicial. Ejecutar en el SQL Editor de Supabase o con `supabase db push`.
create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text, avatar_path text, units text not null default 'cm',
  preferences jsonb not null default '{}', privacy jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  category text, source_type text not null default 'scratch' check (source_type in ('photo','references','sketch','scratch','duplicate')),
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.reference_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  storage_path text not null, mime text not null, bytes integer not null,
  kind text not null default 'photo' check (kind in ('photo','sketch','reference')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.garment_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','done','error')),
  provider text, model text, schema_version int not null default 1,
  result jsonb, error text, attempts int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null, version int not null default 1,
  validation_status text not null default 'unvalidated' check (validation_status in ('unvalidated','geometry_valid','user_reviewed')),
  units text not null default 'mm', size_label text, params jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (project_id, name, version)
);

create table public.pattern_pieces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pattern_id uuid not null references public.patterns(id) on delete cascade,
  name text not null, geometry jsonb not null, cut_qty int not null default 1, notes text,
  validation_status text not null default 'unvalidated',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  name text not null, value_mm numeric not null check (value_mm > 0),
  source text not null default 'user' check (source in ('user','calculated')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid default auth.uid() references auth.users(id) on delete cascade, -- null = catálogo del sistema
  name text not null, category text, composition text, gsm numeric, stretch text, weave text,
  drape text, thickness_mm numeric, transparency text, sheen text, texture_path text,
  color text, print text, care text, sewing_notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.design_variants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null, material_assignments jsonb not null default '{}', camera jsonb, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.renderings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  variant_id uuid not null references public.design_variants(id) on delete cascade,
  storage_path text not null, kind text not null default 'capture' check (kind in ('capture','concept')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  pattern_id uuid references public.patterns(id) on delete set null,
  format text not null check (format in ('svg','pdf','pdf_scale')), storage_path text,
  validation_snapshot jsonb, scale_verified boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['profiles','projects','reference_images','garment_analyses','patterns','pattern_pieces','measurements','materials','design_variants','renderings','exports'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- RLS: cada usuario solo ve y modifica lo suyo; las filas hijas deben colgar de un proyecto propio.
create policy own_profile on public.profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_projects on public.projects for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_measurements on public.measurements for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and (project_id is null or exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())));

do $$ declare t text; begin
  foreach t in array array['reference_images','garment_analyses','patterns','design_variants','exports'] loop
    execute format($f$create policy own_rows on public.%I for all using (user_id = auth.uid())
      with check (user_id = auth.uid() and exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()))$f$, t);
  end loop;
end $$;

create policy own_pieces on public.pattern_pieces for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.patterns x where x.id = pattern_id and x.user_id = auth.uid()));
create policy own_renderings on public.renderings for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.design_variants v where v.id = variant_id and v.user_id = auth.uid()));
create policy read_materials on public.materials for select using (owner_id is null or owner_id = auth.uid());
create policy write_own_materials on public.materials for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Perfil automático al registrarse
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (user_id, display_name) values (new.id, split_part(new.email, '@', 1)) on conflict do nothing; return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Storage privado: ruta {user_id}/{project_id}/{archivo}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reference-images', 'reference-images', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy ref_read on storage.objects for select using (bucket_id = 'reference-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy ref_insert on storage.objects for insert with check (bucket_id = 'reference-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy ref_delete on storage.objects for delete using (bucket_id = 'reference-images' and (storage.foldername(name))[1] = auth.uid()::text);
