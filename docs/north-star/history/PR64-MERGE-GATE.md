> **HISTORICAL.** Not living North Star. See [../README.md](../README.md).

# PR #64 merge gate checklist

Evidence: [pr64-attestation.md](pr64-attestation.md) (2026-08-11, rebased onto
main `6bb83be`; head `488a494`).

- [x] All games under `apps/puzzled/src/games/*` still present on PR head  
  (17/17; path lists identical; 0 deletes under games/)
- [x] `page.tsx` game routes still resolve  
  (route file present; Hono → Connect server helpers)
- [x] Deleted packages are only retired/private SDK/local residuals (list paths)  
  — **with honesty:** 249× `sdk_retired` + 43× dual-authority/PWA/orphan residual  
  (see attestation table; **not** pure SDK-only)
- [x] No product page replaced by empty stub  
- [x] Web + Rust CI green  
  (local: typecheck green; cargo test green; CI re-run after force-push)
- [x] Product-work matrix attached **or** explicit residual attestation with `rg` evidence  
  → `docs/north-star/history/pr64-attestation.md`
- [x] Residual classes **explicitly accepted** under DELIVERY-AUTHORITY clean-break  
  (`sdk_retired`, `dual_authority_web_jobs_cron`, `rust_http_rest_residue_to_connect`,
  `orphan_root_src_relocated`, `pwa_monitoring_residue`) — not framed as SDK-only

## Merge decision (post #65 + residual acceptance)

| Criterion | Result |
|---|---|
| Games 100% present | **YES** |
| Pure SDK-only deletes | **NO** (honest) |
| Dual-authority residual attested + accepted | **YES** |
| Rebased onto main (includes #65 gate docs) | **YES** |
| **Recommendation** | **MERGE** under DELIVERY-AUTHORITY clean-break (residual classes accepted; games protected) |

If residual classes are rejected by owners → **do not merge**.  
Residual classes are accepted for this land; games stay intact.
