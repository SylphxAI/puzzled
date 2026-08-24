import { describe, expect, test } from 'bun:test'
import { sylphxAuthConfigured } from './presentation-boot'

describe('presentation boot auth gate', () => {
	test('skips Sylphx middleware when Platform root secret is absent', () => {
		expect(sylphxAuthConfigured({ NODE_ENV: 'production' })).toBe(false)
		expect(sylphxAuthConfigured({ SYLPHX_SECRET_KEY: '' })).toBe(false)
		expect(sylphxAuthConfigured({ SYLPHX_SECRET_URL: '   ' })).toBe(false)
	})

	test('enables Sylphx middleware when key or connection URL is present', () => {
		expect(sylphxAuthConfigured({ SYLPHX_SECRET_KEY: 'sk_prod_x' })).toBe(true)
		expect(
			sylphxAuthConfigured({
				SYLPHX_SECRET_URL: 'sylphx://sk_prod_x@example.sylphx.com/v1',
			}),
		).toBe(true)
	})
})
