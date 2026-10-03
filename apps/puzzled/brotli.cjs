'use strict'

/**
 * Brotli for puzzled web (W-10074).
 *
 * Next's own compression is off (next.config.ts `compress: false`) because it
 * only knows gzip, and the edge passes the origin's encoding through. This
 * module installs, before Next's server starts:
 *  - /_next/static/* answered from the `.br` file written at build time
 *    (scripts/precompress-static.mjs, quality 11) when the client accepts br;
 *  - every other text response compressed with brotli at quality 5 (the
 *    streaming-friendly point: the home document 244 KB -> ~34 KB), flushed
 *    with the response so streamed HTML keeps streaming.
 * Clients without br get the plain response, as before.
 */

const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const zlib = require('node:zlib')

const DYNAMIC_QUALITY = 5
const MIN_BYTES = 1024
const COMPRESSIBLE =
	/^(text\/|application\/(json|javascript|xml|manifest\+json|ld\+json|rss\+xml|atom\+xml)|image\/svg\+xml)/i
const STATIC_PREFIX = '/_next/static/'
const TYPES = {
	'.js': 'application/javascript; charset=UTF-8',
	'.css': 'text/css; charset=UTF-8',
	'.json': 'application/json',
	'.svg': 'image/svg+xml',
	'.txt': 'text/plain; charset=UTF-8',
	'.html': 'text/html; charset=UTF-8',
}

function acceptsBrotli(header) {
	if (typeof header !== 'string') return false
	return header.split(',').some((part) => {
		const [coding, ...params] = part.trim().toLowerCase().split(';')
		if (coding !== 'br') return false
		const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
		return q === undefined || Number.parseFloat(q.slice(2)) > 0
	})
}

/** The `.br` file for a /_next/static URL, or null (unsafe path, no file). */
function precompressedFile(staticDirs, url, exists = fs.existsSync) {
	const pathname = url.split('?')[0]
	if (!pathname.startsWith(STATIC_PREFIX)) return null
	let rel
	try {
		rel = decodeURIComponent(pathname.slice(STATIC_PREFIX.length))
	} catch {
		return null
	}
	if (!rel || rel.includes('\0') || rel.split('/').some((s) => s === '..' || s === '')) return null
	const type = TYPES[path.extname(rel).toLowerCase()]
	if (!type) return null
	for (const dir of staticDirs) {
		const file = path.join(dir, `${rel}.br`)
		if (file.startsWith(dir + path.sep) && exists(file)) return { file, type }
	}
	return null
}

function serveStatic(req, res, found) {
	const stat = fs.statSync(found.file)
	res.writeHead(200, {
		'Content-Type': found.type,
		'Content-Encoding': 'br',
		'Content-Length': stat.size,
		Vary: 'Accept-Encoding',
		'Cache-Control': 'public, max-age=31536000, immutable',
		'X-Content-Type-Options': 'nosniff',
	})
	if (req.method === 'HEAD') return res.end()
	fs.createReadStream(found.file).pipe(res)
}

function addVary(res) {
	const current = res.getHeader('Vary')
	const has = String(current ?? '')
		.toLowerCase()
		.includes('accept-encoding')
	if (!has) res.setHeader('Vary', current ? `${current}, Accept-Encoding` : 'Accept-Encoding')
}

/** Compress this response in place when its headers say it is worth it. */
function compressResponse(req, res) {
	const origWriteHead = res.writeHead
	const origWrite = res.write
	const origEnd = res.end
	let br = null

	function start() {
		if (br !== null || res.headersSent) return
		const type = String(res.getHeader('Content-Type') ?? '')
		const length = Number(res.getHeader('Content-Length') ?? Number.POSITIVE_INFINITY)
		const eligible =
			req.method !== 'HEAD' &&
			res.statusCode !== 204 &&
			res.statusCode !== 304 &&
			!res.getHeader('Content-Encoding') &&
			COMPRESSIBLE.test(type) &&
			!/no-transform/i.test(String(res.getHeader('Cache-Control') ?? '')) &&
			length >= MIN_BYTES
		if (!eligible) {
			br = false
			return
		}
		addVary(res)
		res.setHeader('Content-Encoding', 'br')
		res.removeHeader('Content-Length')
		br = zlib.createBrotliCompress({
			params: {
				[zlib.constants.BROTLI_PARAM_QUALITY]: DYNAMIC_QUALITY,
				[zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
			},
		})
		br.on('data', (chunk) => {
			if (origWrite.call(res, chunk) === false) {
				br.pause()
				res.once('drain', () => br.resume())
			}
		})
		br.on('end', () => origEnd.call(res))
		res.flush = () => br.flush()
	}

	res.writeHead = function (...args) {
		start()
		return origWriteHead.apply(this, args)
	}
	res.write = function (chunk, encoding, cb) {
		start()
		if (!br) return origWrite.call(this, chunk, encoding, cb)
		return br.write(chunk, typeof encoding === 'string' ? encoding : undefined, cb)
	}
	res.end = function (chunk, encoding, cb) {
		// A whole small body in one end() call: not worth compressing.
		if (br === null && chunk != null && typeof chunk !== 'function' && Buffer.byteLength(chunk) < MIN_BYTES) br = false
		start()
		if (!br) return origEnd.call(this, chunk, encoding, cb)
		if (typeof chunk === 'function') {
			cb = chunk
			chunk = undefined
		}
		if (cb) res.once('finish', cb)
		if (chunk != null) br.end(chunk, typeof encoding === 'string' ? encoding : undefined)
		else br.end()
		return this
	}
}

function wrapListener(listener, staticDirs) {
	return function (req, res) {
		if ((req.method === 'GET' || req.method === 'HEAD') && acceptsBrotli(req.headers['accept-encoding'])) {
			const found = precompressedFile(staticDirs, req.url ?? '')
			if (found) return serveStatic(req, res, found)
			compressResponse(req, res)
		}
		return listener.call(this, req, res)
	}
}

/** Patch http.createServer so the Next standalone server gets brotli. */
function install(rootDir) {
	const staticDirs = [
		path.join(rootDir, 'apps/puzzled/.next/static'),
		path.join(rootDir, '.next/static'),
	]
	const original = http.createServer
	http.createServer = function (...args) {
		const i = args.findIndex((a) => typeof a === 'function')
		if (i >= 0) args[i] = wrapListener(args[i], staticDirs)
		return original.apply(this, args)
	}
}

module.exports = { acceptsBrotli, precompressedFile, install, wrapListener }
