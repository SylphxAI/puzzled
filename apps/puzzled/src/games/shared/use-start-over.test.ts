import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

mock.module('@/features/gamification', () => ({
	useSaveGameResult: () => ({
		isLoggedIn: false,
		saveResult: async () => ({ success: true, score: 90 }),
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

async function mount() {
	const holder = { boardResets: 0 } as Harness
	const resetBoard = () => {
		holder.boardResets += 1
	}
	function Probe() {
		holder.session = useGameSession({ gameSlug: 'tango', resultModalDelay: DELAY })
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
