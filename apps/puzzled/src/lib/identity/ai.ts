const AI_API_ORIGIN = 'https://api.sylphx.ai/v1'

export function getAI() {
	const origin = process.env.AI_API_ORIGIN?.trim() || AI_API_ORIGIN
	const key = process.env.AI_API_KEY || process.env.SYLPHX_SECRET_KEY || ''
	const create = async (body: unknown) => {
		const response = await fetch(`${origin.replace(/\/+$/, '')}/chat/completions`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: key ? `Bearer ${key}` : '',
			},
			body: JSON.stringify(body),
		})
		if (!response.ok) {
			throw new Error(`AI dest ${response.status}`)
		}
		return response.json()
	}
	const chat = Object.assign(create, {
		completions: { create },
	})
	return {
		chat,
		listModels: async (_opts?: { search?: string }) => ({
			data: [] as Array<{
				id: string
				name: string
				context_length: number
				pricing: { prompt: string; completion: string }
				capabilities: unknown
			}>,
		}),
	}
}
