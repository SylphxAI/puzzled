import { type NextRequest, NextResponse } from 'next/server'
import { adminCheckResponse, checkAdminWithMfa } from '@/features/admin'
import { adminModelCatalog, ai } from '@/features/puzzle-generator/server'

export const runtime = 'nodejs' // Required for auth
export const dynamic = 'force-dynamic' // Prevent static generation at build time

/**
 * GET /api/admin/models
 * Lists admitted Models catalog SKUs to choose `puzzle_generator_model`.
 * Requires admin authentication with MFA
 */
export async function GET(request: NextRequest) {
	// Require admin authentication with MFA
	const authResult = await checkAdminWithMfa(request)
	const errorResponse = adminCheckResponse(authResult)
	if (errorResponse) return errorResponse

	const { searchParams } = new URL(request.url)
	const search = searchParams.get('search')?.toLowerCase()

	try {
		// Models door `GET /models`: {object:"list", data:[row...]} with
		// display_name / context_window / USD-per-1M pricing.
		const response = await ai.listModels()

		let models = adminModelCatalog(response).filter((model) => {
			// Filter out deprecated or test models
			if (model.id.includes('test') || model.id.includes('deprecated')) {
				return false
			}
			return true
		})

		// Limit results for autocomplete
		if (search) {
			const needle = search
			models = models.filter(
				(model) =>
					model.id.toLowerCase().includes(needle) || model.name.toLowerCase().includes(needle),
			)
			models = models.slice(0, 20)
		}

		return NextResponse.json({
			models,
			count: models.length,
		})
	} catch (error) {
		console.error('[Models API] Error fetching models:', error)
		return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 })
	}
}
