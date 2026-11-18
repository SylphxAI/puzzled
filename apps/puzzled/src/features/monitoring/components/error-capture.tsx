'use client'

/**
 * Installs browser error capture at first paint: uncaught errors and unhandled
 * rejections go to this app's relay (`/api/observability/errors`) and on to
 * Sylphx Observability. It loads no third-party script and holds no key.
 */

import { useEffect } from 'react'
import { installBrowserErrorCapture } from '@/lib/observability/browser'

export function ErrorCapture() {
	useEffect(() => installBrowserErrorCapture(), [])
	return null
}
