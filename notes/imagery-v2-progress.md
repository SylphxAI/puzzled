# Imagery v2 progress

Lane: brand mark, game icons, OG cards, favicons. Branch feat/imagery-v2, own worktree at
`/data/sylphx/home/workspace/.worktrees/github.com/SylphxAI/puzzled/imagery-v2`.

## Verified premises (2026-09-23)
- Direction SSOT read from PR #184 (`notes/redesign-spec.md`): midnight study x arcade.
  Warm paper `#faf6ef` / midnight ink `#0e1226`; warm accent amber; display face Space Grotesk.
- Corrections to the brief:
  - `scripts/generate-brand-icons.ts` did NOT read `public/brand/mark.svg`; it re-emitted its own
    copy of the geometry plus the old indigo gradient. Now fixed: it parses mark.svg.
  - The icon set is 19 files under `apps/puzzled/src/games/*/icon.tsx`; the registry in
    `src/shared/components/ui/game-icons.tsx` maps 19 slugs, incl. `crowns` -> `QueensIcon` and
    `duo` -> `TangoIcon`.
  - PR #184 does not touch `src/shared/components/brand/mark.tsx`, so the in-app mark component
    belongs to this lane.
  - `--color-accent-warm` already exists on main (`#f97316`) and on PR #184 (`#fb923c` dark): the
    amber token the icon family paints its accent detail with.

## Steps
- [x] recon, worktree, spec read
- [x] A: brand mark v2 (ink ground + amber tile), generator driven by mark.svg
- [ ] B: one game-icon language across all 19 icons
- [ ] C: OG cards on the new skin
- [ ] D: regenerate favicons/app icons from the new mark

## Next action
Restore the rewritten sources, run biome + typecheck + unit tests, then preview sheets and push.
