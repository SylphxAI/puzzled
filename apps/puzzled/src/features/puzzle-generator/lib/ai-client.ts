/**
 * AI client for puzzle generation.
 *
 * Speaks the Models product's official Responses document through
 * `@/lib/identity/ai` (dest peel origin + product credential). That wire is
 * the only public conversation surface on the Models door:
 * `POST /v1/responses` with `{model, input, instructions, max_output_tokens,
 * temperature}` and a `{output[], usage}` reply. `POST /chat/completions` is
 * retired (`chat_completions_retired`) and must not be reintroduced.
 *
 * Model ids are Models catalog ids in `provider/model` form
 * (e.g. `openai/gpt-5.5`, `x-ai/grok-4.1-fast`); the model is configured in
 * app settings (`puzzle_generator_model`) with no silent fallback.
 */
import { getAI } from '@/lib/identity/ai'

/**
 * AI client singleton for server-side usage.
 * Uses AI_API_KEY / AI_API_ORIGIN from environment.
 *
 * LAZY INITIALIZATION: Client is created on first access to avoid
 * validation errors during build-time static page generation.
 */
let _aiClient: ReturnType<typeof getAI> | null = null

export function getAIClient() {
	if (!_aiClient) {
		_aiClient = getAI()
	}
	return _aiClient
}

// Getters defer client initialization until a method is actually accessed.
export const ai = {
	get createResponse() {
		return getAIClient().createResponse
	},
	get listModels() {
		return getAIClient().listModels
	},
}
