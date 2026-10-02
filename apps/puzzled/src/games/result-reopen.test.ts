import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const gamesDir = import.meta.dir
const gameFiles = readdirSync(gamesDir, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => ({
		slug: entry.name,
		file: join(gamesDir, entry.name, `${entry.name}-game.tsx`),
	}))
	.filter(({ file }) => {
		try {
			readFileSync(file)
			return true
		} catch {
			return false
		}
	})

describe('every game reopens its result', () => {
	test('all nineteen served games are covered', () => {
		expect(gameFiles).toHaveLength(19)
	})

	for (const { slug, file } of gameFiles) {
		test(`${slug} offers SeeResultButton from the shared resultReady signal`, () => {
			const source = readFileSync(file, 'utf8')
			expect(source).toContain('<SeeResultButton')
			expect(source).toContain('finished={resultReady}')
			expect(source).toContain('modalOpen={showResultModal}')
			expect(source).toContain('onOpen={() => setShowResultModal(true)}')
			expect(source).not.toMatch(/<SeeResultButton[^>]*finished=\{game\.state\.isComplete\}/)
		})
	}
})
