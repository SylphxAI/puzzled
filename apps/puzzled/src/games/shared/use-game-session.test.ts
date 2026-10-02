import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

// The session hook's only external effect is the save call; the test decides
// whether the server accepts the finish.
let accept = true
mock.module('@/features/gamification', () => ({
	useSaveGameResult: () => ({
		isLoggedIn: false,
		reset: () => {},
		saveResult: async () =>
			accept ? { success: true, score: 90 } : { success: false, error: 'not_solved' },
	}),
}))

type Session = import('./use-game-session').UseGameSessionReturn
type Harness = { current: Session }

const DELAY = 30
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const END = { status: 'won' as const, attempts: 1, data: {} }

let React: typeof import('react')
let createRoot: typeof import('react-dom/client').createRoot
let useGameSession: typeof import('./use-game-session').useGameSession

beforeAll(async () => {
	GlobalRegistrator.register()
	// biome-ignore lint/suspicious/noExplicitAny: React's act flag lives on globalThis.
	;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
	React = await import('react')
	;({ createRoot } = await import('react-dom/client'))
	;({ useGameSession } = await import('./use-game-session'))
})

afterAll(async () => {
	await GlobalRegistrator.unregister()
})

async function mount(requireServerAccept: boolean) {
	const holder = {} as Harness
	function Probe() {
		holder.current = useGameSession({
			gameSlug: 'sudoku',
			resultModalDelay: DELAY,
			requireServerAccept,
		})
		return null
	}
	const root = createRoot(document.createElement('div'))
	await React.act(async () => {
		root.render(React.createElement(Probe))
	})
	return { holder, root }
}

describe('useGameSession resultReady', () => {
	test('stays false until the result modal opens, then becomes true with it', async () => {
		accept = true
		const { holder, root } = await mount(false)
		expect(holder.current.resultReady).toBe(false)
		await React.act(async () => {
			await holder.current.endGame(END)
		})
		expect(holder.current.resultReady).toBe(false)
		expect(holder.current.showResultModal).toBe(false)
		await React.act(async () => {
			await sleep(DELAY + 40)
		})
		expect(holder.current.showResultModal).toBe(true)
		expect(holder.current.resultReady).toBe(true)
		// Closing the modal keeps the result reopenable.
		await React.act(async () => holder.current.setShowResultModal(false))
		expect(holder.current.showResultModal).toBe(false)
		expect(holder.current.resultReady).toBe(true)
		await React.act(async () => root.unmount())
	})

	test('a finish the server does not accept never makes the result ready', async () => {
		accept = false
		const { holder, root } = await mount(true)
		let outcome = { success: true }
		await React.act(async () => {
			outcome = await holder.current.endGame(END)
		})
		await React.act(async () => {
			await sleep(DELAY + 40)
		})
		expect(outcome.success).toBe(false)
		expect(holder.current.resultReady).toBe(false)
		expect(holder.current.showResultModal).toBe(false)
		await React.act(async () => root.unmount())
	})

	test('an accepted finish on a server-accept game becomes ready after the modal opens', async () => {
		accept = true
		const { holder, root } = await mount(true)
		await React.act(async () => {
			await holder.current.endGame(END)
		})
		expect(holder.current.resultReady).toBe(false)
		await React.act(async () => {
			await sleep(DELAY + 40)
		})
		expect(holder.current.resultReady).toBe(true)
		expect(holder.current.showResultModal).toBe(true)
		await React.act(async () => root.unmount())
	})

	test('reset clears the pending timer and the ready state', async () => {
		accept = true
		const { holder, root } = await mount(false)
		await React.act(async () => {
			await holder.current.endGame(END)
		})
		// Reset races the pending timer: the timer must not fire afterwards.
		await React.act(async () => holder.current.resetSession())
		await React.act(async () => {
			await sleep(DELAY + 40)
		})
		expect(holder.current.resultReady).toBe(false)
		expect(holder.current.showResultModal).toBe(false)
		// A ready session is cleared by reset too.
		await React.act(async () => {
			await holder.current.endGame(END)
			await sleep(DELAY + 40)
		})
		expect(holder.current.resultReady).toBe(true)
		await React.act(async () => holder.current.resetSession())
		expect(holder.current.resultReady).toBe(false)
		expect(holder.current.showResultModal).toBe(false)
		await React.act(async () => root.unmount())
	})

	test('unmounting before the timer fires leaves nothing pending', async () => {
		accept = true
		const { holder, root } = await mount(false)
		await React.act(async () => {
			await holder.current.endGame(END)
		})
		await React.act(async () => root.unmount())
		await sleep(DELAY + 40)
		expect(holder.current.resultReady).toBe(false)
	})
})
