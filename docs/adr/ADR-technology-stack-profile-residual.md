# ADR: technology-stack-profile residual honesty

- **Status:** Accepted (residual inventory)
- **Date:** 2026-07-30
- **Profile:** SylphxAI/skills `technology-stack-profile`

## Context

Portfolio SOTA requires buffa + connectrpc product RPC and Connect-Web/Query web
clients. This repository has stack foundation work landed, but may still have
REST densify residual, partial product RPC coverage, or analysis-language
backend-effect residuals.

## Decision

1. Product RPC authority is buffa + connectrpc (Rust) where a backend role exists.
2. Web product densify uses Connect-Web + Connect-Query + TanStack Query.
3. Do not claim full profile completion while residual densify or non-Rust
   backend effects remain for declared backend roles.
4. Python/TS analysis tooling is OK; product backend effects are not.

## Residual inventory

Track repo-specific open densify / residual paths in PROJECT.md or follow-up
commits. This ADR prevents silent greenwashing of partial cutovers.

## Validation

```bash
buf lint
# cargo / bun checks as applicable
```
