# TD-22 before-map: type-erasing casts, remeasured at fd9f061

Branch: debt/td22-casts. Worktree: $HOME/workspace/.worktrees/github.com/SylphxAI/puzzled/td-22.
Base: origin/main = fd9f061f4ea032cec188582a2ba1653cec106deb (fetched 2026-09-21; after TD-15 #174).
Scope: register row TD-22 - "type-erasing casts cluster on the registry boundary".

## Register delta (remeasured, not carried over)
Register (written against e590b5c) says "12 non-test sites" and lists 5. Not reproducible:
- `rg -n 'as any|as unknown as' apps/puzzled/src --glob '!*.test.*'` at fd9f061 -> **7 matching lines = 6 code sites + 1 prose false positive**
  (features/gamification/components/streak-bar.tsx:126 is a JSX comment: "Show freeze count if user has any").
- The same command at e590b5c -> the same 6-line set (5 code + prose); 9 lines including tests.
- So the measured cluster is 6 code sites; every one of the register's 5 named sites is in it, plus share-result-card.ts:179 (added later by the S3 result-card work, #164).

## The 6 code sites at fd9f061 (file:line + snippet + verdict)

| Site (apps/puzzled/src/...) | Cast | Why it exists | True shape | Verdict |
| --- | --- | --- | --- | --- |
| games/registry.ts:245 | `config.validateAndScore(solution as any, puzzleData as any, submission)` | Registry resolves a config by runtime slug; neither the slug->payload pairing nor the config's concrete type args are statically known. The `as any` silenced the call. | Each module's stored `{solution, puzzleData}` was produced by that same module's `generatePuzzle` (registry.server.ts); is opaque to the registry. | FIXED: boundary re-typed `GameConfig<unknown, unknown, unknown, unknown>` (`RegisteredGameConfig`); casts removed; runtime identical. |
| lib/redis.ts:92 | `return val as unknown as T` | `redisGet<T>`: JSON values parse; raw strings (redisSet passthrough) do not - the catch returned the raw string asserted as T. | `T` is caller-claimed; parse result / raw fallback are both opaque. | FIXED: parse narrowed into an `unknown` local, one documented final `as T` claim (single assertion; `as unknown as` gone). |
| lib/i18n/request.ts:354 | `deepMerge(messages, localeMessages as unknown as Messages)` | Introduced with the original request.ts (commit 67aada4/earlier); `localeMessages: Partial<LocaleMessages>` where `Messages = Record<string, unknown>`. | `Partial<LocaleMessages>` already carries an implicit index signature - the erasure was unnecessary. | FIXED: cast removed outright (typecheck green). No other i18n leg in flight (open PRs #175/#176/#177 do not touch it; #176 is the queued logger seam). |
| app/[locale]/(auth)/_components/auth-fields.tsx:11 | `OAuthIcons as unknown as Record<string, ProviderIcon>` | `OAuthIcons` (packages/ui) is a 10-key `as const` of `(props: SVGProps<SVGSVGElement>) => JSX.Element` components; local `ProviderIcon` wants `(props: { className?: string; 'aria-hidden'?: boolean | 'true' }) => ReactNode`. | Each icon is structurally assignable to `ProviderIcon` (SVGProps accepts those props; JSX.Element is a ReactNode). | FIXED: annotated direct assignment `const PROVIDER_ICONS: Record<string, ProviderIcon> = OAuthIcons`; cast removed. |
| shared/hooks/use-sound.ts:55 | `(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext` | Safari's prefixed constructor is not in lib.dom's Window. | A standard global augmentation: `declare global { interface Window { webkitAudioContext?: typeof AudioContext } }`. | FIXED: augmentation added; `new (window.AudioContext || window.webkitAudioContext)()`; cast removed. |
| features/daily/lib/share-result-card.ts:179 | `files: [file] as unknown as File[]` | `ShareData.files` is `File[]`; the injectable File seam returns `ShareResultCardFile = Blob & { name?: string }` ("File-shaped blob") because some runtimes lack File and tests inject doubles. | Non-File-shaped at the type level only; the browser share sheet needs a real File at runtime. | SKIPPED: outside this PR's touch limits (not the registry, not one of the 5 named sites), and the loose type is the documented design of the injection seam. Could become a single-step `as File[]` narrowing in a later pass if wanted. |

Prose false positive: streak-bar.tsx:126 (comment) - not a cast.

## Registry boundary - the design space considered
1. Discriminated union keyed by game / per-game schema validation: would give real payload proof but touches every game and adds runtime validation -> changes runtime behaviour; belongs to TD-09's product decision (delete the TS scorer vs make it the single scorer).
2. Generic per-config `validateAndScore<TPuzzle>`: no static relation exists between a runtime slug string and the payload types a caller holds; a generic cannot recover the pairing. Proven by construction: callers pass DB/JSON `unknown`; the only static witness would be per-game parsers (option 1).
3. **Chosen**: opaque `unknown` view (`RegisteredGameConfig`) + bivariant method declarations for `validateGuess`/`validateAndScore`, so all 19 concrete configs stay assignable and the erased view remains callable with opaque data. Removes `any` from the boundary and the two `as any`s at the call site; runtime unchanged.

## Residual (kept, documented)
- lib/redis.ts: one `as T` (deserialization claim, no runtime validator exists for T; not an erasure).
- share-result-card.ts:179 `as unknown as File[]` (skipped, above).
- test-file casts are untouched (23 -> 18 matching lines across src incl. tests; non-test 7 -> 2 lines, of which 1 is the prose false positive).
