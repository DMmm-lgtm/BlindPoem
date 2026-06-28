# Changelog

## 2026-06-28

### Added

- Added local browser favorites: tapping the poem heart now saves the current poem locally.
- Added a top-right favorites drawer with responsive list and detail views.
- Added share-poster generation from favorite poems, with download, copy-text, and system-share actions.
- Added lightweight daily AI image quota tracking; local fallback posters and failed AI image attempts do not consume quota.
- Added Supabase `like_count` support and an `increment_poem_like` RPC for shared poem like counts.
- Added a Cloudflare AI-based share-image API endpoint.

### Changed

- The heart interaction now saves the poem, increments the like count, and opens the reward QR code without navigating to the favorites drawer.
- The reward QR code is preserved, but the separate reward button in the poem modal was removed.
- Share posters now use varied horizontal/vertical text layouts so the image remains the visual focus.
- Direct Gemini usage was disabled. Poem generation now uses OpenRouter only, and image generation uses Cloudflare AI.
- The default Cloudflare AI image model is `@cf/black-forest-labs/flux-1-schnell`.
- Renamed the frontend AI client from `geminiClient` to `aiClient`.

### Notes

- Cloudflare image generation needs `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`; `CLOUDFLARE_AI_IMAGE_MODEL` is optional.
- If Cloudflare AI is unavailable, the app falls back to local poster generation.
