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

## 0.5.2 (3rd change, 2026-08-20) — llama.cpp router: read the real runtime context from /v1/models instead of n_ctx_train

- **Problem:** the llama.cpp *router*'s `/props` reports
  `default_generation_settings.n_ctx = 0`, so the fallback chain fell through to
  `meta.n_ctx_train` — the model's trained context baked into the GGUF (e.g.
  262144) — even though the worker runs `--ctx-size 131072`. The provider then
  advertised a 262k window (and 262k maxTokens) against a 131k worker.
- **Change:** `detect.ts` — `LlamaCppModels` extended with `meta.n_ctx` and
  `status.{value,args}`; new `ctxSizeFromArgs()` helper parses `--ctx-size` from
  the per-model worker argv. New `contextWindow` fallback chain:
  `props.n_ctx` (single-server) → `meta.n_ctx` (router, loaded) → `--ctx-size`
  from `status.args` (router, unloaded) → `n_ctx_train` (last resort) → 32768.
  Matches the `litellm/init-models.sh` `extract_ctx_size` precedent.
  `maxTokens` follows automatically (router `params: null` →
  `maxTokens = contextWindow`).
- **Tests:** router case in `detect.test.ts` updated to assert 131072 (was
  asserting the buggy 262144); added an unloaded-model case relying solely on
  `status.args`. Verified live against a running router: contextWindow/maxTokens
  now 131072.

## 0.5.2 (4th change, 2026-08-20) — llama.cpp router: enumerate all preset models instead of only the first

- **Problem:** `detectLlamaCpp` read only `/v1/models` `data[0]` and returned a
  one-element model list, so a router (`llama-server --models-preset`) silently
  dropped every preset model after the first — a second model added to
  `preset.ini` never appeared in the picker.
- **Change:** `detect.ts` — router mode is detected up front
  (`props.role === "router" || props.model_path === "none"`) and every
  `/v1/models` entry is mapped to a model:
  - `contextWindow`: `meta.n_ctx` → `--ctx-size` from `status.args` →
    `n_ctx_train` → 32768 (same precedence as the 3rd change).
  - `maxTokens`: `--n-predict` (alias `--max-tokens`) from the worker argv;
    positive → clamped to `contextWindow`, `-1`/absent → `contextWindow`.
  - `name`: `--alias` from the worker argv, else the id basename.
  - `input`: `["text","image"]` when `architecture.input_modalities` includes
    `image` or the worker argv has `--mmproj`.
  - `loaded`: `status.value === "loaded"`; `sizeBytes`: `meta.size`;
    `quantization`: `meta.ftype`.
  - An empty model list returns `{ apiType: "llamacpp", models: [] }` (not
    `null`) so the backend isn't mislabeled by the generic OpenAI probe.
  The single-server path is unchanged. `ctxSizeFromArgs()` generalized to
  `argValue(args, flag)`.
- **Tests:** `detect.test.ts` — router two-model case (loaded + unloaded,
  context sources, loaded flags, size, quantization, modalities), positive
  `--n-predict` honored and clamped, empty-`data` case, and a `detectModels`
  chain case proving no fall-through to the OpenAI probe. Existing
  single-server cases pass unmodified.
