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
			destJson<{
				data: Array<{
					id: string
					name: string
					context_length: number
					pricing: { prompt: string; completion: string }
					capabilities: unknown
				}>
			}>(origin, '/models', {
				credential: key,
			}),
	}
}
