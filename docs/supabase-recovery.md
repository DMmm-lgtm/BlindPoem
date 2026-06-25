# Supabase Recovery

BlindPoem can run without Supabase, but a working Supabase project lets the site keep a shared poem pool across visitors.

## 1. Create a new Supabase project

Create a new project in Supabase, then open the SQL editor and run:

```sql
-- supabase/schema.sql
```

Copy the full contents of `supabase/schema.sql` into the SQL editor and run it.

## 2. Configure local development

Create `.env.local` in the project root:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Do not commit `.env.local`.

## 3. Verify the database

Check read access:

```bash
npm run db:check
```

Check read and insert access:

```bash
npm run db:check -- --write
```

Import more poems from a CSV or JSON file:

```bash
npm run db:import -- data/poems.sample.csv --dry-run
npm run db:import -- data/poems.sample.csv
```

CSV columns:

```csv
content,poem_title,author,mood
行到水穷处，坐看云起时,终南别业,王维,calm
```

The importer skips duplicate lines in the source file and asks Supabase to ignore rows that already have the same `content`.

Expected result:

```text
Read check passed.
Write check passed.
```

## 4. Configure Vercel

In the Vercel project settings, add:

```bash
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Then redeploy.

## 5. Configure AI generation

OpenRouter is the preferred AI provider. Add these Vercel environment variables:

```bash
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=openrouter/auto
OPENROUTER_SITE_URL=https://your-site.vercel.app
OPENROUTER_APP_NAME=BlindPoem
```

`OPENROUTER_MODEL` can be changed later if you want to test a specific model. If `GEMINI_API_KEY` is still configured, the API will use Gemini as a fallback when OpenRouter fails.

## Fallback behavior

If Supabase is missing or fails, the site will:

- save newly generated poems to browser localStorage;
- read fallback poems from localStorage first;
- fall back to the built-in poem list if localStorage is empty.
