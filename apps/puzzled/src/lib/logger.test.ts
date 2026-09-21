import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
	correlationIdFrom,
	type LogFields,
	type LogLevel,
	log,
	logger,
	setLogLevel,
} from './logger'

type Recorded = { method: string; args: unknown[] }

const METHODS = ['debug', 'log', 'warn', 'error'] as const
const originalConsole: Record<string, (...args: unknown[]) => void> = {}

let recorded: Recorded[] = []

function capture(): void {
	recorded = []
	for (const method of METHODS) {
		originalConsole[method] = console[method]
		;(console as unknown as Record<string, unknown>)[method] = (...args: unknown[]) => {
			recorded.push({ method, args })
		}
	}
}

function restore(): void {
	for (const method of METHODS) {
		;(console as unknown as Record<string, unknown>)[method] = originalConsole[method]
	}
}

beforeEach(() => {
	setLogLevel(null)
	capture()
})

afterEach(() => {
	restore()
	setLogLevel(null)
})

describe('logger', () => {
	test('emits one record per call, tagged with the level', () => {
		logger.info('example.event', { a: 1 })
		logger.warn('no.fields')
		expect(recorded).toHaveLength(2)
		expect(recorded[0].method).toBe('log')
		expect(recorded[0].args).toEqual(['[info] example.event', { a: 1 }])
		expect(recorded[1].method).toBe('warn')
		expect(recorded[1].args).toEqual(['[warn] no.fields'])
	})

	test('maps levels to the console methods the old call sites used', () => {
		logger.debug('d')
		logger.info('i')
		logger.warn('w')
		logger.error('e')
		expect(recorded.map((r) => r.method)).toEqual(['debug', 'log', 'warn', 'error'])
		expect(recorded.map((r) => r.args[0])).toEqual([
			'[debug] d',
			'[info] i',
			'[warn] w',
			'[error] e',
		])
	})

	test('setLogLevel gates lower levels without muting the rest', () => {
		setLogLevel('warn')
		logger.debug('hidden')
		logger.info('hidden')
		logger.warn('shown')
		logger.error('shown2')
		expect(recorded.map((r) => r.args[0])).toEqual(['[warn] shown', '[error] shown2'])
	})

	test('reads LOG_LEVEL from the environment when no explicit level is set', () => {
		process.env.LOG_LEVEL = 'error'
		setLogLevel(null)
		logger.warn('hidden')
		logger.error('shown')
		expect(recorded.map((r) => r.args[0])).toEqual(['[error] shown'])
		delete process.env.LOG_LEVEL
	})

	test('redacts sensitive fields, exact and lookalike keys', () => {
		logger.info('auth.event', {
			email: 'member@example.com',
			token: 'tok-123',
			authorization: 'Bearer xyz',
			cookie: 'sid=abc',
			secret: 'shh',
			password: 'hunter2',
			userEmail: 'aliased@example.com',
			userId: 'u1',
			count: 2,
		})
		const payload = recorded[0].args[1] as Record<string, unknown>
		expect(payload.email).toBe('[redacted]')
		expect(payload.token).toBe('[redacted]')
		expect(payload.authorization).toBe('[redacted]')
		expect(payload.cookie).toBe('[redacted]')
		expect(payload.secret).toBe('[redacted]')
		expect(payload.password).toBe('[redacted]')
		expect(payload.userEmail).toBe('[redacted]')
		expect(payload.userId).toBe('u1')
		expect(payload.count).toBe(2)
	})

	test('passes correlationId through untouched', () => {
		logger.info('req.event', { correlationId: 'req-1', ok: true })
		const payload = recorded[0].args[1] as Record<string, unknown>
		expect(payload.correlationId).toBe('req-1')
		expect(payload.ok).toBe(true)
	})

	test('never throws on odd inputs', () => {
		const circular: Record<string, unknown> = {}
		circular.self = circular
		const evilGetter = {
			get boom(): never {
				throw new Error('getter exploded')
			},
			safe: 1,
		}
		expect(() => {
			log('info', 'odd.null-fields', null)
			log('info', 'odd.circular', circular)
			log('info', 'odd.getter', evilGetter as LogFields)
			log('info', 42 as unknown as string, undefined)
			log('nonsense' as unknown as LogLevel, 'odd.level', { x: 1 })
			logger.error('odd.non-object', 'just-a-string' as unknown as LogFields)
		}).not.toThrow()
		expect(recorded.length).toBeGreaterThanOrEqual(3)
	})
})

describe('correlationIdFrom', () => {
	test('reads the usual headers and tolerates junk', () => {
		expect(correlationIdFrom(new Headers({ 'x-request-id': 'r1' }))).toBe('r1')
		expect(correlationIdFrom(new Headers({ 'x-correlation-id': 'c1' }))).toBe('c1')
		expect(correlationIdFrom(new Headers())).toBeUndefined()
		expect(correlationIdFrom(null)).toBeUndefined()
		expect(
			correlationIdFrom({
				get: () => {
					throw new Error('nope')
				},
			}),
		).toBeUndefined()
	})
})
