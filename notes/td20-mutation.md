# TD-20 mutation proof: redaction RED -> GREEN

Mutation (temporary, `logger.ts`): log the raw field instead of the redaction placeholder.
```diff
-		redacted[key] = isSensitiveKey(key) ? REDACTED : fields[key]
+		redacted[key] = fields[key]
```

RED - `env -u NODE_ENV bun test src/lib/logger.test.ts` (in `apps/puzzled`), raw tail:
```
(fail) logger > redacts sensitive fields, exact and lookalike keys [2.07ms]
error: expect(received).toBe(expected)
Expected: "[redacted]"
Received: "member@example.com"
 7 pass
 1 fail
```

Restore: `git checkout -- apps/puzzled/src/lib/logger.ts` (working tree diff empty after).

GREEN - same command, restored tree, raw tail:
```
(pass) logger > redacts sensitive fields, exact and lookalike keys [0.23ms]
 8 pass
 0 fail
 27 expect() calls
```

Raw logs: `/data/sylphx/home/work/pz-program/notes/td20-mut-red.txt`, `td20-mut-green.txt`.
