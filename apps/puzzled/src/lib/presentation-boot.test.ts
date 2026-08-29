import { describe, expect, test } from 'bun:test'
import { sylphxAuthConfigured } from './presentation-boot'

describe('presentation boot auth gate', () => {
	test('skips dest Identity chrome when Identity credentials are absent', () => {
		expect(sylphxAuthConfigured({ NODE_ENV: 'production' })).toBe(false)
		expect(sylphxAuthConfigured({ IDENTITY_API_KEY: '' })).toBe(false)
		expect(sylphxAuthConfigured({ SYLPHX_SECRET_KEY: 'sk_prod_x' })).toBe(false)
	})

	test('enables dest Identity chrome when Identity product credentials are present', () => {
		expect(sylphxAuthConfigured({ IDENTITY_API_KEY: 'identity_org_key_x' })).toBe(true)
		expect(sylphxAuthConfigured({ IDENTITY_ORGANIZATION_ID: 'org_x' })).toBe(true)
	})
})
