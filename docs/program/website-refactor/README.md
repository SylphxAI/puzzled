# Puzzled website-refactor and full-upgrade program

**Status:** Program SSOT. Design intent only — this document is not evidence that any stage is implemented, deployed, or live.
**Scope:** the `apps/puzzled` web surface — marketing, core play, auth, the post-login account console, settings, legal and the admin shell.
**Authority:** `docs/vision.md` and `docs/capabilities.md` win over this program on any conflict. Field contract under them is `docs/north-star/`. Company law is `SylphxAI/owner` (work, proof, docs, design and experience standards).

## The live product oracle (binding, restated)

A non-technical player on a phone finishes today's featured ritual in minutes without payment or account, shares a non-spoiler card with a `?date=` deep link, and returns the next product day. Server-authoritative serve and validate; one finish per `(user, module, day_key)`; product day key in `Asia/Hong_Kong`.

Source green, `GET /healthz` 200 and `GET /` 200 are **not** this oracle.

## Why this program exists

The redesign wave is the reason. PRs #142–#148 landed between 2026-09-17 and 2026-09-18 and rebuilt the brand, shell, home, SEO truth layer, auth and console, catalog and game pages, and pricing/support/legal, plus a WCAG 2.2 AA conformance pass. The wave is finished: **#144** landed as `861cfbd` and **#149** landed as `ad89b83` on 2026-09-20, so `main` carries the whole redesign wave. Two later fixes followed immediately, both needed because the wave was incomplete: **#151** (`878ca92`) restored the home FAQ's real copy where the wave shipped raw key paths, and **#152** (`3ab661a`) closed the `?date=` deep-link gap (**G1**) and added the archive surface (**G2**), both at source.

That was the immediate work. The program's job is what comes after it:

1. Every surface must meet one standard — marketing, core, auth **and** the post-login console. No second-class surface.
2. The measurable quality layers — SEO and structured data, Core Web Vitals, WCAG 2.2 AA, analytics and error monitoring — need baselines, then budgets, then enforcement. Today the repo holds harnesses that nothing runs.
3. The feature gaps the destination requires are still open, and two of them touch the oracle itself.

## Documents

| Document | Owns |
| --- | --- |
| [`inventory.md`](inventory.md) | Every page that exists, every page that should exist, and the flow each serves |
| [`ia.md`](ia.md) | Current information architecture and navigation, and the target design |
| [`gaps.md`](gaps.md) | Feature-gap register against the destination, the capability graph and the oracle |
| [`baselines.md`](baselines.md) | Measured, declared and unknown baselines for SEO/meta, CWV, WCAG 2.2 AA and analytics coverage |

One home per fact: this README routes, it does not restate the four documents.

## Stages

Each stage names its **definition of done** and the **evidence layer** at which done is claimed (`Local` / `Candidate` / `Check-CI` / `Landed` / `Artifact` / `Released` / `Deployed` / `Live`, per `standards/proof.md` in `SylphxAI/owner`). "Merged" is never silently "done".

| Stage | Name | Definition of done | Evidence layer |
| --- | --- | --- | --- |
| **S0** | Audit and SSOT | Page inventory, IA, gap register and baselines land as the program SSOT; every unknown named with what resolves it | Landed (docs) |
| **S1** | Finish the redesign wave | #144 and #149 landed on `main`; #149's conflict resolved against the current base; required checks green on the final revision; a non-author verdict recorded in each PR body | Landed |
| **S2** | One standard per surface | Marketing, core, auth and the account console each audited against one checklist (hierarchy, states, empty/error, responsive, focus, i18n); every deviation fixed or recorded with an owner; the console sign-in path reaches one hop | Landed |
| **S3** | Richness and human interaction | Dated visual language replaced; interaction contracts authored per flow (what the player sees, does and gets back at each step) rather than system-shaped forms; the non-spoiler result card the protocol specifies exists | Landed |
| **S4** | SEO, meta and structured data | Per-surface title/description/OG/Twitter/canonical/hreflang correct and unique; page-level structured data added where it earns a rich result — `/` already emits `FAQPage` (6 `Question`/`Answer`), other surfaces carry only site-wide `Organization`/`WebSite`; the existing `verify:seo` harness runs in CI and fails on drift | Check-CI + Deployed readback |
| **S5** | Core Web Vitals | The existing Lighthouse config enforced in CI; a mobile profile over the play routes; LCP/INP/CLS/TTFB budgets at the repo's own thresholds; a first-load JS byte budget; a regression fails the check | Check-CI + Deployed readback |
| **S6** | WCAG 2.2 AA | The existing `test:a11y` and `test:e2e` suites run in CI and a violation fails the check; a current violation count is recorded; keyboard and focus paths verified on the play and console flows | Check-CI |
| **S7** | Analytics, funnel and error monitoring | The land → serve → finish → share → return → subscribe funnel is instrumented; client errors and field vitals are readable by an operator; no analytics or replay fires before consent | Live + Check-CI |
| **S8** | Feature-gap closure | Every open row in `gaps.md` required by the destination or the oracle is closed — including `?date=` deep links and an archive surface — or the destination is explicitly renegotiated in `docs/vision.md` | Live |

Ordering is a dependency statement, not a calendar. S4–S7 are independent of each other once S2 and S3 have settled the surfaces they measure.

## Status

| Stage | Status | Note |
| --- | --- | --- |
| S0 | Landed | The four documents landed as docs. |
| S1 | Landed | #144 → `861cfbd`, #149 → `ad89b83`, both on `main` 2026-09-20; the wave's remaining defects followed as #151 → `878ca92` (home FAQ real copy) and #152 → `3ab661a`. |
| S2 | Active | Audit half complete; see [`s2-audit.md`](s2-audit.md). 13 checklist axes conform, 8 deviate (15 distinct defects), 4 unverifiable on the auditing host. Fixes in flight for the console copy, game copy and `/unsubscribe`; the catalog focus-ring deviation and the 360px coverage hole are recorded with owners. |
| S3–S8 | Not started | Open gaps are enumerated in [`gaps.md`](gaps.md); baselines in [`baselines.md`](baselines.md) |
