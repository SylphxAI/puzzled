import type { NextRequest } from 'next/server'

// Node.js runtime - better-auth needs Node.js for password hashing
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handler(request: NextRequest) {
	const { auth } = await import('@/features/auth/server')
	const { toNextJsHandler } = await import('better-auth/next-js')
	const { GET, POST } = toNextJsHandler(auth)

	if (request.method === 'GET') {
		return GET(request)
	}
	return POST(request)
}

export { handler as GET, handler as POST }
