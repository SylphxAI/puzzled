'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')
const { publishAssets, retainedAssets, staticFiles, RECEIPT } = require('../public-assets.cjs')

const prefix = 'https://data.example/v1/public/objects/env_production/web-static'
function fixture(t, assetPrefix = prefix) {
	const nextDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puzzled-assets-'))
	t.after(() => fs.rmSync(nextDir, { recursive: true, force: true }))
	fs.mkdirSync(path.join(nextDir, 'static/chunks'), { recursive: true })
	fs.writeFileSync(path.join(nextDir, 'static/chunks/main.js'), 'console.log("public")')
	fs.writeFileSync(path.join(nextDir, 'static/chunks/lazy.js'), 'export default "lazy"')
	fs.writeFileSync(path.join(nextDir, 'static/chunks/style.css'), 'body{color:blue}')
	fs.writeFileSync(path.join(nextDir, 'required-server-files.json'), JSON.stringify({ config: { assetPrefix } }))
	const store = new Map()
	const calls = []
	const request = async (url, init = {}) => {
		calls.push({ url, ...init })
		if (url.endsWith('/v1/whoami')) return Response.json({ env: 'orgs/org/projects/project/envs/env_production' })
		if (url.includes('/v1/public/objects/')) {
			assert.equal(init.headers, undefined, 'public read never sends the publisher key')
			const key = url.slice(prefix.length + 1)
			const stored = store.get(key)
			return stored?.object.visibility === 'public' ? new Response(Buffer.from(stored.body, 'base64'), { headers: { 'content-type': stored.object.contentType, 'access-control-allow-origin': '*' } }) : new Response(null, { status: 404 })
		}
		assert.equal(init.headers.authorization, 'Bearer synthetic-key')
		assert.ok(init.headers['sylphx-effect-id'], 'Data requires an effect id for reads too')
		if (url.endsWith('/v1/object-visibilities')) {
			const body = JSON.parse(init.body)
			const stored = store.get(body.key)
			assert.equal(body.expectedVersion, stored.object.version)
			stored.object.visibility = body.visibility
			return Response.json({ object: stored.object })
		}
		const key = url.split('/v1/objects/web-static/')[1]
		assert.ok(key)
		if (init.method === 'PUT') {
			const body = JSON.parse(init.body)
			const stored = { object: { contentType: body.contentType, version: 1, visibility: 'private' }, body: body.body }
			store.set(key, stored)
			return Response.json({ object: stored.object })
		}
		return store.has(key) ? Response.json(store.get(key)) : new Response(null, { status: 404 })
	}
	return { nextDir, store, calls, request, options: { nextDir, apiKey: 'synthetic-key', fetch: request } }
}

test('every browser byte is publicly verified; prior immutable bytes survive another build', async (t) => {
	const f = fixture(t)
	const receipt = await publishAssets(f.options)
	assert.equal(receipt.files.length, 3)
	assert.deepEqual(retainedAssets(f.nextDir), receipt)
	assert.equal(JSON.stringify(receipt).includes('synthetic-key'), false)
	const writes = f.calls.filter((c) => c.method).length
	await publishAssets(f.options)
	assert.equal(f.calls.filter((c) => c.method).length, writes, 'same hashes are never rewritten')
	const old = f.store.get('_next/static/chunks/lazy.js').body
	fs.rmSync(path.join(f.nextDir, 'static/chunks/lazy.js'))
	fs.writeFileSync(path.join(f.nextDir, 'static/chunks/new-lazy.js'), 'export default "new"')
	await publishAssets(f.options)
	assert.equal(f.store.get('_next/static/chunks/lazy.js').body, old)
	assert.equal(f.store.get('_next/static/chunks/lazy.js').object.visibility, 'public')
	assert.ok(f.store.has('_next/static/chunks/new-lazy.js'))
})

test('preview has no production prefix or credential and cannot admit shared HTML', async (t) => {
	const f = fixture(t, '')
	assert.equal(await publishAssets({ ...f.options, apiKey: undefined }), null)
	assert.equal(f.calls.length, 0)
	assert.equal(retainedAssets(f.nextDir), null)
	assert.ok(fs.existsSync(path.join(f.nextDir, RECEIPT)))
})

test('missing grant, wrong environment, private/corrupt public bytes and collisions fail the build', async (t) => {
	const f = fixture(t)
	await assert.rejects(publishAssets({ ...f.options, apiKey: undefined }), /secret_required/)
	await assert.rejects(publishAssets({ ...f.options, fetch: async () => Response.json({ env: 'env_preview' }) }), /environment_mismatch/)
	await assert.rejects(publishAssets({ ...f.options, fetch: (url, init) => url.includes('/v1/public/') ? Promise.resolve(new Response('corrupt', { headers: { 'content-type': 'application/javascript; charset=utf-8', 'access-control-allow-origin': '*' } })) : f.request(url, init) }), /readback_failed/)
	assert.equal(fs.existsSync(path.join(f.nextDir, RECEIPT)), false)
	await publishAssets(f.options)
	const original = f.store.get('_next/static/chunks/main.js').body
	fs.writeFileSync(path.join(f.nextDir, 'static/chunks/main.js'), 'different bytes at same immutable path')
	await assert.rejects(publishAssets(f.options), /immutable_collision/)
	assert.equal(f.store.get('_next/static/chunks/main.js').body, original)
	assert.equal(retainedAssets(f.nextDir), null)
})

test('receipt matches the complete current static population and refuses maps or changed bytes', async (t) => {
	const f = fixture(t)
	assert.equal(retainedAssets(f.nextDir), null)
	await publishAssets(f.options)
	fs.writeFileSync(path.join(f.nextDir, 'static/chunks/unpublished.js'), 'missing publication')
	assert.equal(retainedAssets(f.nextDir), null)
	fs.writeFileSync(path.join(f.nextDir, 'static/chunks/source.js.map'), 'private source')
	assert.throws(() => staticFiles(path.join(f.nextDir, 'static')), /source_map_refused/)
})

test('a complete root document without verified retention stays private at the HTTP boundary', async (t) => {
	const f = fixture(t, '')
	const http = require('node:http')
	const { installSharedHome, PRIVATE } = require('../shared-home-server.cjs')
	installSharedHome({ staticDir: path.join(f.nextDir, 'static') })
	const server = http.createServer((_req, res) => {
		res.setHeader('x-puzzled-shared-home', '1')
		res.setHeader('content-type', 'text/html')
		res.setHeader('content-security-policy', "script-src 'self' 'strict-dynamic'")
		res.end(`<html><script src="/_next/static/chunks/main.js"></script><main data-puzzled-shared-home-until="${Date.now() + 3600_000}">Guest</main></html>`)
	})
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
	try {
		const result = await fetch(`http://127.0.0.1:${server.address().port}/`)
		assert.equal(result.status, 200)
		assert.equal(result.headers.get('cache-control'), PRIVATE)
		assert.match(await result.text(), /integrity="sha256-/)
	} finally {
		await new Promise((resolve) => server.close(resolve))
	}
})
