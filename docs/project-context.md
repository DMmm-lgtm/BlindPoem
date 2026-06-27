# BlindPoem Project Context

BlindPoem is a web artwork where visitors click emotion emoji to reveal poetry.

## Current Baseline

- Production domain: https://www.blindpoem.space
- Deployment: Vercel
- Database: Supabase
- AI provider: OpenRouter
- Repository branch: main
- Current state: usable baseline

## Runtime Flow

When a visitor clicks an emoji:

1. Try AI generation through `/api/generate-poem`.
2. Use OpenRouter free text models, with multiple model fallbacks.
3. Save successful AI poems to Supabase and browser localStorage.
4. If AI fails, read from Supabase.
5. If Supabase fails, read browser localStorage.
6. If localStorage is empty, use built-in fallback poems.

## Important Boundaries

Future work should be split by module. Avoid changing AI, database, deployment, intro animation, emoji motion, and poem modal behavior in the same task.

Recommended thread split:

- Intro animation polish
- Emoji motion and collision polish
- Poem modal and close interaction
- Mobile performance and visual density
- AI prompt and poem quality tuning
- Supabase data maintenance

## Current Design Notes

- The current version is a stable recovery baseline, not the final visual direction.
- The original implementation came from vibe coding in Cursor, so some effects may need careful staged rewriting.
- Prefer focused, reversible commits.
- Before editing, read the relevant code area first and keep changes scoped.

## Sensitive Configuration

Do not commit API keys or local secrets.

Local-only secrets live in `.env.local`.
Vercel environment variables include:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_APP_NAME`
- `OPENROUTER_SITE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
