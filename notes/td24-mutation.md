# TD-24 mutation proof: new duplicate -> RED, revert -> green

Mutation: `"copiedTest": "Copied to clipboard!"` added under the existing `copied` key in `src/messages/en-US/common.json` (same value, new key; en-GB inherits it).

`bun run scripts/i18n-report-duplicate-values.ts --check` -> rc=1:
```
NEW en-GB: "Copied to clipboard!" now duplicates 2 keys: common.copied, common.copiedTest
NEW en-US: "Copied to clipboard!" now duplicates 2 keys: common.copied, common.copiedTest
DUP-BASELINE-DRIFT: 2 problem(s); record intended duplication with --update-baseline, fix it otherwise
```

Same mutation through the suite (`bun test src/lib/i18n/duplicate-values.test.ts`): 4 pass / 2 fail — both failures pin those two lines (`resolved duplicate-value baseline > every duplicate group in the resolved catalogues is recorded`, and `...holds exactly what --update-baseline writes`).

Revert (`git checkout -- src/messages/en-US/common.json`):
- `--check` -> rc=0: `DUP-BASELINE-OK: 1159 recorded duplicate groups match the resolved catalogues`
- suite -> `6 pass / 0 fail / 16 expect() calls`.

The synthetic-catalogue tests (suite `baseline mechanics`) cover the other drift shapes: a new value group, a key added to a recorded group, and a recorded group that vanished (stale).
