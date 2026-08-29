import { destAiCredential } from './credentials'
import { DEST_PEELS, destJson, destPeelOrigin } from './dest'

export function getAI() {
	const origin = destPeelOrigin(DEST_PEELS.ai, process.env.AI_API_ORIGIN)
	const key = destAiCredential() ?? ''
	const create = async (body: unknown) => {
		return destJson<{
			choices?: Array<{ message?: { content?: string } }>
		}>(`${origin}`, '/chat/completions', {
			method: 'POST',
			credential: key,
			body,
		})
	}
	const chat = Object.assign(create, {
		completions: { create },
	})
	return {
		chat,
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
