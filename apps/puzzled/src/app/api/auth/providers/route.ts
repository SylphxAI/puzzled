import { NextResponse } from 'next/server'
import { getEnabledOAuthProviders } from '@/lib/oauth-providers'

export const runtime = 'nodejs'

/**
 * Get enabled OAuth providers
 * Uses shared config - SSOT for provider configuration
 */
export async function GET() {
	return NextResponse.json(getEnabledOAuthProviders())
}
