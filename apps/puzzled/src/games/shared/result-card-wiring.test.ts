/**
 * Result-card wiring oracle (S3 slice 2).
 *
 * The card only labels the right day if every result surface hands the modal
 * the product day it rendered, and the only way to see a component's props
 * without a React renderer is to read the source. Each module owns its own
 * <GameResultModal> call, so this walks them and fails when one stops passing
 * the day - the same shape as the share deep-link guard next door.
 */
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(import.meta.dir, '..', '..')

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry)
		if (statSync(path).isDirectory()) {
			if (entry === 'node_modules') continue
			walk(path, out)
		} else if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx')) {
			out.push(path)
		}
	}
	return out
}

describe('result-card wiring', () => {
	const files = walk(SRC)
	const modalCallers = files.filter((file) =>
		readFileSync(file, 'utf8').includes('<GameResultModal'),
	)

	test('every GameResultModal call site dates the card with its product day', () => {
		expect(modalCallers.length).toBeGreaterThanOrEqual(19)
		const missing = modalCallers
			.filter((file) => !readFileSync(file, 'utf8').includes('puzzleDate={puzzleDate}'))
			.map((file) => file.replace(SRC + '/', ''))
		expect(missing).toEqual([])
	})

	test('the result surface offers the card share and keeps the text share', () => {
		const surface = readFileSync(join(SRC, 'features/daily/components/game-result.tsx'), 'utf8')
		expect(surface).toContain('shareRitualResultCard(')
		expect(surface).toContain('resultCardTextAlternative(')
		expect(surface).toContain("tShare('card.share')")
		// The legacy text share stays wired to the same onShare prop.
		expect(surface).toContain('onClick={onShare}')
	})

	test('the modal passes the card props straight through', () => {
		const modal = readFileSync(join(SRC, 'features/daily/components/game-result-modal.tsx'), 'utf8')
		expect(modal).toContain('ComponentProps<typeof GameResultCard>')
		expect(modal).toContain('<GameResultCard {...cardProps} />')
	})
})
