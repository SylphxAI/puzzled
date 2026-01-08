import { type NextRequest, NextResponse } from 'next/server'
import { adminCheckResponse, checkAdminWithMfa } from '@/features/admin'

export const runtime = 'nodejs'

import { syncAllPlansToStripe } from '@/features/subscription/server'

// POST /api/admin/plans/sync
export async function POST(request: NextRequest) {
	const authResult = await checkAdminWithMfa(request)
	const errorResponse = adminCheckResponse(authResult)
	if (errorResponse) return errorResponse

	const results = await syncAllPlansToStripe()

	return NextResponse.json({
		success: true,
		synced: results.length,
		plans: results,
	})
}
