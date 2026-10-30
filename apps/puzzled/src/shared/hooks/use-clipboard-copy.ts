'use client'

import { type RefObject, useRef, useState } from 'react'

export function selectCopyText(element: HTMLElement | null) {
	if (!element) return
	element.focus()
	if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
		element.select()
		return
	}
	const range = document.createRange()
	range.selectNodeContents(element)
	const selection = window.getSelection()
	selection?.removeAllRanges()
	selection?.addRange(range)
}

/** A success belongs to the text actually written, never an earlier copy attempt. */
export function useClipboardCopy(text: string, target: RefObject<HTMLElement | null>) {
	const [result, setResult] = useState<{
		text: string
		status: 'pending' | 'copied' | 'failed'
	} | null>(null)
	const latestText = useRef(text)
	latestText.current = text
	const request = useRef(0)
	const status = result?.text === text ? result.status : 'idle'

	async function copy() {
		const attempt = ++request.current
		setResult({ text, status: 'pending' })
		try {
			await navigator.clipboard.writeText(text)
			if (attempt === request.current) setResult({ text, status: 'copied' })
		} catch {
			if (attempt !== request.current || latestText.current !== text) return
			setResult({ text, status: 'failed' })
			selectCopyText(target.current)
		}
	}

	return { status, copy }
}
