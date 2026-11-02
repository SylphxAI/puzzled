import { expect, test } from '@playwright/test'

test('llms.txt stays public plain text even with a remembered locale', async ({ request }) => {
	const headers = { Cookie: 'NEXT_LOCALE=zh-HK', 'Accept-Language': 'zh-HK' }
	const response = await request.get('/llms.txt', { headers, maxRedirects: 0 })
	expect(response.status()).toBe(200)
	expect(response.headers()['content-type']).toBe('text/plain; charset=utf-8')
	const body = await response.text()
	expect(body).toMatch(/^# Puzzled\n/)
	expect(body).toContain('published by Sylphx')
	expect(body).not.toMatch(/Sylphx Puzzled|<html|<script/i)
	const head = await request.head('/llms.txt', { headers, maxRedirects: 0 })
	expect(head.status()).toBe(200)
	expect(head.headers()['content-type']).toBe('text/plain; charset=utf-8')
})
