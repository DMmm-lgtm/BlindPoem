create extension if not exists pgcrypto;

create table if not exists public.poems (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  poem_title text,
  author text,
  mood text,
  created_at timestamptz not null default now()
);

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
