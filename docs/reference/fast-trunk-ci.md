# Fast Trunk CI

## Authority split

| Concern | Owner |
| --- | --- |
| Work / claim / review | Git / native Codex coordination |
| Source history | Git |
| Source correctness | This repository CI (`source-ci/pass`) |
| Production artifact build | Sylphx Platform (once) |
| Deploy / health / rollback | Sylphx Platform |

## Paths

- **Internal agents:** small-batch non-force direct-trunk to default branch.
- **External contributors:** Pull Request presubmit feedback.
- **Merge Queue:** default off (no `merge_group` trigger).

## CI scope

Blocking: lint/typecheck, affected tests, schema/migration safety, secret detection.

### Dependency advisories and pre-launch cleanup

Package-manager vulnerability audits do not run in the PR or merge-group gate:
a newly published advisory can fail an unchanged lockfile while main's previous
check stays green. `Security Scan` keeps its required name and verified-secret
detection. The shared `workflow-lint` guard rejects a direct registry audit in a
pre-merge workflow; see
[SylphxAI/.github dependency audit policy](https://github.com/SylphxAI/.github/blob/main/docs/dependency-audits.md).

Deferred launch-gate checklist, owned by this repository:

- Run the production-dependency audit and repair launch-blocking findings once
  as part of the final pre-launch security review, not on unrelated PRs.
- Enable advisory-driven security updates in the existing dependency bot;
  prove an alert opens its repair PR rather than assuming routine updates do it.
- At launch, add a separate default-branch workflow with a daily schedule,
  main pushes and manual dispatch, a bounded timeout and a fail-closed
  `bun audit --audit-level=high --prod`. Its failures belong to dependency
  maintenance, not `ci-ok` or source-culprit rollback. Until launch, do not add
  this job (owner `standards/security.md`, unlaunched-product accepted risk).

Rollback is reverting the CI removal and shared-action pin; no account,
dependency-version, schema or runtime change is part of this policy.

The `Identifiers` job fails an added line that mints an id, or declares a primary
key, that is not a UUIDv7 (owner `standards/identifiers.md`); it checks only the
lines a change adds, so existing code is not a finding.

Not in source CI: production Docker/release image builds, disposable ship binaries for ordinary tips.
