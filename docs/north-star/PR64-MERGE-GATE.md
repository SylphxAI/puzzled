# PR #64 merge gate checklist

- [ ] All games under `apps/puzzled/src/games/*` still present on PR head  
- [ ] `page.tsx` game routes still resolve  
- [ ] Deleted packages are only retired/private SDK/local residuals (list paths)  
- [ ] No product page replaced by empty stub  
- [ ] Web + Rust CI green  
- [ ] Product-work matrix attached **or** explicit “SDK-only delete” attestation with `rg` evidence  

If any unchecked → **do not merge**.
