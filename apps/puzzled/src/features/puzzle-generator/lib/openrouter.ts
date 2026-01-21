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
 */
export const ai = getAI()
