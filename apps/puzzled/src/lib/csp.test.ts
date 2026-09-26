import { describe, expect, test } from 'bun:test'
import { NextRequest } from 'next/server'
import { proxy } from '../proxy'
import { buildCsp, createNonce, NONCE_HEADER } from './csp'
import { cspViolationMessage } from './observability/browser'

function directive(csp: string, name: string): string {
	return csp.split('; ').find((part) => part.startsWith(`${name} `)) ?? ''
}

describe('content security policy', () => {
	test('scripts run only with the nonce: no unsafe-inline, no unsafe-eval', () => {
		const scripts = directive(buildCsp('abc'), 'script-src')
		expect(scripts).toBe("script-src 'self' 'nonce-abc' 'strict-dynamic'")
		expect(buildCsp('abc')).not.toContain("'unsafe-eval'")
	})

	test('development adds unsafe-eval for React and HMR only', () => {
		expect(directive(buildCsp('abc', { dev: true }), 'script-src')).toContain("'unsafe-eval'")
	})

	test('service worker keeps its own source, since strict-dynamic ignores self', () => {
		expect(directive(buildCsp('abc'), 'worker-src')).toBe("worker-src 'self'")
	})

	test('every nonce is fresh, 16 random bytes', () => {
		const nonce = createNonce()
		expect(atob(nonce)).toHaveLength(16)
		expect(createNonce()).not.toBe(nonce)
	})

	test('the proxy puts a matching nonce policy on the page and the request', async () => {
		const response = await proxy(new NextRequest('https://puzzled.gg/games'))
		const csp = response.headers.get('content-security-policy') ?? ''
		const nonce = csp.match(/'nonce-([^']+)'/)?.[1]
		if (!nonce) throw new Error('no nonce in the policy')
		expect(response.headers.get(`x-middleware-request-${NONCE_HEADER}`)).toBe(nonce)
		expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(csp)
	})

	test('proxy-skipped paths get the policy too', async () => {
		const response = await proxy(new NextRequest('https://puzzled.gg/favicon.png'))
		expect(response.headers.get('content-security-policy')).toContain("'strict-dynamic'")
	})

	test('violation reports group by directive and blocked origin', () => {
		expect(
			cspViolationMessage({
				effectiveDirective: 'script-src-elem',
				blockedURI: 'https://evil.example/x.js?token=1',
			}),
		).toBe('CSP script-src-elem blocked https://evil.example')
		expect(
			cspViolationMessage({ effectiveDirective: 'script-src-elem', blockedURI: 'inline' }),
		).toBe('CSP script-src-elem blocked inline')
	})
})
