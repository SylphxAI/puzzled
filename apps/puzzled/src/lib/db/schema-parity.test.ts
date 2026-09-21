import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

/**
 * TD-04 parity gate: src/lib/db/schema.ts (Drizzle) and atlas/migrations (Atlas)
 * are two hand-kept copies of one PostgreSQL DDL, with nothing comparing them.
 * A column added to only the schema compiles, typechecks and passes tests, then
 * fails in production on the first query.
 *
 * This test runs scripts/check-schema-parity.sh: it renders schema.ts with
 * drizzle-kit export and diffs it against the migration directory through Atlas
 * on a disposable dev database. Any migration the diff would emit means the two
 * copies drifted.
 *
 * Script exit codes: 0 in sync, 1 drift (or the diff failed), 2 the gate could
 * not run (no Atlas / no dev database). A 2 fails this test too, on purpose:
 * a parity gate that silently skips is not a gate. Local runs need
 * SCHEMA_PARITY_DEV_URL=postgresql://user@127.0.0.1:5432/scratch?search_path=public
 * (CI provides docker or the host postgres; see the script header).
 */
const APP_DIR = join(import.meta.dir, '..', '..', '..')
const GATE_TIMEOUT_MS = 15 * 60 * 1000

describe('schema/migration parity', () => {
	test(
		'drizzle schema and atlas migrations describe the same DDL',
		() => {
			const result = spawnSync('bash', ['scripts/check-schema-parity.sh'], {
				cwd: APP_DIR,
				encoding: 'utf8',
				timeout: GATE_TIMEOUT_MS,
				env: process.env,
			})
			if (result.error) {
				throw new Error(`could not run the parity gate: ${result.error.message}`)
			}
			if (result.status !== 0) {
				const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
				throw new Error(
					[
						`check-schema-parity.sh failed (status=${result.status}, signal=${result.signal ?? 'none'})`,
						'The drizzle schema (drizzle-kit export) and atlas/migrations do not agree, or the gate could not run:',
						output,
					].join('\n'),
				)
			}
			expect(result.status).toBe(0)
		},
		GATE_TIMEOUT_MS,
	)
})
