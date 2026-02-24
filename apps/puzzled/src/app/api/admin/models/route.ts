import { type NextRequest, NextResponse } from 'next/server'
import { adminCheckResponse, checkAdminWithMfa } from '@/features/admin'
import { ai } from '@/features/puzzle-generator/server'

export const runtime = 'nodejs' // Required for auth
export const dynamic = 'force-dynamic' // Prevent static generation at build time

/**
 * GET /api/admin/models
 * Fetches available models from Platform SDK
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
		// Use SDK's listModels which goes through Platform
		const response = await ai.listModels({ search: search ?? undefined })

		// Filter and transform models
		let models = response.data
			.filter((model) => {
				// Filter out deprecated or test models
				if (model.id.includes('test') || model.id.includes('deprecated')) {
					return false
				}
				return true
			})
			.map((model) => ({
				id: model.id,
				name: model.name,
				contextLength: model.context_length,
				pricing: {
					prompt: Number.parseFloat(model.pricing.prompt) * 1000000, // Convert to per 1M tokens
					completion: Number.parseFloat(model.pricing.completion) * 1000000,
				},
				capabilities: model.capabilities,
			}))
			.sort((a, b) => {
				// Sort by provider (anthropic, openai, google first)
				const priorityProviders = ['anthropic', 'openai', 'google', 'meta-llama']
				const aProvider = a.id.split('/')[0]
				const bProvider = b.id.split('/')[0]
				const aPriority = priorityProviders.indexOf(aProvider)
				const bPriority = priorityProviders.indexOf(bProvider)

				if (aPriority !== -1 && bPriority !== -1) {
					return aPriority - bPriority
				}
				if (aPriority !== -1) return -1
				if (bPriority !== -1) return 1
				return a.name.localeCompare(b.name)
			})

		// Limit results for autocomplete
		if (search) {
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
