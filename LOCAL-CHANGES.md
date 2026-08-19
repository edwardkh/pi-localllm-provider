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
  - missing (e.g. a router that doesn't proxy GenParams) → old `capTokens` fallback.
  `capTokens` itself is unchanged; all other backends are unaffected.
- **Tests:** 4 new cases in `detect.test.ts` (`detectLlamaCpp` block).
- **Install:** see replacement instructions in the commit message / PR.
