# Local changes (edwardkh fork)

Divergences from [freeyoung/pi-localllm-provider](https://github.com/freeyoung/pi-localllm-provider).

## 0.5.2 — llama.cpp: honor the server's n_predict instead of hard-capping maxTokens at 8192

- **Problem:** `detectLlamaCpp` applied `capTokens(contextWindow)` unconditionally
  (`min(ctx/2, 8192)`), so a server started with `--n-predict -1` (unlimited) was
  still capped at 8192 output tokens per turn, and the cap was never read from
  `/props`.
- **Change:** `detect.ts` — `LlamaCppProps` now reads
  `default_generation_settings.params.{n_predict,max_tokens}`.
  - `n_predict <= 0` (unlimited) → `maxTokens = contextWindow` (safe: pi-ai clamps
    per-turn max_tokens to the context left after the prompt).
  - `n_predict > 0` → `min(n_predict, contextWindow)`.
  - missing (e.g. a router that doesn't proxy GenParams) → old `capTokens` fallback
    (superseded by the 2nd change below).
  `capTokens` itself is unchanged; all other backends are unaffected.
- **Tests:** 4 new cases in `detect.test.ts` (`detectLlamaCpp` block).
- **Install:** see replacement instructions in the commit message / PR.

## 0.5.2 (2nd change, 2026-07-08) — llama.cpp: default maxTokens to contextWindow when /props doesn't expose n_predict

- **Problem:** the llama.cpp *router* reports `default_generation_settings.params: null`
  (it doesn't proxy GenParams), so the "missing" branch fell back to
  `capTokens(ctx)` = 8192 even though the backend runs `-np -1`.
- **Change:** `detect.ts` — missing `n_predict`/`max_tokens` is now treated the same
  as `<= 0` (unlimited): `maxTokens = contextWindow`. A positive declared value is
  still honored, clamped to `contextWindow`. `capTokens` is unchanged for all other
  backends.
- **Tests:** updated the no-params expectation in the "combines /props …" case
  (4096 → 8192); added a router-style case (params null, n_ctx 0, n_ctx_train
  262144 → maxTokens 262144).
