import { describe, expect, test } from 'bun:test'
import { SERVER_CONNECT_TIMEOUT_MS } from '@/lib/api/connect-fetch'
import {
	isHtmlDocument,
	PRESENTATION_DOCUMENT_TIMEOUT_MS,
	withPresentationDeadline,
} from '@/lib/presentation-document'

describe('GET / presentation document', () => {
	test('isHtmlDocument rejects empty bodies (healthz is not this oracle)', () => {
		expect(isHtmlDocument('text/html', '')).toBe(false)
		expect(isHtmlDocument('application/json', '{"ok":true}')).toBe(false)
		expect(
			isHtmlDocument(
				'text/html; charset=utf-8',
				'<!DOCTYPE html><html><body>Puzzled</body></html>',
			),
		).toBe(true)
	})

	test('withPresentationDeadline returns fallback when the work never completes', async () => {
		const started = Date.now()
		const value = await withPresentationDeadline(new Promise<string>(() => {}), 'document', 200)
		expect(value).toBe('document')
		expect(Date.now() - started).toBeLessThan(1500)
	})

	test('withPresentationDeadline uses fallback when the work rejects', async () => {
		const value = await withPresentationDeadline(
			Promise.reject(new Error('platform down')),
			'document',
		)
		expect(value).toBe('document')
	})

	test('document timeout matches SSR Connect bound', () => {
		expect(PRESENTATION_DOCUMENT_TIMEOUT_MS).toBe(SERVER_CONNECT_TIMEOUT_MS)
		expect(PRESENTATION_DOCUMENT_TIMEOUT_MS).toBeLessThanOrEqual(2000)
	})
})
