/**
 * One-tap result-card share (S3 slice 2).
 *
 * Web Share with files when the platform supports it; otherwise the image is
 * downloaded and the caption copied, and when even that is impossible the
 * caller is told so honestly (never a silent no-op). The text share already
 * shipped (share-text.ts) stays the caption either way.
 *
 * Everything external is injected, so the whole decision table is unit-testable
 * without a DOM: the caller passes the real navigator/document in the browser
 * and the tests pass doubles.
 */
import {
	type ResultCardModel,
	type ResultCardStrings,
	resultCardTextAlternative,
} from './result-card'
import { resultCardBlob, resultCardFileName } from './result-card-render'

export type ShareResultCardOutcome =
	/** The platform share sheet accepted the image. */
	| 'shared'
	/** The user dismissed the share sheet; nothing else should happen. */
	| 'cancelled'
	/** Image downloaded (and the caption copied when the clipboard allowed it). */
	| 'downloaded'
	/** No image could be offered; the caption alone was copied. */
	| 'copied'
	/** Nothing worked - the surface should stay quiet rather than claim success. */
	| 'unavailable'

export interface ShareResultCardResult {
	outcome: ShareResultCardOutcome
	captionCopied: boolean
}

/** A File-shaped blob: what the share sheet needs for the filename. */
export type ShareResultCardFile = Blob & { name?: string }

export interface ShareResultCardDeps {
	/** Defaults to globalThis.navigator. Pass null to model a platform without one. */
	navigator?: Navigator | null
	/** Defaults to globalThis.document. Pass null to model a server render. */
	document?: Document | null
	createObjectURL?: (blob: Blob) => string
	revokeObjectURL?: (url: string) => void
	/** File construction seam (some runtimes lack File). */
	createFile?: (blob: Blob, fileName: string, type: string) => ShareResultCardFile
	/**
	 * Renderer seam. The default is the real canvas renderer; tests inject a
	 * stub so no canvas is needed.
	 */
	renderBlob?: (model: ResultCardModel, strings: ResultCardStrings) => Promise<Blob | null>
}

export interface ShareResultCardInput {
	/** The image to share; null when rendering failed. */
	blob: Blob | null
	fileName: string
	/** The caption - the existing text share, kept verbatim. */
	text: string
	title: string
	url?: string
}

export interface ShareRitualCardInput {
	model: ResultCardModel
	strings: ResultCardStrings
	/** Existing text share; when empty the card's own text alternative is used. */
	text?: string
	title: string
	url?: string
}

function resolveNavigator(deps: ShareResultCardDeps): Navigator | null {
	if (deps.navigator !== undefined) return deps.navigator
	return typeof globalThis.navigator === 'undefined' ? null : globalThis.navigator
}

function resolveDocument(deps: ShareResultCardDeps): Document | null {
	if (deps.document !== undefined) return deps.document
	return typeof globalThis.document === 'undefined' ? null : globalThis.document
}

function isAbort(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		(error as { name?: unknown }).name === 'AbortError'
	)
}

function defaultCreateFile(blob: Blob, fileName: string, type: string): ShareResultCardFile {
	if (typeof File === 'undefined') throw new Error('File is not available')
	return new File([blob], fileName, { type })
}

function canShareFiles(nav: Navigator, payload: ShareData): boolean {
	if (typeof nav.canShare !== 'function') return false
	try {
		return nav.canShare(payload)
	} catch {
		// Some engines throw on unknown members; treat that as "cannot share".
		return false
	}
}

function downloadBlob(
	blob: Blob,
	fileName: string,
	doc: Document,
	deps: ShareResultCardDeps,
): boolean {
	const create =
		deps.createObjectURL ??
		(typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
			? URL.createObjectURL.bind(URL)
			: null)
	if (!create) return false
	const revoke =
		deps.revokeObjectURL ??
		(typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function'
			? URL.revokeObjectURL.bind(URL)
			: null)
	let objectUrl: string | null = null
	try {
		objectUrl = create(blob)
		const anchor = doc.createElement('a')
		anchor.href = objectUrl
		anchor.download = fileName
		anchor.style.display = 'none'
		const body = doc.body
		if (body) {
			body.appendChild(anchor)
			anchor.click()
			body.removeChild(anchor)
		} else {
			anchor.click()
		}
		return true
	} catch {
		return false
	} finally {
		if (objectUrl && revoke) revoke(objectUrl)
	}
}

async function copyCaption(nav: Navigator | null, text: string): Promise<boolean> {
	const clipboard = nav?.clipboard
	if (!clipboard || typeof clipboard.writeText !== 'function' || text.length === 0) return false
	try {
		await clipboard.writeText(text)
		return true
	} catch {
		return false
	}
}

/**
 * Share one prepared card. Pure decision table; every effect goes through the
 * injected navigator/document.
 */
export async function shareResultCard(
	input: ShareResultCardInput,
	deps: ShareResultCardDeps = {},
): Promise<ShareResultCardResult> {
	const nav = resolveNavigator(deps)
	const doc = resolveDocument(deps)

	if (input.blob && nav && typeof nav.share === 'function') {
		let file: ShareResultCardFile | null = null
		try {
			file = (deps.createFile ?? defaultCreateFile)(input.blob, input.fileName, 'image/png')
		} catch {
			file = null
		}
		if (file) {
			const payload: ShareData = {
				files: [file] as unknown as File[],
				text: input.text,
				title: input.title,
			}
			if (input.url) payload.url = input.url
			if (canShareFiles(nav, payload)) {
				try {
					await nav.share(payload)
					return { outcome: 'shared', captionCopied: false }
				} catch (error) {
					if (isAbort(error)) return { outcome: 'cancelled', captionCopied: false }
					// Anything else (NotAllowedError, data too large...) falls through.
				}
			}
		}
	}

	let downloaded = false
	if (input.blob && doc && typeof doc.createElement === 'function') {
		downloaded = downloadBlob(input.blob, input.fileName, doc, deps)
	}
	const copied = await copyCaption(nav, input.text)
	if (downloaded) return { outcome: 'downloaded', captionCopied: copied }
	if (copied) return { outcome: 'copied', captionCopied: true }
	return { outcome: 'unavailable', captionCopied: false }
}

/**
 * Render-then-share for one ritual result: the surface calls this once per tap.
 * The caption defaults to the card's own text alternative, so the accessible
 * sentence and the shared sentence are the same content.
 */
export async function shareRitualResultCard(
	input: ShareRitualCardInput,
	deps: ShareResultCardDeps = {},
): Promise<ShareResultCardResult> {
	const render = deps.renderBlob ?? resultCardBlob
	let blob: Blob | null = null
	try {
		blob = await render(input.model, input.strings)
	} catch {
		blob = null
	}
	const caption =
		input.text && input.text.trim().length > 0
			? input.text
			: resultCardTextAlternative(input.model, input.strings)
	return await shareResultCard(
		{
			blob,
			fileName: resultCardFileName(input.model),
			text: caption,
			title: input.title,
			url: input.url,
		},
		deps,
	)
}
