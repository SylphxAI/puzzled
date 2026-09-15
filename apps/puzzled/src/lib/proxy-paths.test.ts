/**
 * The proxy skip list decides which requests bypass locale routing. Wrong in
 * one direction it breaks the metadata documents; wrong in the other it sends
 * a non-asset path into the app router as an invalid locale segment.
 */

import { describe, expect, test } from 'bun:test'
import { isProxySkippedPath } from './proxy-paths'

describe('proxy path skipping', () => {
	test('serves the root metadata documents outside locale routing', () => {
		for (const path of ['/robots.txt', '/sitemap.xml', '/manifest.webmanifest']) {
			expect(isProxySkippedPath(path)).toBe(true)
		}
	})

	test('serves real static assets', () => {
		for (const path of [
			'/favicon.ico',
			'/og-image.png',
			'/apple-touch-icon.png',
			'/icons/icon-512.png',
			'/brand/mark.svg',
		]) {
			expect(isProxySkippedPath(path)).toBe(true)
		}
	})

	test('sends app paths that merely look like files to the i18n rewrite', () => {
		for (const path of [
			'/index.html',
			'/some-page.html',
			'/notes.txt',
			'/missing.json',
			'/a.b/c',
		]) {
			expect(isProxySkippedPath(path)).toBe(false)
		}
	})

	test('keeps internals and probes skipped', () => {
		for (const path of [
			'/_next/static/chunk.js',
			'/api/identity/session',
			'/monitoring',
			'/healthz',
			'/readyz',
		]) {
			expect(isProxySkippedPath(path)).toBe(true)
		}
	})
})
