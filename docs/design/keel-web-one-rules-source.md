# Puzzled on keel-web with one rules source

**Status:** proposed (Design lane, 2026-10-03). Work: W-10072 (parent W-0658, wave W3).
**Decides:** how the web moves off Next.js, and which code owns game rules afterwards.

## Problem

Game rules exist twice, in two languages.

- `crates/puzzled-core` (Rust, about 24k lines) serves, generates and validates
  every puzzle. It is the only authority (ADR-170, `proto/puzzled/v1/puzzle.proto:19`).
- `apps/puzzled/src/games` (TypeScript, about 50k lines plus 11k lines of tests)
  repeats the rules and generators for client play. The Rust generators keep a
  byte-for-byte parity contract with the TS ones through exported fixtures
  (`puzzle_play/generate/mod.rs:11-13`). Some TS paths left from before the
  cutover are now dead: `defaultParsePuzzleData` generates a puzzle on the
  client from `Date.now()` (`games/types.ts:155-169`), and the TS LLM generator
  remains (`games/llm-generators.server.ts`, `features/puzzle-generator`).

The web is also over the mobile weight budget. Measured on 2026-10-03 with
headless Chromium 154 on the desk CPU (AMD EPYC 9454). These are not phone figures.

| Page, 390 px | JS transferred (gzip) | JS decoded | TBT, slow 4G + 4x CPU |
| --- | --- | --- | --- |
| `/` | 413 KB | 1.28 MB | 391 ms |
| `/games/word-guess` | 530 KB | 1.61 MB | 742 ms |

The company decision is that every site moves to keel-web (owner
`company/decisions.md`, 2026-10-02). Puzzled is wave W3 of W-0658.

## Decision

Port the web to keel-web, and make the client's game logic a Rust crate shared
with the server. Do not port the TypeScript rules.

1. **Split `puzzled-core` along the solution boundary.**
   - `puzzled-rules` builds for wasm32. It holds board state, move legality,
     hints that do not reveal the solution, and the result card mapping.
   - Generators, solutions, `self_check` and finish validation stay
     server-only, in `puzzled-core`.
   - This keeps the rule that solutions never leave the server, and the
     crate graph enforces it.
2. **Build each game screen as a keel-web page or island** that calls
   `puzzled-rules` directly. Talk to the Rust api over the existing Connect
   contract, unchanged. The api and the database are not touched.
3. **Delete the TypeScript game modules with the port.** Parity tests move to
   Rust only. The frozen `tests/fixtures/generate/*.json` stay as the record
   for old generator versions.
4. **Run the move per route behind the existing edge split.** keel-web takes
   path prefixes one by one, and Next.js keeps the catch-all until the last
   route moves. This is the Tryit pattern (`sylphx.toml` `path_prefixes`).
   - Order: legal and pricing pages first, then home, then one game, then the
     other 18 games, then settings and account.

## Alternatives rejected

- **Port TS to TS on a lighter framework (Preact, Solid).** This cuts bytes but
  keeps two rules codebases, and the company has ruled against new React or
  Next work.
- **Keep Next.js and only trim JS (W-0948).** Worth doing while the port is
  pending: SSR consent banner, chunk split. It does not remove the duplicated
  rules, so it is not the destination.
- **Validate every move on the server and keep the client dumb.** This adds
  a round trip per tap (TTFB 80-130 ms on the desk), and soft-failure play needs
  instant feedback.

## Migration and rollback

- **Ship gates.** Each route ships only when the keel-web page scores the same
  or better on mobile Lighthouse, accessibility and SEO than the Next page it
  replaces, and keeps every feature: share card, `?date=` deep link, consent,
  locales, Plus gates, push opt-in.
- **Rollback.** Remove the route's prefix from the keel-web service in
  `sylphx.toml`, and the Next catch-all serves it again. No data moves, so
  there is nothing to roll back in the database.
- **Last step.** Delete the `web` Next service, `apps/puzzled` and
  `packages/ui`.
- **Before the port.** W-10073 deletes the dead TS generators and the LLM
  residual now, so the port starts from game UI plus rules only.

## Tests that prove it

- `cargo test -p puzzled-rules --target wasm32-unknown-unknown` and the server
  tests share one rules suite. The fixture parity tests keep passing.
- A crate-graph check fails the build if `puzzled-rules` depends on a
  solution or generator module.
- A seeded Playwright flow per game on the keel-web preview finishes a puzzle
  through the real api.
- A desk-CPU budget on CI for home at 390 px, slow 4G plus 4x CPU: JS at most
  170 KB brotli, TBT under 200 ms.
- Production readback: a new guest finishes today's featured puzzle and
  shares a card.

## Open questions

- Whether keel-web islands can host a board with drag gestures (block-slide,
  number-path) at the AAA bar. The Keel lane prototypes one game before the
  18-game slice is cut.
- Whether Keel has the gaps the Kalkas plan names: theme before first paint,
  site scripts and i18n. W3 waits on those like W1 and W2 do.
