# TD-24 normalisation proof: two duplicate groups collapsed onto canonical keys

Slice picked from the resolved baseline where every member is identical across all five locales and every call site is a literal `t()`:

1. `"Copied to clipboard!"` — `common.copied` + `share.copied`.
   - 4 call sites repointed `tShare('copied')` -> `tCommon('copied')`: word-guess-game.tsx:178 & 313, word-groups-game.tsx:181, word-hive-game.tsx:163; the now-unused `tShare` bindings dropped in those three files.
   - root `copied` deleted from share.json in en-US / zh-CN / zh-HK (en-GB and zh-TW only inherit; nothing to delete).
2. `"Sign out of this device"` — `settings.account.signOut` + `settings.security.signOutHere`.
   - security-client.tsx:138 repointed `t('security.signOutHere')` -> `t('account.signOut')`.
   - `settings.security.signOutHere` deleted from en-US / zh-CN / zh-HK settings.json.

Both values resolve identically between their two keys in all five locales (probe over `resolveLocale`; e.g. zh-HK "已複製到剪貼簿！" / "登出此裝置", zh-CN "已复制到剪贴板！" / "退出此设备").

Resolved-catalogue proof (canonical dumps + sha256):
- before: 2724 leaves / 2686 strings per locale ($HOME/.td24-dumps/before-f).
- after: 2722 leaves / 2684 strings per locale ($HOME/.td24-dumps/after).
- `compare --before before-f --after after` -> `DIFF` in all 5 locales, first path `settings.security.signOutHere`; `DIFF-TOTAL: 5 of 5 locales differ` (expected — the two keys are gone).
- Full leaf-path enumeration of both dumps: EXACTLY 10 differences, all deletions, none added, none changed:

```
en-US	-settings.security.signOutHere		en-US	-share.copied
en-GB	-settings.security.signOutHere		en-GB	-share.copied
zh-HK	-settings.security.signOutHere		zh-HK	-share.copied
zh-TW	-settings.security.signOutHere		zh-TW	-share.copied
zh-CN	-settings.security.signOutHere		zh-CN	-share.copied
TOTAL-DIFFS 10
```

Baseline regeneration (the check proves itself):
- post-edit `--check`: rc=1, 10 STALE lines (both groups x 5 locales), e.g. `STALE en-US: "Copied to clipboard!" x2 no longer duplicated: common.copied, share.copied`; `DUP-BASELINE-DRIFT: 10 problem(s); record intended duplication with --update-baseline, fix it otherwise`.
- `--update-baseline` -> `DUP-BASELINE-WRITTEN: 1159 groups` (1169 - 10).
- `--check` -> `DUP-BASELINE-OK: 1159 recorded duplicate groups match the resolved catalogues`.
- `--resolved` after: en-US 235 / en-GB 235 / zh-HK 228 / zh-TW 229 / zh-CN 232 (`RESOLVED-TOTAL: 1159`).

Follow-up fix (commit 0a34aae): the baseline file check originally compared bytes; the repo's biome pre-commit hook re-formats the JSON (short arrays inline), so the test now compares parsed content. Guard semantics unchanged: content must equal exactly what `--update-baseline` writes.
