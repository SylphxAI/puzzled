import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

// The mock models the real save hook: a client lock that answers 'Already saved'
// until reset, and a server that answers already_played for a second finish.
type SaveOutcome = { success: boolean; score?: number; error?: string }
let outcomes: SaveOutcome[] = []
let gate: Promise<void> | null = null
let locked = false
mock.module('@/features/gamification', () => ({
	useSaveGameResult: () => ({
		isLoggedIn: false,
		reset: () => {
			locked = false
		},
		saveResult: async (): Promise<SaveOutcome> => {
			if (locked) return { success: false, error: 'Already saved' }
			locked = true
			if (gate) await gate
			return outcomes.shift() ?? { success: true, score: 90 }
		},
	}),
}))

const DELAY = 30
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const END = { status: 'won' as const, attempts: 1, data: {} }

type Session = import('./use-game-session').UseGameSessionReturn
type Harness = { session: Session; startOver: () => void; boardResets: number }

let React: typeof import('react')
let createRoot: typeof import('react-dom/client').createRoot
let useGameSession: typeof import('./use-game-session').useGameSession
let useStartOver: typeof import('./use-start-over').useStartOver

beforeAll(async () => {
	GlobalRegistrator.register()
	// biome-ignore lint/suspicious/noExplicitAny: React's act flag lives on globalThis.
	;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
	React = await import('react')
	;({ createRoot } = await import('react-dom/client'))
	;({ useGameSession } = await import('./use-game-session'))
	;({ useStartOver } = await import('./use-start-over'))
})

afterAll(async () => {
	await GlobalRegistrator.unregister()
})

async function mount(requireServerAccept = false) {
	const holder = { boardResets: 0 } as Harness
	const resetBoard = () => {
		holder.boardResets += 1
	}
	function Probe() {
		holder.session = useGameSession({
			gameSlug: 'tango',
			resultModalDelay: DELAY,
			requireServerAccept,
		})
		holder.startOver = useStartOver(holder.session.resetSession, resetBoard)
		return null
	}
	const root = createRoot(document.createElement('div'))
	await React.act(async () => {
		root.render(React.createElement(Probe))
	})
	return { holder, root }
}

describe('useStartOver', () => {
	beforeEach(() => {
		locked = false
		gate = null
		outcomes = []
	})

	test('a re-solve after Start over is decided by the server (already_played) and celebrates', async () => {
		locked = false
		gate = null
		outcomes = [
			{ success: true, score: 90 },
			{ success: false, error: 'already_played' },
		]
		const { holder, root } = await mount(true)
		await React.act(async () => {
			await holder.session.endGame(END)
		})
		await React.act(async () => {
			await sleep(DELAY + 40)
		})
		expect(holder.session.resultReady).toBe(true)
		await React.act(async () => holder.startOver())
		expect(holder.session.resultReady).toBe(false)
		let again = { success: false } as { success: boolean }
		await React.act(async () => {
			again = await holder.session.endGame(END)
		})
		expect(again.success).toBe(true)
		await React.act(async () => {
			await sleep(DELAY + 40)
		})
		expect(holder.session.resultReady).toBe(true)
		expect(holder.session.showResultModal).toBe(true)
		await React.act(async () => root.unmount())
	})

	test('a save still in flight when Start over is pressed is ignored', async () => {
		locked = false
		outcomes = [{ success: true, score: 90 }]
		let release: () => void = () => {}
		gate = new Promise<void>((resolve) => {
			release = resolve
		})
		const { holder, root } = await mount(true)
		let pending: Promise<{ success: boolean; stale?: boolean }> = Promise.resolve({
			success: false,
		})
		await React.act(async () => {
			pending = holder.session.endGame(END)
		})
		await React.act(async () => holder.startOver())
		let late = { success: true } as { success: boolean; stale?: boolean }
		await React.act(async () => {
			release()
			late = await pending
			await sleep(DELAY + 40)
		})
		gate = null
		expect(late.stale).toBe(true)
		expect(late.success).toBe(false)
		expect(holder.session.showCelebration).toBe(false)
		expect(holder.session.showResultModal).toBe(false)
		expect(holder.session.resultReady).toBe(false)
		expect(holder.session.serverScore).toBeNull()
		await React.act(async () => root.unmount())
	})

	test('inside the celebration window it cancels the result timer and resets the board', async () => {
		const { holder, root } = await mount()
		await React.act(async () => {
			await holder.session.endGame(END)
		})
		await React.act(async () => holder.startOver())
		expect(holder.boardResets).toBe(1)
		await React.act(async () => {
			await sleep(DELAY + 40)
		})
		expect(holder.session.showResultModal).toBe(false)
		expect(holder.session.resultReady).toBe(false)
		await React.act(async () => root.unmount())
	})

	test('after a finish it clears resultReady and closes the modal', async () => {
		const { holder, root } = await mount()
		await React.act(async () => {
			await holder.session.endGame(END)
			await sleep(DELAY + 40)
		})
		expect(holder.session.resultReady).toBe(true)
		expect(holder.session.showResultModal).toBe(true)
		await React.act(async () => holder.startOver())
		expect(holder.boardResets).toBe(1)
		expect(holder.session.resultReady).toBe(false)
		expect(holder.session.showResultModal).toBe(false)
		await React.act(async () => root.unmount())
	})
})
