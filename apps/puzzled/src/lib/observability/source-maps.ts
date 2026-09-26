/**
 * Uploads this release's browser source maps to Sylphx Observability, so
 * minified browser stack frames resolve to source at ingest.
 *
 * It runs once when the server starts (from `register()` in
 * instrumentation.ts), because the platform build has no environment
 * (SylphxAI/cloud#9247): the release sha (`SYLPHX_GIT_COMMIT_SHA`) and the
 * key exist only at run time. Maps already stored for this release are
 * skipped, so a restart uploads nothing new. The maps ship in the image
 * outside the served static directory (see the Dockerfile), so the public
 * site never serves source.
 *
 * `@sylphx/sdk` 0.31.0 predates `observability.sourceMaps`, so this calls the
 * same contract methods through the SDK client's `call`; switch to
 * `sx.observability.sourceMaps.list/create` when the SDK publishes them.
 */

import { readdir, readFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { Sylphx } from '@sylphx/sdk'
import { PARENT } from './capture'

type Env = Record<string, string | undefined>
type Client = Pick<Sylphx, 'call'>

/** Where the Dockerfile puts the maps, relative to the server's working directory. */
export const SOURCE_MAP_DIR = '.next/source-maps'
/** The URL path the maps' files are served under. */
export const STATIC_PREFIX = '/_next/static'

async function mapFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true, recursive: true }).catch(() => [])
	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('.js.map'))
		.map((entry) => join(entry.parentPath, entry.name))
}

/** `/_next/static/chunks/app/page-3f2a.js` for `<dir>/chunks/app/page-3f2a.js.map`. */
export function fileUrlFor(dir: string, file: string): string {
	return `${STATIC_PREFIX}/${relative(dir, file)
		.split(sep)
		.join('/')
		.replace(/\.map$/, '')}`
}

async function uploaded(client: Client, release: string): Promise<Set<string>> {
	const seen = new Set<string>()
	let pageToken: string | undefined
	do {
		// SDK 0.31.0 has no registry entry for this type, so the wire's snake_case comes back as is.
		const page = await client.call<{
			sourceMaps?: { fileUrl?: string }[]
			source_maps?: { file_url?: string }[]
			nextPageToken?: string
			next_page_token?: string
		}>({
			method: 'GET',
			path: `/v1/${PARENT}/source_maps`,
			query: { page_size: 100, page_token: pageToken, filter: `release = "${release}"` },
			responseType: 'sylphx.observability.v1.ListSourceMapsResponse',
			mutation: false,
		})
		for (const map of page.sourceMaps ?? []) if (map.fileUrl) seen.add(map.fileUrl)
		for (const map of page.source_maps ?? []) if (map.file_url) seen.add(map.file_url)
		pageToken = page.nextPageToken || page.next_page_token || undefined
	} while (pageToken)
	return seen
}

/** Uploads missing maps for this release. Never throws; resolves to the number uploaded. */
export async function uploadSourceMaps(
	options: { dir?: string; env?: Env; client?: Client } = {},
): Promise<number> {
	const env = options.env ?? process.env
	const release = env.SYLPHX_GIT_COMMIT_SHA?.trim()
	const dir = options.dir ?? SOURCE_MAP_DIR
	if (!release || (!options.client && !env.SYLPHX_API_KEY?.trim())) return 0
	try {
		const files = await mapFiles(dir)
		if (files.length === 0) return 0
		const client = options.client ?? new Sylphx({ apiKey: env.SYLPHX_API_KEY, timeoutMs: 30_000 })
		const done = await uploaded(client, release)
		let count = 0
		for (const file of files) {
			const fileUrl = fileUrlFor(dir, file)
			if (done.has(fileUrl)) continue
			await client.call({
				method: 'POST',
				path: `/v1/${PARENT}/source_maps`,
				body: { release, fileUrl, content: await readFile(file, 'utf8') },
				bodyType: 'sylphx.observability.v1.SourceMap',
				responseType: 'sylphx.observability.v1.SourceMap',
				mutation: true,
			})
			count += 1
		}
		console.info(`[observability] uploaded ${count} source maps for ${release}`)
		return count
	} catch (error) {
		console.error('[observability] source map upload failed:', error)
		return 0
	}
}
