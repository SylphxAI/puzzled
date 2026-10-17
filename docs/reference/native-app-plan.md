# Native app: Keel plan and readiness decision

Evidence read on 2026-10-08. Puzzled source: `9ee1ffeb436b183467a27e35ca1d52609b7d9f4f`.
Keel source: `c7278b5cf825ec785f4274e2c4254bd3d1b340a1`.

## Decision

The category reference is **NYT Games**: daily puzzles, an archive and progress
tracking in a store-distributed phone app. Puzzled currently has a Next.js
presentation and one Rust play authority, not a native app
([README.md:28–40](../../README.md), [vision.md:4–20](../vision.md)).

Choose a **native Keel presentation calling the existing Connect API**. Do not
replace the web app, change puzzle generation, or build another completion or
billing authority. **No-go for a store launch today.** The required working
one-game spike on a physical device has **not been built or demonstrated**;
this document is the plan and readiness decision, not successful spike evidence.
No native executable, APK, device session or native performance measurement is
claimed by this change.

The physical-device acceptance cannot currently be performed through an
authorized available path. The device inspection on 2026-10-08 returned only
`sdk_gphone64_x86_64` / `emu64xa`, an emulator, not a handset. Company policy
excludes paid device farms and requires missing testing capabilities to belong
to the platform ([company testing decision](https://github.com/SylphxAI/owner/blob/main/company/decisions.md#2026-09-28-testing-runs-on-our-platform-a-missing-capability-is-built-not-bought)).
Existing authorization excludes a device purchase or use of the owner's phone.
Real-device telemetry is the approved measurement direction; it cannot prove a
native journey before a native build has actually run on a phone. An emulator
journey is useful intermediate evidence, but is not a substitute for this
item's physical-device requirement. This is an availability constraint, not a
request for a second review or a speculative security blocker.

## Smallest useful spike

Use **Sudoku**, with one daily board, digit entry, clear, submit, accepted result
and a spoiler-free share card. It has a concrete existing server contract and
accepts any valid completed grid preserving the frozen clues
([ADR-170:45–60](../adr/ADR-170-clean-break-north-star.md)).

Add one independently packaged client at `apps/puzzled-native`; the native
release boundary justifies its own Rust crate under
[ADR-169:42–52](../adr/ADR-169-capability-first-modular-ddd.md). Product state,
copy, layout and package settings remain here. Consume Keel at an exact verified
revision/version; the source revision above is reference evidence, **not a
verified mobile release recommendation**. Keel is 0.x and breaking API changes
are normal ([Keel README](https://github.com/SylphxAI/keel/blob/c7278b5cf825ec785f4274e2c4254bd3d1b340a1/README.md#consuming-keel)).

- Use Keel Components, Signals and a native Paint host. Export the root through
  `keel::mobile_entry!`; use `keel pack --profile android` for the first package.
  Keel already owns the host and mobile packaging; do not add a hand-written
  Kotlin/Swift product or another UI framework
  ([consumer guide:190–202](https://github.com/SylphxAI/keel/blob/c7278b5cf825ec785f4274e2c4254bd3d1b340a1/docs/CONSUMER_GUIDE.md#ship)).
- Read `GetDaily`, retain its `puzzle_id`, `puzzle_date` and public board, and send
  that identity with `SubmitGuess`. Consume the declared Protobuf/Connect
  contract, including error semantics; do not invent REST routes or a second
  schema ([puzzle.proto:39–73,97–122](../../proto/puzzled/v1/puzzle.proto)).
- Keep a stable guest ID in the engine's storage port. Initial scope is guest
  play, not account creation. The existing API supports stable guest-day
  identity; verify native transport against its actual header contract
  ([ADR-170:45–51](../adr/ADR-170-clean-break-north-star.md)). No client clock
  chooses the product day.
- Store only unfinished input against the served puzzle identity. On resume,
  fetch the authoritative day/completion again. Preserve input on transport
  errors; never celebrate before a valid accepted server response. Offline
  submission and locally awarded finishes are out of scope.
- The spike uses a seeded isolated test API where Sudoku is admitted. It must
  not alter the production featured-game rotation or bypass paid admission.
  The production native catalog will use the same free featured game and
  entitlements as the web ([AGENTS.md:53–60](../../AGENTS.md)).

A frontend-only native client can render, retain input, share a result and call
public services directly. It cannot mint an entitlement, hold an answer,
validate a purchased receipt or decide a finish. These operations stay in the
existing product API and platform services; no new Function is needed for the
spike ([vision.md:25–30,41–42](../vision.md)). Missing generic OS/network support
belongs in Keel; missing generic auth, payment or delivery support belongs in
the platform, not a product-local substitute.

## Store scope and account inventory

| Concern | Scope / evidence status |
| --- | --- |
| Android first | Debug APK for the spike; production AAB only after signing and the journey are proven. Keel owns both packaging paths. |
| iOS | Same client tree, but a separate signed device build and journey on macOS/Xcode. Android success does not establish iOS readiness. |
| Publisher | Sylphx, not Cubeage ([portfolio](https://github.com/SylphxAI/owner/blob/main/company/portfolio.md)). |
| App Store Connect team, app record and scoped publishing key | **Unverified**. Company access inventory marks the account/team unknown; this work did not inspect account credentials. No account absence is inferred. |
| Play Console account, package reservation and scoped publishing identity | **Unverified**, for the same reason. Never use a different publisher's account or purchase a new one as an implicit task step. |
| Proposed application ID | `com.sylphx.puzzled`, **not reserved or collision-checked**. Confirm it in both stores before making it an immutable release setting. |
| Plus purchases | Not in the spike. Before store sale, consume store purchases through Sylphx Money with receipt verification, restore and one entitlement authority; no embedded web checkout as a universal substitute. |
| Submission material | Build-derived screenshots, privacy/data declarations, terms, subscription disclosures and review instructions; no listing or submission is created by this plan. |

Account state source: [owner access inventory:22–23](https://github.com/SylphxAI/owner/blob/main/company/owner-access.md).
Packaging/signing source: [Keel mobile packaging](https://github.com/SylphxAI/keel/blob/c7278b5cf825ec785f4274e2c4254bd3d1b340a1/docs/PACKAGING.md).

Apple requires more than a repackaged website (4.2), generally requires IAP for
in-app digital functionality (3.1.1), and requires in-app deletion if account
creation is offered (5.1.1(v)). Google generally requires Play billing for
in-app digital subscriptions, with region/program-specific exceptions. Check
the selected distribution markets at submission; no worldwide checkout rule is
inferred. This is release scope, not new pre-launch security work.

## Alternatives rejected

- **WebView wrapper:** not the native Keel target, does not establish native
  interaction, and Apple 4.2 is not satisfied merely by packaging a website.
- **A separate native puzzle engine or local authoritative solver:** creates a
  second result authority and bypasses the existing completion protocol.
- **A second payment provider or product receipt database:** duplicates Money.
- **Port nineteen games before proving one:** expands unmeasured work without
  proving input, lifecycle, server integration or packaging on a phone.
- **Treat emulator or web telemetry as the completed native spike:** neither
  proves a native one-game journey on physical hardware.

## Migration, rollback and proof

Add the native client alongside the existing web presentation. Both read and
write through the same API; no schema migration, ledger rewrite, guest-data
move or backend switchover is required. After the Sudoku proof, extend the same
client to the featured rotation and catalog, account/stats/restore and reminder
parity. Do not submit a one-game prototype as the nineteen-game product.

Rollback before launch is to stop distribution of the candidate and keep web
play unchanged. After a native launch, ship a corrected build through the store
release path, preserve the API/account identifiers and already granted value,
and retain a web fallback; uninstalling a published product is not a rollback.

The existing affected-test/merge gates remain the single code check. Extend
them for the native consumer, rather than creating a second audit:

1. Contract tests: public board carries no solution; malformed/invalid grids
   reject; accepted finish persists once; retry/restart reads the same result;
   errors retain input; server day wins over client clock skew.
2. Deterministic client tests: clue cells cannot change, entry/clear changes
   only editable cells, resume restores input only for the same puzzle identity,
   and rejection never renders a successful result.
3. A recorded device journey: fresh guest → fetch → manual solve → accepted
   finish → share → background/resume → relaunch with the same guest/result.
   Record exact app SHA, package digest, engine revision, device model/OS,
   physical/emulated classification, timestamps, screenshots and RPC outcome.
   Keep credentials and row-level personal data out of evidence.
4. Android package and signature verification; the later iOS journey runs on
   its own signed build. A launch-only crash check is not a completed puzzle.

The defect-class guard is the server contract/completion tests shared by every
presentation, plus a native replay of acceptance/error/lifecycle behavior. A
result must always come from an accepted server finish. A device report must
state physical/emulated explicitly so an emulator cannot silently satisfy
physical acceptance.

**Go criterion:** the working Sudoku journey has this evidence on a real phone,
then native scope can expand. **Current outcome:** plan recorded; spike and
store account verification remain unfulfilled. No native launch is authorized
by this readiness decision.

## Industry sources read

- [NYT Games App Store listing](https://apps.apple.com/us/app/nyt-games-word-wordle-sudoku/id307569751): daily puzzle suite, archives and progress tracking; not evidence of NYT's internal architecture.
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): 3.1.1, 3.1.2, 4.2, 5.1.1(v).
- [Google Play payments policy](https://support.google.com/googleplay/android-developer/answer/9858738): digital subscription billing and regional exceptions.
