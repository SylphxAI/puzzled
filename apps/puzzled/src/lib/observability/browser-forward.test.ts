import { expect, mock, spyOn, test } from 'bun:test'
import { forwardBrowserReport } from './browser-forward'
import type { BrowserReport } from './browser-report'

const report: BrowserReport = {
	type: 'MediaError',
	selector: 'video',
	route: '/games/[slug]',
	breadcrumbs: [{ kind: 'http', route: '/games/[slug]', status: 503 }],
}

test('server SDK adapter uses the environment parent and only the closed report', async () => {
	const fetch = mock(async (_url: URL, _init: RequestInit) => Response.json({}))
	await forwardBrowserReport(report, new AbortController().signal, {
		env: { SYLPHX_API_KEY: 'fixture-only', SYLPHX_GIT_COMMIT_SHA: 'fixture-release' },
		fetch,
	})
	expect(fetch).toHaveBeenCalledTimes(1)
	const [[url, init]] = fetch.mock.calls
	expect(String(url)).toBe(
		'https://api.sylphx.com/v1/orgs/-/projects/-/envs/-/error_groups:capture',
	)
	expect(init.method).toBe('POST')
	expect(init.redirect).toBe('error')
	expect(new Headers(init.headers).get('authorization')).toBe('Bearer fixture-only')
	const body = JSON.parse(String(init.body))
	expect(body.error_event).toMatchObject({
		exception_type: 'MediaError',
		message: 'Media failed to load',
		service_name: 'web-browser',
		release: 'fixture-release',
		tags: { source: 'browser', route: '/games/[slug]', selector: 'video' },
		breadcrumbs: [{ category: 'http', message: JSON.stringify(report.breadcrumbs[0]) }],
	})
	expect(body.error_event).not.toHaveProperty('stack')
})

test('no key skips SDK transport; an outage makes one attempt and stays silent', async () => {
	const fetch = mock(async (_url: URL, _init: RequestInit) => {
		throw new Error('fixture outage')
	})
	const log = spyOn(console, 'error').mockImplementation(() => {})
	try {
		const signal = new AbortController().signal
		await forwardBrowserReport(report, signal, { env: {}, fetch })
		expect(fetch).not.toHaveBeenCalled()
		await forwardBrowserReport(report, signal, { env: { SYLPHX_API_KEY: 'fixture-only' }, fetch })
		expect(fetch).toHaveBeenCalledTimes(1)
		expect(log).not.toHaveBeenCalled()
	} finally {
		log.mockRestore()
	}
})
