create extension if not exists pgcrypto;

create table if not exists public.poems (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  poem_title text,
  author text,
  mood text,
  like_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.poems
add column if not exists like_count integer not null default 0;

create unique index if not exists poems_content_key on public.poems (content);
create index if not exists poems_created_at_idx on public.poems (created_at desc);
create index if not exists poems_mood_idx on public.poems (mood);

alter table public.poems enable row level security;

drop policy if exists "Public can read poems" on public.poems;
create policy "Public can read poems"
on public.poems
for select
to anon
using (true);

drop policy if exists "Public can insert poems" on public.poems;
create policy "Public can insert poems"
on public.poems
for insert
to anon
with check (
  length(trim(content)) > 0
  and length(content) <= 500
  and (poem_title is null or length(poem_title) <= 200)
  and (author is null or length(author) <= 120)
  and (mood is null or length(mood) <= 120)
);

create or replace function public.increment_poem_like(poem_content text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_like_count integer;
begin
  update public.poems
  set like_count = like_count + 1
  where content = poem_content
  returning like_count into next_like_count;

  return next_like_count;
end;
$$;

grant execute on function public.increment_poem_like(text) to anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'share-backgrounds',
  'share-backgrounds',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.share_backgrounds (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  image_url text not null,
  content text not null,
  poem_title text,
  author text,
  visual_brief text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists share_backgrounds_created_at_idx
on public.share_backgrounds (created_at desc);

create index if not exists share_backgrounds_tags_idx
on public.share_backgrounds using gin (tags);

alter table public.share_backgrounds enable row level security;

drop policy if exists "Public can read share backgrounds" on public.share_backgrounds;
create policy "Public can read share backgrounds"
on public.share_backgrounds
for select
to anon
using (true);

drop policy if exists "Public can insert share backgrounds" on public.share_backgrounds;
create policy "Public can insert share backgrounds"
on public.share_backgrounds
for insert
to anon
with check (
  storage_path like 'generated/%'
  and image_url like 'http%'
  and length(trim(content)) > 0
  and length(content) <= 500
  and (poem_title is null or length(poem_title) <= 200)
  and (author is null or length(author) <= 120)
  and (visual_brief is null or length(visual_brief) <= 1000)
  and coalesce(array_length(tags, 1), 0) <= 32
);

drop policy if exists "Public can read share background files" on storage.objects;
create policy "Public can read share background files"
on storage.objects
for select
to anon
using (bucket_id = 'share-backgrounds');

drop policy if exists "Public can upload generated share backgrounds" on storage.objects;
create policy "Public can upload generated share backgrounds"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'share-backgrounds'
  and name like 'generated/%'
);
