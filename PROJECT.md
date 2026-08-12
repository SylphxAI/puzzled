# Puzzled Project

Puzzled is a **daily light brain-games platform**: short, positive rituals, an
expandable catalog under one module protocol, habit-first growth, and
subscription monetization in the NYT Games structural class.

**Product North Star (what winning means):**  
[docs/north-star/README.md](docs/north-star/README.md) — metric **Habitual Ritual Completers (HRC)** (≥ 4 of the last 7 product days). **Daily Ritual Completers (DRC)** is the atomic input, not a second Polar.

This repo owns the Puzzled Next.js app, repo-local UI package, Atlas migrations,
Sylphx deployment manifest, pure game rules, and application workflows.

## Product ambition (summary)

| | |
|--|--|
| **Promise** | Minutes a day, optional depth, shareable non-spoiler results |
| **Catalog** | Unbounded *class* of light daily puzzles + honest entertainment oracles |
| **Basis** | Day key · game module · ritual run · result card · entitlement |
| **NSM** | Distinct users with a qualifying ritual on ≥ 4 of the last 7 product days (HRC) |
| **Money** | Free daily finish floor; paid archive/suite/stats |

Full doctrine: [docs/north-star/VISION.md](docs/north-star/VISION.md).

## Lifecycle

- Lifecycle: **dev-phase until live proof** (ADR-170 §6 and
  [docs/north-star/EVIDENCE-AND-ORACLES.md](docs/north-star/EVIDENCE-AND-ORACLES.md)).
  No production *claim* without layered evidence (source / CI / deploy / live).
- Layer: `application`
- Instruction SSOT: binding Skills (`engineering-standard`).
- Architecture (how we ship):
  [ADR-170](docs/adr/ADR-170-clean-break-north-star.md) — sole Connect, sole
  Rust executor, content tool, server-authoritative play.

## Architecture

- **api** (Rust, `crates/puzzled-server`): sole backend. Connect RPC only —
  Health, Puzzle, Stats, Preferences, Gamification, Admin, Jobs. Identity from
  Platform JWT (Bearer or session cookie).
- **web** (Next.js, `apps/puzzled`): presentation only. Generated Connect
  client; Platform SDK for auth/billing/flags/AI. No backend authority.
- **core** (`crates/puzzled-core`): pure game rules, validation, scoring,
  policy.
- **Content**: `apps/puzzled/scripts/generate-content.ts` imports day-keyed
  puzzles into the content store (`daily_puzzles`); the api serves and
  validates from it. No client-trusted solutions.
- **DB**: Atlas-managed Postgres; single runtime writer is the api service.

## Delivery

CI runs lint/typecheck, buf + platform-boundary gates, migration integrity,
unit tests (app + Rust), and real builds (web `next build` + Rust release).

**Delivery authority** (games catalog, free ritual floor, merge rejects):  
[docs/north-star/DELIVERY-AUTHORITY.md](docs/north-star/DELIVERY-AUTHORITY.md).

Path: PR → Merge Queue → main → auto deploy → **live oracles** — not “merged.”

## Principles

Depth · Correctness · Simplicity · Evolvability · Observability · Performance ·
Reliability · Security · Economy — applied to product in the North Star package;
applied to stack in ADR-168/169/170.
