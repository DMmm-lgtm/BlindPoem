begin;

alter table public.poems add column if not exists content_key text;
alter table public.poems add column if not exists source_url text;
alter table public.poems add column if not exists attribution_status text not null default 'pending';
alter table public.poems add column if not exists verification_reason text;
alter table public.poems add column if not exists verification_attempted_at timestamptz;
alter table public.poems add column if not exists verified_at timestamptz;

-- Every row present before this migration has an untrusted legacy attribution.
-- Keep its content, likes, mood, id and timestamps while clearing only attribution data.
update public.poems
set
  content_key = lower(regexp_replace(content, '[[:space:]，。、；！？,.!?;:：“”"''‘’《》〈〉「」『』（）()【】{}\[\]]', '', 'g')),
  poem_title = null,
  author = null,
  source_url = null,
  attribution_status = 'pending',
  verification_reason = 'legacy_reset',
  verification_attempted_at = null,
  verified_at = null
where content_key is null;

alter table public.poems
drop constraint if exists poems_attribution_status_check;
alter table public.poems
add constraint poems_attribution_status_check
check (attribution_status in ('pending', 'verified', 'not_found', 'retryable_error'));

drop index if exists public.poems_normalized_content_key;
create index poems_normalized_content_key on public.poems (content_key);

-- Browsers may never declare an attribution verified. Only the server-side
-- service role can bypass RLS and write verification results.
drop policy if exists "Public can insert poems" on public.poems;
create policy "Public can insert poems"
on public.poems
for insert
to anon
with check (
  length(trim(content)) > 0
  and length(content) <= 500
  and attribution_status = 'pending'
  and poem_title is null
  and author is null
  and source_url is null
  and (mood is null or length(mood) <= 120)
);

commit;
