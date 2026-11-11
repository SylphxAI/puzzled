'use strict'

const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const zlib = require('node:zlib')
const { after, before, test } = require('node:test')
const { installSharedHome, secureDocument, sharedCacheControl, PRIVATE } = require('../shared-home-server.cjs')
const { isSharedHomeRequest, SHARED_HOME_HEADER } = require('../shared-home-policy.cjs')

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'puzzled-shared-home-'))
const script = 'globalThis.sharedHomeLoaded = true;'
fs.mkdirSync(path.join(dir, 'chunks'))
fs.writeFileSync(path.join(dir, 'chunks/main.js'), script)
const now = Date.parse('2026-11-03T15:59:50Z')
const until = Date.parse('2026-11-03T16:00:00Z')
const document = `<html><head><script src="/_next/static/chunks/main.js" async=""></script></head><body><main data-puzzled-shared-home-until="${until}">Guest</main><script>self.__next_f = [[0]];</script></body></html>`
let fixture = { body: document, status: 200, cookie: false }
let server
let port

before(async () => {
	installSharedHome({ staticDir: dir, now: () => now, retention: { assetPrefix: '' } })
	server = http.createServer((req, res) => {
		res.setHeader(SHARED_HOME_HEADER, '1')
		res.setHeader('Content-Type', 'text/html; charset=utf-8')
		res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'strict-dynamic'; object-src 'none'")
		res.setHeader('Cache-Control', PRIVATE)
		if (fixture.cookie) res.setHeader('Set-Cookie', 'unexpected=value; HttpOnly')
		res.writeHead(fixture.status)
		res.write(fixture.body.slice(0, 50))
		res.flushHeaders()
		setImmediate(() => res.end(fixture.body.slice(50)))
	})
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
	port = server.address().port
})
after(async () => {
	await new Promise((resolve) => server.close(resolve))
	fs.rmSync(dir, { recursive: true, force: true })
})

test('only the exact anonymous full root document is shared', () => {
	assert.equal(isSharedHomeRequest('GET', '/', {}), true)
	assert.equal(isSharedHomeRequest('GET', '/', { 'accept-language': 'zh-HK', 'cf-ipcountry': 'GB' }), true)
	for (const [method, url, headers] of [
		['POST', '/', {}], ['HEAD', '/', {}], ['GET', '/pricing', {}], ['GET', '/?checkout=cancelled', {}],
		...['Cookie', 'Authorization', 'rsc', 'next-router-prefetch', 'next-router-state-tree', 'next-router-segment-prefetch', 'next-url', 'next-action'].map((name) => ['GET', '/', { [name]: '' }]),
	]) assert.equal(isSharedHomeRequest(method, url, headers), false)
})

test('external entry and every exact inline byte have SHA-256 authority, no nonce', () => {
	const secured = secureDocument(document, dir)
	const digest = createHash('sha256').update(script).digest('base64')
	assert.ok(secured.body.includes(`integrity="sha256-${digest}"`))
	assert.ok(secured.scriptSources.includes(`'sha256-${digest}'`))
	assert.ok(secured.scriptSources.includes(`'sha256-${createHash('sha256').update('self.__next_f = [[0]];').digest('base64')}'`))
	assert.ok(!secured.body.includes('nonce='))
	assert.throws(() => secureDocument(document.replace('async=""', 'nonce="reused"'), dir))
	assert.throws(() => secureDocument(document.replace('/_next/static/chunks/main.js', '/_next/static/../secret.js'), dir))
	const preloaded = secureDocument(document.replace('<head>', '<head><link rel="preload" as="script" href="/_next/static/chunks/main.js"/>'), dir)
	assert.match(preloaded.body, new RegExp(`<link[^>]+integrity="sha256-${digest.replace(/[+]/g, '\\+')}"`))
	const prefix = 'https://data.example/v1/public/objects/env_production/web-static'
	assert.ok(secureDocument(document.replaceAll('/_next/static/', `${prefix}/_next/static/`), dir, new Map(), prefix).body.includes(`integrity="sha256-${digest}"`))
	assert.throws(() => secureDocument(document.replaceAll('/_next/static/', 'https://untrusted.example/_next/static/'), dir, new Map(), prefix))
})

test('freshness plus SWR cannot cross the authoritative product-day boundary', () => {
	assert.equal(sharedCacheControl(document, now), 'public, max-age=10, stale-while-revalidate=0, stale-if-error=0')
	assert.equal(sharedCacheControl(document, now - 1000 * 7200), 'public, max-age=60, stale-while-revalidate=3600, stale-if-error=0')
	assert.equal(sharedCacheControl(document, until), PRIVATE)
	assert.equal(sharedCacheControl(document.replace('data-puzzled-shared-home-until', 'data-unrelated'), now), PRIVATE)
	for (const bad of [document.replace('</html>', ''), document.replace('Guest', '<template data-dgst="render-failed"></template>'), document.replace('Guest', 'self.__next_f.push([1,"\\n12:E{\\"digest\\":\\"failed\\"}"])')]) {
		assert.equal(sharedCacheControl(bad, now), PRIVATE)
	}
})

async function request(headers = {}, url = '/') {
	return new Promise((resolve, reject) => {
		http.get({ host: '127.0.0.1', port, path: url, headers: { 'accept-encoding': 'identity', ...headers } }, (res) => {
			const chunks = []
			res.on('data', (chunk) => chunks.push(chunk))
			res.on('end', () => {
				const raw = Buffer.concat(chunks)
				resolve({ status: res.statusCode, headers: res.headers, raw, body: raw.toString() })
			})
		}).on('error', reject)
	})
}

test('native Node completes the representation before shared headers, preserving faults and private traffic', async () => {
	fixture = { body: document, status: 200, cookie: false }
	const success = await request()
	assert.equal(success.status, 200)
	assert.equal(success.headers['cache-control'], 'public, max-age=10, stale-while-revalidate=0, stale-if-error=0')
	assert.match(success.headers['content-security-policy'], /sha256-/)
	assert.match(success.headers.vary, /Accept-Encoding, Cookie, Authorization/)
	assert.equal(success.headers['content-length'], String(Buffer.byteLength(success.body)))
	assert.equal(success.headers[SHARED_HOME_HEADER], undefined)

	const gzipped = await request({ 'accept-encoding': 'gzip, deflate, br' })
	assert.equal(gzipped.status, 200)
	assert.equal(gzipped.headers['content-encoding'], 'gzip')
	assert.equal(gzipped.headers['content-length'], String(gzipped.raw.length))
	assert.equal(zlib.gunzipSync(gzipped.raw).toString('utf8'), success.body)

	for (const failure of [
		{ body: '<html><body>Redirecting</body></html>', status: 307, cookie: false },
		{ body: document, status: 500, cookie: false },
		{ body: document, status: 200, cookie: true },
		{ body: document.replace('Guest', '<template data-dgst="failed"></template>'), status: 200, cookie: false },
		{ body: document.slice(0, -7), status: 200, cookie: false },
	]) {
		fixture = failure
		const result = await request()
		assert.equal(result.headers['cache-control'], PRIVATE)
		assert.equal(result.status, failure.status)
		if (failure.cookie) assert.equal(result.headers['set-cookie'][0], 'unexpected=value; HttpOnly')
	}
	fixture = { body: document, status: 200, cookie: false }
	for (const [headers, url] of [[{ cookie: 'guest=owned' }, '/'], [{ authorization: 'Bearer owned' }, '/'], [{ rsc: '1' }, '/'], [{}, '/?checkout=cancelled'], [{}, '/pricing']]) {
		const result = await request(headers, url)
		assert.equal(result.headers['cache-control'], PRIVATE)
		assert.equal(result.body, document)
	}
})
