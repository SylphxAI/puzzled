const AI_API_ORIGIN = 'https://api.sylphx.ai/v1'

export function getAI() {
	const origin = process.env.AI_API_ORIGIN?.trim() || AI_API_ORIGIN
	const key = process.env.AI_API_KEY || process.env.SYLPHX_SECRET_KEY || ''
	return {
		chat: {
			completions: {
				create: async (body: unknown) => {
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
				},
			},
		},
	}
}
