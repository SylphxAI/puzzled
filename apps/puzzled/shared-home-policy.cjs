'use strict'

const SHARED_HOME_HEADER = 'x-puzzled-shared-home'

/** Only a full, anonymous document has one representation at the public root. */
function isSharedHomeRequest(method, rawUrl, headers) {
	if (method !== 'GET') return false
	const url = new URL(rawUrl, 'http://puzzled.invalid')
	if (url.pathname !== '/' || url.search) return false
	const names = new Set(Object.keys(headers).map((name) => name.toLowerCase()))
	return ![
		'cookie',
		'authorization',
		'rsc',
		'next-router-state-tree',
		'next-router-prefetch',
		'next-router-segment-prefetch',
		'next-url',
		'next-action',
	].some((name) => names.has(name))
}

module.exports = { isSharedHomeRequest, SHARED_HOME_HEADER }
