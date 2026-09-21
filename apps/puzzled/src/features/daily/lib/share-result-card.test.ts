import { describe, expect, test } from 'bun:test'
import { buildResultCard, type ResultCardStrings } from './result-card'
import {
	type ShareResultCardDeps,
	shareResultCard,
	shareRitualResultCard,
} from './share-result-card'

const STRINGS: ResultCardStrings = {
	statusWon: 'Solved!',
	statusLost: 'Not this time',
	dayLabel: 'Day',
	attemptsLabel: 'Attempts',
	scoreLabel: 'Score',
	streakLabel: 'Streak',
	timeLabel: 'Time',
	mistakesLabel: 'Mistakes',
	timeUnder1m: 'Under a minute',
	timeUnder5m: 'One to five minutes',
	timeOver5m: 'Over five minutes',
	attemptsOf: '{attempts} of {max}',
	attemptsCount: '{attempts} attempts',
	scorePoints: '{score} points',
	streakDays: '{days}-day streak',
	patternSummary: 'Pattern: {hit} hit / {near} near / {miss} miss',
	altOnDay: ' on {day}',
	altTemplate: 'Puzzled result - {game}{day}. {result}',
	altDetailsTemplate: ' {details}.',
	altLinkTemplate: ' Play: {link}',
	detailSeparator: ', ',
}

const MODEL = buildResultCard({
	origin: 'https://puzzled.gg',
	gameSlug: 'word-guess',
	gameName: 'Five',
	theme: 'emerald',
	mode: 'daily',
	status: 'won',
	locale: 'en-US',
	puzzleDate: '2026-09-21',
	attempts: 3,
	maxAttempts: 6,
	timeSpentMs: 74_000,
	currentStreak: 4,
})

const BLOB = new Blob(['png-bytes'], { type: 'image/png' })

function fakeFile(blob: Blob, fileName: string, type: string) {
	// A File-shaped payload: the module only reads name/type from it.
	return { name: fileName, type, size: blob.size } as unknown as Blob & { name?: string }
}

function navDouble(options: {
	share?: (data: ShareData) => Promise<void>
	canShare?: (data?: ShareData) => boolean
	writeText?: (text: string) => Promise<void>
}) {
	const calls = { share: [] as ShareData[], canShare: 0, writeText: [] as string[] }
	const nav = {
		share: async (data: ShareData) => {
			calls.share.push(data)
			if (options.share) await options.share(data)
		},
		canShare: (data?: ShareData) => {
			calls.canShare += 1
			return options.canShare ? options.canShare(data) : true
		},
		clipboard: {
			writeText: async (text: string) => {
				calls.writeText.push(text)
				if (options.writeText) await options.writeText(text)
			},
		},
	} as unknown as Navigator
	return { nav, calls }
}

function docDouble() {
	const clicks: Array<{ href: string; download: string }> = []
	const doc = {
		createElement: () => ({
			href: '',
			download: '',
			style: {},
			click(this: { href: string; download: string }) {
				clicks.push({ href: this.href, download: this.download })
			},
		}),
		body: { appendChild: () => undefined, removeChild: () => undefined },
	} as unknown as Document
	return { doc, clicks }
}

function urlDouble() {
	const created: Blob[] = []
	const revoked: string[] = []
	return {
		created,
		revoked,
		createObjectURL: (blob: Blob) => {
			created.push(blob)
			return 'blob:fake-1'
		},
		revokeObjectURL: (url: string) => {
			revoked.push(url)
		},
	}
}

function baseDeps(overrides: Partial<ShareResultCardDeps> = {}): ShareResultCardDeps {
	return {
		createFile: fakeFile as unknown as ShareResultCardDeps['createFile'],
		...overrides,
	}
}

describe('shareResultCard', () => {
	test('shares the image through the platform sheet when files are supported', async () => {
		const { nav, calls } = navDouble({ canShare: () => true })
		const result = await shareResultCard(
			{
				blob: BLOB,
				fileName: 'puzzled-result-word-guess-2026-09-21.png',
				text: 'caption',
				title: 'T',
			},
			baseDeps({ navigator: nav, document: null }),
		)
		expect(result).toEqual({ outcome: 'shared', captionCopied: false })
		expect(calls.canShare).toBe(1)
		expect(calls.share.length).toBe(1)
		const files = calls.share[0]?.files as unknown as Array<{ name?: string; type?: string }>
		expect(files?.[0]?.name).toBe('puzzled-result-word-guess-2026-09-21.png')
		expect(files?.[0]?.type).toBe('image/png')
		expect(calls.share[0]?.text).toBe('caption')
		expect(calls.writeText.length).toBe(0)
	})

	test('reports a dismissed sheet as cancelled and does nothing else', async () => {
		const { nav, calls } = navDouble({
			canShare: () => true,
			share: async () => {
				const error = new Error('dismissed')
				error.name = 'AbortError'
				throw error
			},
		})
		const url = urlDouble()
		const { doc, clicks } = docDouble()
		const result = await shareResultCard(
			{ blob: BLOB, fileName: 'f.png', text: 'caption', title: 'T' },
			baseDeps({ navigator: nav, document: doc, ...url }),
		)
		expect(result).toEqual({ outcome: 'cancelled', captionCopied: false })
		expect(calls.share.length).toBe(1)
		expect(clicks.length).toBe(0)
		expect(url.created.length).toBe(0)
	})

	test('falls back to download + caption copy when the sheet refuses the files', async () => {
		const { nav, calls } = navDouble({ canShare: () => false })
		const url = urlDouble()
		const { doc, clicks } = docDouble()
		const result = await shareResultCard(
			{
				blob: BLOB,
				fileName: 'puzzled-result-word-guess-2026-09-21.png',
				text: 'caption',
				title: 'T',
			},
			baseDeps({ navigator: nav, document: doc, ...url }),
		)
		expect(result).toEqual({ outcome: 'downloaded', captionCopied: true })
		expect(calls.share.length).toBe(0)
		expect(clicks).toEqual([
			{ href: 'blob:fake-1', download: 'puzzled-result-word-guess-2026-09-21.png' },
		])
		expect(url.created.length).toBe(1)
		expect(url.revoked).toEqual(['blob:fake-1'])
		expect(calls.writeText).toEqual(['caption'])
	})

	test('falls back when sharing throws something other than an abort', async () => {
		const { nav, calls } = navDouble({
			canShare: () => true,
			share: async () => {
				throw new Error('NotAllowedError')
			},
		})
		const url = urlDouble()
		const { doc, clicks } = docDouble()
		const result = await shareResultCard(
			{ blob: BLOB, fileName: 'f.png', text: 'caption', title: 'T' },
			baseDeps({ navigator: nav, document: doc, ...url }),
		)
		expect(result.outcome).toBe('downloaded')
		expect(calls.share.length).toBe(1)
		expect(clicks.length).toBe(1)
	})

	test('downloads even when the platform has no share() at all', async () => {
		const nav = { clipboard: { writeText: async () => undefined } } as unknown as Navigator
		const url = urlDouble()
		const { doc, clicks } = docDouble()
		const result = await shareResultCard(
			{ blob: BLOB, fileName: 'f.png', text: 'caption', title: 'T' },
			baseDeps({ navigator: nav, document: doc, ...url }),
		)
		expect(result).toEqual({ outcome: 'downloaded', captionCopied: true })
		expect(clicks.length).toBe(1)
	})

	test('copies the caption alone when there is no document to download through', async () => {
		const { nav, calls } = navDouble({ canShare: () => false })
		const result = await shareResultCard(
			{ blob: BLOB, fileName: 'f.png', text: 'caption', title: 'T' },
			baseDeps({ navigator: nav, document: null }),
		)
		expect(result).toEqual({ outcome: 'copied', captionCopied: true })
		expect(calls.writeText).toEqual(['caption'])
	})

	test('stays honest when nothing is possible', async () => {
		const result = await shareResultCard(
			{ blob: BLOB, fileName: 'f.png', text: 'caption', title: 'T' },
			baseDeps({ navigator: null, document: null }),
		)
		expect(result).toEqual({ outcome: 'unavailable', captionCopied: false })
	})

	test('copies the caption when the image could not be rendered', async () => {
		const { nav, calls } = navDouble({ canShare: () => true })
		const result = await shareResultCard(
			{ blob: null, fileName: 'f.png', text: 'caption', title: 'T' },
			baseDeps({ navigator: nav, document: null }),
		)
		expect(result).toEqual({ outcome: 'copied', captionCopied: true })
		expect(calls.share.length).toBe(0)
		expect(calls.writeText).toEqual(['caption'])
	})

	test('does not claim success when the clipboard refuses', async () => {
		const nav = {
			clipboard: {
				writeText: async () => {
					throw new Error('denied')
				},
			},
		} as unknown as Navigator
		const result = await shareResultCard(
			{ blob: null, fileName: 'f.png', text: 'caption', title: 'T' },
			baseDeps({ navigator: nav, document: null }),
		)
		expect(result).toEqual({ outcome: 'unavailable', captionCopied: false })
	})
})

describe('shareRitualResultCard', () => {
	test('renders with the injected renderer and shares the image', async () => {
		const { nav, calls } = navDouble({ canShare: () => true })
		const rendered: string[] = []
		const result = await shareRitualResultCard(
			{ model: MODEL, strings: STRINGS, text: 'existing text share', title: 'Puzzled' },
			baseDeps({
				navigator: nav,
				document: null,
				renderBlob: async (model) => {
					rendered.push(model.deepLink)
					return BLOB
				},
			}),
		)
		expect(result).toEqual({ outcome: 'shared', captionCopied: false })
		expect(rendered).toEqual(['puzzled.gg/games/word-guess?mode=archive&date=2026-09-21'])
		const files = calls.share[0]?.files as unknown as Array<{ name?: string }>
		expect(files?.[0]?.name).toBe('puzzled-result-word-guess-2026-09-21.png')
		expect(calls.share[0]?.text).toBe('existing text share')
	})

	test('uses the text alternative as caption when no text share is given', async () => {
		const { nav, calls } = navDouble({ canShare: () => false })
		const result = await shareRitualResultCard(
			{ model: MODEL, strings: STRINGS, title: 'Puzzled' },
			baseDeps({ navigator: nav, document: null, renderBlob: async () => null }),
		)
		expect(result.outcome).toBe('copied')
		expect(calls.writeText.length).toBe(1)
		expect(calls.writeText[0]).toContain('Five')
		expect(calls.writeText[0]).toContain('puzzled.gg/games/word-guess?mode=archive&date=2026-09-21')
		expect(calls.writeText[0]?.toLowerCase()).not.toContain('solution')
	})

	test('survives a renderer that throws, falling back to the caption', async () => {
		const { nav, calls } = navDouble({ canShare: () => true })
		const result = await shareRitualResultCard(
			{ model: MODEL, strings: STRINGS, text: 'caption', title: 'Puzzled' },
			baseDeps({
				navigator: nav,
				document: null,
				renderBlob: async () => {
					throw new Error('no canvas')
				},
			}),
		)
		expect(result).toEqual({ outcome: 'copied', captionCopied: true })
		expect(calls.share.length).toBe(0)
	})
})
