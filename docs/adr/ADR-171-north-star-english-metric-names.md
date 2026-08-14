# ADR-171 — North Star metric names in English

- **Status:** Accepted
- **Date:** 2026-08-13
- **Relates to:** [NORTH-STAR-METRIC.md](../north-star/NORTH-STAR-METRIC.md), ADR-170
- **Does not change:** qualifying-finish membership, `puzzle_ritual` vs `entertainment_oracle`

## Context

The product North Star and its entertainment twin were taught as invented house acronyms (DRC, DFC). Industry NSM is an English quantity. A replacement acronym would repeat the same mistake.

## Decision

1. Executive NSM name: **daily puzzle completers**. Public field: `daily_puzzle_completers`.
2. Secondary entertainment metric: **daily entertainment completers**. Public field: `daily_entertainment_completers`.
3. Do not invent a house score acronym (including a three-letter stand-in).
4. Domain/SQL identifiers that encode behavior may remain; public metric fields are English.

## Validation

Binding North Star docs and `PROJECT.md` use the English names. Oracle SQL aliases `daily_puzzle_completers`.
