# PR #64 merge gate checklist

Evidence: [pr64-attestation.md](pr64-attestation.md) (2026-08-11, main
`9c7de86` vs head `2921240`).

- [x] All games under `apps/puzzled/src/games/*` still present on PR head  
  (17/17; path lists identical; 0 deletes under games/)
- [x] `page.tsx` game routes still resolve  
  (route file present; Hono → Connect server helpers)
- [x] Deleted packages are only retired/private SDK/local residuals (list paths)  
  — **with honesty:** 249× `sdk_retired` + 43× dual-authority/PWA/orphan residual  
  (see attestation table; **not** pure SDK-only)
- [x] No product page replaced by empty stub  
- [x] Web + Rust CI green  
  (Build / Lint / Unit / Rust API / Migration / Security; preview deploy failed)
- [x] Product-work matrix attached **or** explicit residual attestation with `rg` evidence  
  → `docs/north-star/pr64-attestation.md`

## Merge decision (this gate pass)

| Criterion | Result |
|---|---|
| Games 100% present | **YES** |
| Pure SDK-only deletes | **NO** |
| Dual-authority residual attested | **YES** |
| **Recommendation** | **REQUEST CHANGES** vs silent “SDK-only” merge; accept residual classes explicitly before merge. **Do not merge on “SDK-only” claim alone.** |

If residual classes are rejected by owners → **do not merge**.  
If residual classes accepted and games stay intact → merge may proceed under
DELIVERY-AUTHORITY clean-break (still not “SDK-only”).
