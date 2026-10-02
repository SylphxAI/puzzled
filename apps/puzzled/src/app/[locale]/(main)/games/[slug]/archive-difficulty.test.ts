import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// The browser fallback asks for the archive board at the played level; the
// server-rendered read must ask for the same one.
test('the server archive read passes the level like the client fallback', () => {
	const source = readFileSync(join(import.meta.dir, 'game-play-area.tsx'), 'utf8')
	const start = source.indexOf('if (archiveDate) {')
	const call = source.slice(start, source.indexOf('puzzle = {', start))
	expect(call).toContain('puzzleDate: archiveDate')
	expect(call).toMatch(/\bdifficulty,/)
})
