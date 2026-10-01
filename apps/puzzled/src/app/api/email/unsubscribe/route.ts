import { Code, ConnectError } from '@connectrpc/connect'
import { NextResponse } from 'next/server'
import { createPreferencesServiceClient } from '@/lib/connect/preferences-client'
import { resolveServerConnectBaseUrl } from '@/lib/connect/transport'
import { correlationIdFrom, logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function invalidToken(error: unknown): boolean {
	return error instanceof ConnectError && error.code === Code.InvalidArgument
}

async function unsubscribe(token: string): Promise<void> {
	// Rust verifies the signed link and is the only notification-consent writer.
	await createPreferencesServiceClient(resolveServerConnectBaseUrl()).unsubscribeEmail({ token })
}

/** JSON app requests and RFC 8058 List-Unsubscribe-Post form requests. */
export async function POST(request: Request) {
	let token: unknown
	try {
		const contentType = request.headers.get('content-type') ?? ''
		if (
			contentType.startsWith('application/x-www-form-urlencoded') ||
			contentType.startsWith('multipart/form-data')
		) {
			const form = await request.formData()
			if (form.get('List-Unsubscribe') !== 'One-Click') {
				return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
			}
			token = new URL(request.url).searchParams.get('token')
		} else {
			token = (await request.json()).token
		}
	} catch {
		return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
	}
	if (typeof token !== 'string' || !token) {
		return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
	}
	try {
		await unsubscribe(token)
		logger.info('unsubscribe.unsubscribed', {
			source: 'link',
			correlationId: correlationIdFrom(request.headers),
		})
		return NextResponse.json({
			success: true,
			message: 'Successfully unsubscribed from marketing emails',
		})
	} catch (error) {
		if (invalidToken(error)) {
			return NextResponse.json({ error: 'Invalid or expired unsubscribe link' }, { status: 400 })
		}
		logger.error('unsubscribe.failed', {
			source: 'link',
			error,
			correlationId: correlationIdFrom(request.headers),
		})
		return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 })
	}
}

/** Browser email links retain their success/error landing page. */
export async function GET(request: Request) {
	const token = new URL(request.url).searchParams.get('token')
	if (!token) {
		return NextResponse.redirect(new URL('/unsubscribe?error=missing_token', request.url))
	}
	try {
		await unsubscribe(token)
		return NextResponse.redirect(new URL('/unsubscribe?success=true', request.url))
	} catch (error) {
		if (invalidToken(error)) {
			return NextResponse.redirect(new URL('/unsubscribe?error=invalid_token', request.url))
		}
		logger.error('unsubscribe.failed', {
			source: 'link',
			error,
			correlationId: correlationIdFrom(request.headers),
		})
		return NextResponse.redirect(new URL('/unsubscribe?error=failed', request.url))
	}
}
