# X Reply Assistant v0.9.49 (pmelhcffhkbeiddhiapenebnbfoigfph) — reverse-engineering notes

Manifest V3. Plain JS, not minified. Files: background/service-worker.js, content/x-reply.js (+css), popup/, settings/, shared/{defaults,logic,i18n}.js.

## Architecture
- Content script (x.com, twitter.com): reads tweets via `article[data-testid="tweet"]`, `tweetText`, `User-Name`; injects UI, types into `tweetTextarea_0` and clicks `tweetButton*` (simulated typing/mouse with random delays). MutationObserver keeps it alive on SPA navigation.
- Service worker: handles messages AI_GENERATE / AI_REWRITE / AI_TEST, entitlement checks, quota, X-account binding, Wallchain score lookup.
- Storage: chrome.storage.local (settings, profiles, history, authSession).

## AI generation
- User supplies own API key (OpenAI-compatible `/chat/completions`, Anthropic `/messages`, Gemini `generateContent`, DeepSeek, xAI, Ollama). Keys stay local and calls go straight from the extension to the provider.
- Prompt = profile (prompt/style/avoid/min-max words/emoji/question rate) + tweet context, built in shared/logic.js `buildPrompt`; `validateReply` checks length/duplicates against last 25 replies and retries once with the error reason.
- GM/GN presets: trigger words -> random start/end templates with `{name}`/`{day}`, no AI call.

## Features
Bulk reply (random 20-35s delays, reading delay, auto-like), GM/GN automation, keyword search automation, follow/unfollow automation (follower filters, cooldowns), Wallchain score filter, history, themes, i18n.

## Paywall / backend (https://x-reply-extention.vercel.app, Supabase-style session)
- `/auth/refresh`, `GET /api/entitlements` (Bearer token) -> `{active, features:{reply,...}}`. Checked by `checkEntitlement()` in the service worker before every generate/rewrite. Subscription is enforced client-side by this call; the server is the real gate for sign-in, quotas (`/api/member/manual-gm/*`), promotions, and X-account linking (`/api/x-account*`, max accounts per plan).
- Login via `chrome.identity` (Google).
- Third party: `api.wallchain.xyz/extension/x_score/score/<handle>` (cached 5 min).

## Notes
Follow/unfollow/bulk features automate X actions, which violates X's automation rules and risks account limits.
