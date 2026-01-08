import { type NextRequest, NextResponse } from 'next/server'
import { adminCheckResponse, checkAdminWithMfa } from '@/features/admin'
import { OPENROUTER_API_URL } from '@/lib/config/app'

export const runtime = 'nodejs' // Required for auth
export const revalidate = 3600 // Cache for 1 hour

type OpenRouterModel = {
	id: string
	name: string
	description?: string
	context_length: number
	pricing: {
		prompt: string
		completion: string
	}
	top_provider?: {
		context_length?: number
		max_completion_tokens?: number
	}
}

type OpenRouterResponse = {
	data: OpenRouterModel[]
}

/**
 * GET /api/admin/models
 * Fetches available models from OpenRouter API
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
		const response = await fetch(`${OPENROUTER_API_URL}/models`, {
			headers: {
				'Content-Type': 'application/json',
			},
			next: { revalidate: 3600 }, // Cache for 1 hour
		})

		if (!response.ok) {
			throw new Error(`OpenRouter API error: ${response.status}`)
		}

		const data: OpenRouterResponse = await response.json()

		// Filter and transform models
		let models = data.data
			.filter((model) => {
				// Filter out deprecated or test models
				if (model.id.includes('test') || model.id.includes('deprecated')) {
					return false
				}
				// Apply search filter if provided
				if (search) {
					return (
						model.id.toLowerCase().includes(search) || model.name.toLowerCase().includes(search)
					)
				}
				return true
			})
			.map((model) => ({
				id: model.id,
				name: model.name,
				description: model.description,
				contextLength: model.context_length,
				pricing: {
					prompt: parseFloat(model.pricing.prompt) * 1000000, // Convert to per 1M tokens
					completion: parseFloat(model.pricing.completion) * 1000000,
				},
				maxCompletionTokens: model.top_provider?.max_completion_tokens,
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
			cached: true,
		})
	} catch (error) {
		console.error('[Models API] Error fetching models:', error)
		return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 })
	}
}
