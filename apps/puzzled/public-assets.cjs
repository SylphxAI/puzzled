'use strict'

const { createHash, randomUUID } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const RECEIPT = 'public-assets.json'
const MIME = { '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon' }
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')

function publicAssetLocation(prefix) {
	const url = new URL(prefix)
	const match = /^\/v1\/public\/objects\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)$/.exec(url.pathname)
	if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !match) throw new Error('invalid_public_asset_prefix')
	return { prefix: url.href, origin: url.origin, environment: match[1], bucket: match[2] }
}

function staticFiles(root) {
	const files = []
	function walk(dir, relative = '') {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const name = relative ? `${relative}/${entry.name}` : entry.name
			if (entry.isDirectory()) walk(path.join(dir, entry.name), name)
			else if (entry.isFile()) {
				if (name.endsWith('.map')) throw new Error('public_source_map_refused')
				const contentType = MIME[path.extname(name)]
				if (!contentType) throw new Error(`unknown_public_asset_type:${path.extname(name)}`)
				const bytes = fs.readFileSync(path.join(root, name))
				files.push({ path: name, sha256: digest(bytes), size: bytes.length, contentType })
			} else throw new Error('public_asset_symlink_refused')
		}
	}
	walk(root)
	if (!files.length) throw new Error('missing_public_assets')
	return files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
}

function retainedAssets(nextDir) {
	try {
		const receipt = JSON.parse(fs.readFileSync(path.join(nextDir, RECEIPT), 'utf8'))
		const config = JSON.parse(fs.readFileSync(path.join(nextDir, 'required-server-files.json'), 'utf8')).config
		publicAssetLocation(receipt.assetPrefix)
		if (receipt.schemaVersion !== 1 || !receipt.verifiedAt || receipt.assetPrefix !== config.assetPrefix) return null
		const actual = staticFiles(path.join(nextDir, 'static'))
		if (JSON.stringify(actual) !== JSON.stringify(receipt.files)) return null
		return receipt
	} catch {
		return null
	}
}

/** Publish only browser static bytes, with no credential in the receipt or image. */
async function publishAssets({ nextDir, apiKey, fetch: request = fetch, apiOrigin = 'https://api.sylphx.com', now = () => new Date() }) {
	const receiptFile = path.join(nextDir, RECEIPT)
	fs.rmSync(receiptFile, { force: true })
	const config = JSON.parse(fs.readFileSync(path.join(nextDir, 'required-server-files.json'), 'utf8')).config
	if (!config.assetPrefix) {
		// Keep Docker's copied metadata shape identical in private preview builds.
		fs.writeFileSync(receiptFile, JSON.stringify({ schemaVersion: 1, assetPrefix: '', files: [] }))
		return null
	}
	const location = publicAssetLocation(config.assetPrefix)
	if (!apiKey) throw new Error('public_asset_publisher_secret_required')
	async function json(url, init = {}) {
		const response = await request(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', 'sylphx-effect-id': `assets-read-${randomUUID()}`, ...init.headers } })
		if (response.status === 404 && !init.method) return null
		if (!response.ok) throw new Error(`public_asset_api_refused:${response.status}`)
		return response.json()
	}
	const me = await json(`${apiOrigin}/v1/whoami`)
	if (me.env?.split('/').pop() !== location.environment) throw new Error('public_asset_environment_mismatch')
	const files = staticFiles(path.join(nextDir, 'static'))
	for (const file of files) {
		const key = `_next/static/${file.path}`
		const escaped = key.split('/').map(encodeURIComponent).join('/')
		const url = `${location.origin}/v1/objects/${location.bucket}/${escaped}`
		const bytes = fs.readFileSync(path.join(nextDir, 'static', file.path))
		let stored = await json(url)
		if (stored) {
			if (digest(Buffer.from(stored.body, 'base64')) !== file.sha256 || stored.object?.contentType !== file.contentType) throw new Error('public_asset_immutable_collision')
		} else {
			stored = await json(url, { method: 'PUT', headers: { 'sylphx-effect-id': `assets-put-${digest(Buffer.from(key + file.sha256)).slice(0, 40)}` }, body: JSON.stringify({ body: bytes.toString('base64'), contentType: file.contentType }) })
		}
		if (stored.object?.visibility !== 'public') {
			await json(`${location.origin}/v1/object-visibilities`, { method: 'POST', headers: { 'sylphx-effect-id': `assets-public-${digest(Buffer.from(key + stored.object?.version)).slice(0, 40)}` }, body: JSON.stringify({ bucketId: location.bucket, key, visibility: 'public', expectedVersion: stored.object?.version }) })
		}
		// This read is anonymous: successful writes alone do not establish public custody.
		const publicResponse = await request(`${location.prefix}/${escaped}`, { redirect: 'error', signal: AbortSignal.timeout(60_000) })
		if (!publicResponse.ok || publicResponse.headers.get('set-cookie') || publicResponse.headers.get('access-control-allow-origin') !== '*' || publicResponse.headers.get('content-type') !== file.contentType || digest(Buffer.from(await publicResponse.arrayBuffer())) !== file.sha256) throw new Error('public_asset_readback_failed')
	}
	const receipt = { schemaVersion: 1, assetPrefix: location.prefix, verifiedAt: now().toISOString(), files }
	fs.writeFileSync(`${receiptFile}.tmp`, JSON.stringify(receipt))
	fs.renameSync(`${receiptFile}.tmp`, receiptFile)
	return receipt
}

if (require.main === module) {
	const secretFile = process.argv[2] ?? '/run/secrets/public_assets'
	const apiKey = fs.existsSync(secretFile) ? fs.readFileSync(secretFile, 'utf8').trim() : undefined
	publishAssets({ nextDir: path.join(__dirname, '.next'), apiKey }).then((receipt) => {
		console.log(`[puzzled-web] public assets: ${receipt ? `${receipt.files.length} verified` : 'private build'}`)
	}).catch((error) => { console.error(`[puzzled-web] ${error.message}`); process.exitCode = 1 })
}

module.exports = { publicAssetLocation, staticFiles, retainedAssets, publishAssets, RECEIPT }
