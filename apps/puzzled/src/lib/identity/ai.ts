import { destAiCredential } from './credentials'
import { DEST_PEELS, destJson, destPeelOrigin } from './dest'

/**
 * Models door AI client — official OpenAI Responses document.
 *
 * `POST {origin}/responses` is the only public conversation wire on the
 * Models product; `POST /chat/completions` is retired
 * (`chat_completions_retired`). Request and response shapes follow the
 * published product contract (`SylphxAI/models`
 * `contract/ai.product.openapi.json`; wire law in `docs/protocol.md` §4):
 *
 *   request  { model, input, instructions?, max_output_tokens?, temperature? }
 *   response { model, output[].content[] { type: "output_text", text }, usage }
 *
 * Equivalences used by this repo: a chat `system` message becomes
 * `instructions`; chat `messages` become `input`; chat `max_tokens` becomes
 * `max_output_tokens`. `GET /models` lists the admitted catalog.
 */

export type AIInputTextPart = { type: 'input_text'; text: string }

export type AIInputItem = {
	role: 'system' | 'developer' | 'user' | 'assistant'
	content: string | AIInputTextPart[]
}

export type AIResponsesRequest = {
	model: string
	/** Responses `input`: string shorthand or message items. */
	input: string | AIInputItem[]
	/** Official `instructions` — the system-prompt equivalent of a chat system message. */
	instructions?: string
	/** Official equivalent of chat `max_tokens`. */
	max_output_tokens?: number
	temperature?: number
}

export type AIOutputContentPart = { type: string; text?: string }

export type AIOutputItem = {
	type: string
	role?: string
	content?: AIOutputContentPart[]
}

export type AIUsage = {
	input_tokens?: number
	output_tokens?: number
	total_tokens?: number
}

export type AIResponse = {
	id?: string
	object?: string
	model?: string
	status?: string
	output?: AIOutputItem[]
	usage?: AIUsage
}

/**
 * Visible text of a Responses document: concatenated `output_text` parts of
 * `message` output items. Empty string when the model produced no text.
 */
export function aiResponseText(response: AIResponse): string {
	const parts: string[] = []
	for (const item of response.output ?? []) {
		if (item.type !== 'message') continue
		for (const part of item.content ?? []) {
			if (part.type === 'output_text' && typeof part.text === 'string') parts.push(part.text)
		}
	}
	return parts.join('')
}

/**
 * One `GET /models` row (authenticated Models catalog document):
 * `{object:"list", data:[row...], models:[codex rows]}`. Pricing is USD per
 * million tokens; the context window is `context_window`/`max_context_window`.
 * Auxiliary (non-conversation) products are listed beside the conversation
 * seats.
 */
export type AIModelRow = {
	id: string
	object?: string
	owned_by?: string
	display_name?: string | null
	availability?: string
	context_window?: number
	max_context_window?: number
	limits?: unknown
	pricing?: {
		prompt?: number
		completion?: number
		cache_read?: number
		currency?: string
		unit?: string
	}
	data_policy?: unknown
	supports_search_tool?: boolean
	supports_reasoning_summary_parameter?: boolean
	supports_parallel_tool_calls?: boolean
	web_search_tool_type?: string
}

export type AIModelList = {
	object?: string
	data: AIModelRow[]
	models?: AIModelRow[]
}

export function getAI() {
	const origin = destPeelOrigin(DEST_PEELS.ai, process.env.AI_API_ORIGIN)
	const key = destAiCredential() ?? ''
	const createResponse = async (body: AIResponsesRequest) => {
		return destJson<AIResponse>(origin, '/responses', {
			method: 'POST',
			credential: key,
			body,
		})
	}
	return {
		createResponse,
		listModels: async (_opts?: { search?: string }) =>
			destJson<AIModelList>(origin, '/models', {
				credential: key,
			}),
	}
}
