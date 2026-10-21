import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { createRequire } from 'node:module'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { brotliCompressSync, brotliDecompressSync } from 'node:zlib'

const require = createRequire(import.meta.url)
const brotli = require('../../brotli.cjs') as {
	acceptsBrotli: (header: unknown) => boolean
	precompressedFile: (
		dirs: string[],
		url: string,
		exists?: (f: string) => boolean,
	) => { file: string; type: string } | null
	wrapListener: (l: http.RequestListener, dirs: string[]) => http.RequestListener
}

const HTML = `<!doctype html><html><body>${'<p>puzzle of the day</p>'.repeat(400)}</body></html>`
let root: string
let server: http.Server
let port: number

function get(path: string, acceptEncoding?: string, method = 'GET') {
	return new Promise<{ headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
		const req = http.request(
			{ port, path, method, headers: acceptEncoding ? { 'accept-encoding': acceptEncoding } : {} },
			(res) => {
				const chunks: Buffer[] = []
				res.on('data', (c: Buffer) => chunks.push(c))
				res.on('end', () => resolve({ headers: res.headers, body: Buffer.concat(chunks) }))
			},
		)
		req.on('error', reject)
		req.end()
	})
}

beforeAll(async () => {
	root = mkdtempSync(join(tmpdir(), 'brotli-'))
	mkdirSync(join(root, 'chunks'), { recursive: true })
	const js = 'console.log("hello puzzled")\n'.repeat(100)
	writeFileSync(join(root, 'chunks/a.js'), js)
	writeFileSync(join(root, 'chunks/a.js.br'), brotliCompressSync(Buffer.from(js)))
	server = http.createServer(
		brotli.wrapListener(
			(req, res) => {
				if (req.url === '/small') {
					res.setHeader('Content-Type', 'text/plain')
					res.end('tiny')
				} else if (req.url === '/stream') {
					res.setHeader('Content-Type', 'text/html; charset=utf-8')
					res.write(HTML.slice(0, 5000))
					setTimeout(() => res.end(HTML.slice(5000)), 5)
				} else if (req.url === '/image') {
					res.setHeader('Content-Type', 'image/png')
					res.end(Buffer.alloc(5000))
				} else {
					res.setHeader('Content-Type', 'text/html; charset=utf-8')
					res.setHeader('Content-Length', Buffer.byteLength(HTML))
					res.end(HTML)
				}
			},
			[root],
		),
	)
	await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
	port = (server.address() as AddressInfo).port
})

afterAll(() => {
	server.close()
	rmSync(root, { recursive: true, force: true })
})

describe('puzzled brotli', () => {
	test('acceptsBrotli reads the header', () => {
		expect(brotli.acceptsBrotli('gzip, deflate, br, zstd')).toBe(true)
		expect(brotli.acceptsBrotli('gzip')).toBe(false)
		expect(brotli.acceptsBrotli('br;q=0')).toBe(false)
		expect(brotli.acceptsBrotli(undefined)).toBe(false)
	})

	test('document is brotli for a br client and plain for others', async () => {
		const br = await get('/', 'gzip, deflate, br')
		expect(br.headers['content-encoding']).toBe('br')
		expect(br.headers.vary).toContain('Accept-Encoding')
		expect(brotliDecompressSync(br.body).toString()).toBe(HTML)
		const plain = await get('/', 'gzip')
		expect(plain.headers['content-encoding']).toBeUndefined()
		expect(plain.body.toString()).toBe(HTML)
	})

	test('streamed responses are compressed and complete', async () => {
		const br = await get('/stream', 'br')
		expect(br.headers['content-encoding']).toBe('br')
		expect(brotliDecompressSync(br.body).toString()).toBe(HTML)
	})

	test('small, non-text and HEAD responses are left alone', async () => {
		expect((await get('/small', 'br')).headers['content-encoding']).toBeUndefined()
		expect((await get('/image', 'br')).headers['content-encoding']).toBeUndefined()
		expect((await get('/', 'br', 'HEAD')).headers['content-encoding']).toBeUndefined()
	})

	test('static chunks come from the precompressed file', async () => {
		const res = await get('/_next/static/chunks/a.js', 'br')
		expect(res.headers['content-encoding']).toBe('br')
		expect(res.headers['content-type']).toContain('javascript')
		expect(res.headers['cache-control']).toContain('immutable')
		expect(brotliDecompressSync(res.body).toString()).toContain('hello puzzled')
	})

	test('static path traversal and missing files fall through', () => {
		const always = () => true
		expect(brotli.precompressedFile([root], '/_next/static/../secret.js', always)).toBeNull()
		expect(brotli.precompressedFile([root], '/_next/static/%2e%2e/x.js', always)).toBeNull()
		expect(brotli.precompressedFile([root], '/_next/static/chunks/missing.js')).toBeNull()
		expect(brotli.precompressedFile([root], '/other/a.js', always)).toBeNull()
	})
})
