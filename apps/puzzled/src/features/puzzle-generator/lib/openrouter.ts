import { createOpenRouter } from '@openrouter/ai-sdk-provider'

/**
 * OpenRouter client using official AI SDK provider
 * @see https://github.com/OpenRouterTeam/ai-sdk-provider
 *
 * Models are now configured dynamically via admin settings.
 * Use /api/admin/models to get available models.
 */
export const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})
