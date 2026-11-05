'use strict'

const { createHash } = require('node:crypto')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const zlib = require('node:zlib')
const { isSharedHomeRequest, SHARED_HOME_HEADER } = require('./shared-home-policy.cjs')
const { retainedAssets } = require('./public-assets.cjs')

const PRIVATE = 'private, no-cache, no-store, max-age=0, must-revalidate'
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi
const INSTALL = Symbol.for('puzzled.shared-home-server')

function sha256(bytes) {
	return `sha256-${createHash('sha256').update(bytes).digest('base64')}`
}

/** Hash complete HTML, including Flight payloads; no response nonce is reused. */
function secureDocument(html, staticDir, digestCache = new Map(), assetPrefix = '') {
	const hashes = new Set()
	function scriptDigest(source) {
		const prefix = `${assetPrefix}/_next/static/`
		if (!source.startsWith(prefix) || /[?#]/.test(source)) {
			throw new Error('unexpected_shared_script_source')
		}
		const file = path.resolve(staticDir, decodeURIComponent(source.slice(prefix.length)))
		if (!file.startsWith(`${path.resolve(staticDir)}${path.sep}`)) {
			throw new Error('unexpected_shared_script_path')
		}
		let digest = digestCache.get(file)
		if (!digest) {
			digest = sha256(fs.readFileSync(file))
			digestCache.set(file, digest)
		}
		hashes.add(digest)
		return digest
	}
	let body = html.replace(SCRIPT, (tag, attributes, content) => {
		if (/\bnonce\s*=/i.test(attributes)) throw new Error('unexpected_shared_nonce')
		const source = /\bsrc\s*=\s*"([^"]+)"/i.exec(attributes)?.[1]
		if (!source) {
			if (/\bsrc\s*=/i.test(attributes)) throw new Error('unexpected_shared_script_attribute')
			hashes.add(sha256(content))
			return tag
		}
		const digest = scriptDigest(source)
		const clean = attributes.replace(/\s+(?:integrity|crossorigin)\s*=\s*"[^"]*"/gi, '')
		return `<script${clean} integrity="${digest}" crossorigin="anonymous">${content}</script>`
	})
	// Chromium applies script-src to parser-created preload requests too. The
	// matching script's integrity does not authorize a preceding unhashed preload.
	body = body.replace(/<link\b([^>]*)>/gi, (tag, attributes) => {
		if (!(/\brel="modulepreload"/i.test(attributes) || (/\brel="preload"/i.test(attributes) && /\bas="script"/i.test(attributes)))) return tag
		const source = /\bhref="([^"]+)"/i.exec(attributes)?.[1]
		if (!source) throw new Error('unexpected_shared_preload_attribute')
		const digest = scriptDigest(source)
		const clean = attributes.replace(/\s+(?:integrity|crossorigin)\s*=\s*"[^"]*"/gi, '').replace(/\/\s*$/, '')
		return `<link${clean} integrity="${digest}" crossorigin="anonymous">`
	})
	if (!hashes.size) throw new Error('missing_shared_scripts')
	return { body, scriptSources: [...hashes].map((digest) => `'${digest}'`).join(' ') }
}

function sharedCacheControl(html, now) {
	const until = Number(/\bdata-puzzled-shared-home-until="(\d+)"/.exec(html)?.[1])
	const remaining = Math.floor((until - now) / 1000)
	if (!Number.isFinite(remaining) || remaining < 1 || !/<\/html>\s*$/i.test(html)) return PRIVATE
	// React's streamed error boundary or Flight error record: a shell is not a successful page.
	if (/<template\b[^>]*\bdata-dgst=|\$RX\(|(?:\\n|\n)[\da-f]+:E\{/i.test(html)) return PRIVATE
	const fresh = Math.min(60, remaining)
	const stale = Math.min(3600, remaining - fresh)
	return `public, max-age=${fresh}, stale-while-revalidate=${stale}, stale-if-error=0`
}

/**
 * Finish only the shared root before sending headers. Other responses keep Next's
 * streaming, redirects, cookies and nonce policy. A partial/error render is private.
 */
function captureSharedHome(req, res, { staticDir, digestCache, now, retention, assetPrefix }) {
	// Hash uncompressed UTF-8; re-compress with gzip when the client accepts it.
	const clientAcceptEncoding = String(req.headers['accept-encoding'] ?? '')
	const acceptsGzip = /\bgzip\b/i.test(clientAcceptEncoding)
	req.headers['accept-encoding'] = 'identity'
	const original = {
		writeHead: res.writeHead,
		write: res.write,
		end: res.end,
		flushHeaders: res.flushHeaders,
	}
	const chunks = []
	res.writeHead = function (status, reason, headers) {
		this.statusCode = status
		if (typeof reason === 'string') this.statusMessage = reason
		const values = typeof reason === 'object' ? reason : headers
		if (Array.isArray(values)) {
			for (let i = 0; i < values.length; i += 2) this.appendHeader(values[i], values[i + 1])
		} else if (values) {
			for (const [name, value] of Object.entries(values)) this.setHeader(name, value)
		}
		return this
	}
	res.flushHeaders = () => {}
	res.write = function (chunk, encoding, callback) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding : undefined))
		const done = typeof encoding === 'function' ? encoding : callback
		if (done) queueMicrotask(done)
		return true
	}
	res.end = function (chunk, encoding, callback) {
		const done = typeof chunk === 'function' ? chunk : typeof encoding === 'function' ? encoding : callback
		if (chunk != null && typeof chunk !== 'function') this.write(chunk, encoding)
		Object.assign(this, original)
		let body = Buffer.concat(chunks)
		const profile = this.getHeader(SHARED_HOME_HEADER) === '1'
		this.removeHeader(SHARED_HOME_HEADER)
		if (profile && !(this.statusCode >= 300 && this.statusCode < 400) && String(this.getHeader('content-type')).startsWith('text/html')) {
			try {
				const html = body.toString('utf8')
				const secured = secureDocument(html, staticDir, digestCache, assetPrefix)
				const policy = String(this.getHeader('content-security-policy'))
				if (!/\bscript-src [^;]+/.test(policy)) throw new Error('missing_shared_csp')
				this.setHeader('Content-Security-Policy', policy.replace(/\bscript-src [^;]+/, `script-src 'self' 'strict-dynamic' ${secured.scriptSources}`))
				this.setHeader('Cache-Control', retention && this.statusCode === 200 && !this.hasHeader('set-cookie') ? sharedCacheControl(html, now()) : PRIVATE)
				// Browsers and CDNs must distinguish encoding as well as signed-in/guest traffic.
				this.setHeader('Vary', [...new Set(`${this.getHeader('vary') ?? ''}, Accept-Encoding, Cookie, Authorization`.split(',').map((v) => v.trim()).filter(Boolean))].join(', '))
				this.removeHeader('etag')
				body = Buffer.from(secured.body)
				if (acceptsGzip) {
					body = zlib.gzipSync(body)
					this.setHeader('Content-Encoding', 'gzip')
				} else {
					this.removeHeader('Content-Encoding')
				}
			} catch (error) {
				console.error('[puzzled-web] shared home refused:', error.message)
				this.statusCode = 503
				this.removeHeader('Content-Encoding')
				this.setHeader('Cache-Control', PRIVATE)
				this.setHeader('Content-Type', 'text/plain; charset=utf-8')
				body = Buffer.from('This page is temporarily unavailable. Please reload.')
			}
		} else {
			this.setHeader('Cache-Control', PRIVATE)
		}
		this.setHeader('Content-Length', body.length)
		return original.end.call(this, body, done)
	}
}

function installSharedHome({ staticDir = path.join(__dirname, '.next/static'), now = Date.now, retention = retainedAssets(path.dirname(staticDir)), assetPrefix = retention?.assetPrefix ?? '' } = {}) {
	if (http.Server.prototype[INSTALL]) return
	http.Server.prototype[INSTALL] = true
	const emit = http.Server.prototype.emit
	const digestCache = new Map()
	http.Server.prototype.emit = function (event, req, res, ...rest) {
		if (event === 'request' && isSharedHomeRequest(req.method, req.url, req.headers)) {
			captureSharedHome(req, res, { staticDir, digestCache, now, retention, assetPrefix })
		}
		return emit.call(this, event, req, res, ...rest)
	}
}

module.exports = { installSharedHome, secureDocument, sharedCacheControl, PRIVATE }
