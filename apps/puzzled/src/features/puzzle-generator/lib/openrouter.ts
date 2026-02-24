/**
 * AI Client for Puzzle Generation
 *
 * Uses Sylphx Platform SDK's AI client which routes through Platform's AI proxy.
 * This provides:
 * - Unified billing and cost tracking
 * - Rate limiting and quota management
 * - Access to all models (OpenRouter, OpenAI, Anthropic, etc.)
 *
 * Model names use OpenRouter format: "provider/model"
 * e.g., "anthropic/claude-sonnet-4", "openai/gpt-4o"
 */
import { getAI } from '@sylphx/sdk/server'

/**
 * AI client singleton for server-side usage
 * Uses SYLPHX_SECRET_KEY from environment
 *
 * LAZY INITIALIZATION: Client is created on first access to avoid
 * validation errors during build-time static page generation.
 */
let _aiClient: ReturnType<typeof getAI> | null = null

/**
 * Get the AI client (lazy-initialized)
 * Creates the client on first call to defer secret key validation.
 */
export function getAIClient() {
	if (!_aiClient) {
		_aiClient = getAI()
	}
	return _aiClient
}

// Backwards-compatible export (use getAIClient() for new code)
// Getters defer client initialization until method is actually accessed
export const ai = {
	get chat() {
		return getAIClient().chat
	},
	get listModels() {
		return getAIClient().listModels
	},
}
