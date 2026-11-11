# First-session parity audit

## Evidence status — 2026-11-05

This is an **incomplete audit**, not a parity verdict. The served Puzzled home
and today's medium Sudoku were read in the managed browser at 1919×936.
Exact-size frames, NYT play, a genuine finish/share/streak and checkout have
not yet been verified. Do not infer mobile layout quality from that window.
No player data, subscription or price has been changed.

## Ranked investigation list

Ordering is a revenue/retention hypothesis, not a measured conversion result.
A gap is confirmed only after both products' relevant journeys are observed.

| Rank / screen | Puzzled observation | NYT Games comparison | Severity / next evidence |
| --- | --- | --- | --- |
| 1 / Plus → checkout | Header exposes Puzzled Plus. Checkout not yet exercised. | Subscription offer and unpaid checkout not yet observed. | Potential revenue dead end; highest-priority verification, **not a confirmed defect**. |
| 2 / finish → results → share → streak | Home promises spoiler-free results; game offers “Save your streak” before finishing. Genuine finish not yet exercised. | Wordle and Connections completion not yet observed. | Potential retention loss; verify server-accepted finish and guest continuity before choosing a change. |
| 3 / today → Sudoku | Home's direct `?difficulty=medium&start=1#play` route reached an interactive grid without signup. | Instant-play comparison pending. | Free floor works in this sampled path; avoid introducing a signup gate. Existing PR #418 owns hero/difficulty flow. |
| 4 / consent | Anonymous counting disclosure and Decline / Settings / Accept are visible. | NYT consent interaction not yet observed. | Layout verdict pending exact-size frames. Existing PR #419 owns consent CSS; no competing edits. |

## Repeatable capture

`scripts/capture-first-session.ts` captures the served product and optional
comparison pages at **390×844** and **1440×900**, including today's actual home
CTA rather than a hardcoded free game. It records URL, timestamp, viewport,
page text, browser errors and a PNG for each stop. It never enters credentials,
submits a payment, fabricates a finish or asserts subscription acceptance.

The **First-session captures** workflow uploads the output even on failure.
Pull requests touching the capture harness run against production. After merge,
workflow dispatch accepts `base_url` and optional `preview_url` to capture before
and after with the same harness. Preview must be a publicly reachable trusted
HTTPS deployment. The capture route must be accompanied by manual play of the
finish and checkout; screenshots alone do not prove either works.

## Capture receipt and disconfirming check

Run [42054639733](https://github.com/SylphxAI/puzzled/actions/runs/42054639733)
succeeded at 2026-11-05T15:25:43Z; artifact `first-session-42054639733`
contains both exact viewports. Its phone Sudoku text has no digits or Undo,
whereas desktop does. That establishes a missing board **at capture time**,
not a phone-specific defect. The harness now waits up to 30 seconds for the
81st visible button in the Sudoku group, records a readiness failure and fails
the run if it never appears. This distinguishes slow lazy loading from a
persistent blank game. No application fix is justified until that result.

The same PR's unrelated unit-test job failed the existing Money catalogue
reader/fixture assertion (1357 pass, one failure); the capture succeeded.
Neither CI acceptance nor merge readiness is claimed.
