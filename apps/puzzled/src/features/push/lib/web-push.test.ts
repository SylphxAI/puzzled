import { describe, expect, test } from 'bun:test'
import { decodePublicKey } from './web-push'

describe('browser VAPID key decoding', () => {
	test('accepts unpadded base64url and preserves the uncompressed P-256 key', () => {
		const bytes = Uint8Array.from({ length: 65 }, (_, index) => (index === 0 ? 4 : index + 190))
		const encoded = btoa(String.fromCharCode(...bytes))
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '')
		expect(decodePublicKey(encoded)).toEqual(bytes)
	})
})
