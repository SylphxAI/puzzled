/**
 * AI Hooks
 *
 * Composable hooks for AI completions.
 * No provider needed - uses config directly.
 */

'use client'

import { useState, useCallback, useRef } from 'react'
import { useSylphxConfig } from './core'
import {
	chat as chatFn,
	chatStream as chatStreamFn,
	embed as embedFn,
	type ChatInput,
	type ChatResult,
	type EmbedInput,
	type EmbedResult,
} from '../../functions/ai'

// ============================================================================
// Types
// ============================================================================

interface UseChatState {
	isLoading: boolean
	error: Error | null
	result: ChatResult | null
}

interface UseChatStreamState {
	isStreaming: boolean
	error: Error | null
	content: string
	isComplete: boolean
}

interface UseEmbedState {
	isLoading: boolean
	error: Error | null
	result: EmbedResult | null
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Chat completion hook
 *
 * @example
 * ```tsx
 * function ChatComponent() {
 *   const { chat, isLoading, result, error } = useChat()
 *
 *   const handleSend = async () => {
 *     await chat({
 *       model: 'gpt-4o',
 *       messages: [{ role: 'user', content: input }],
 *     })
 *   }
 *
 *   return (
 *     <div>
 *       {isLoading && <Spinner />}
 *       {result && <p>{result.choices[0].message.content}</p>}
 *       {error && <p className="error">{error.message}</p>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useChat() {
	const config = useSylphxConfig()
	const [state, setState] = useState<UseChatState>({
		isLoading: false,
		error: null,
		result: null,
	})

	const chat = useCallback(
		async (input: ChatInput): Promise<ChatResult> => {
			setState({ isLoading: true, error: null, result: null })

			try {
				const result = await chatFn(config, input)
				setState({ isLoading: false, error: null, result })
				return result
			} catch (e) {
				const error = e instanceof Error ? e : new Error('Chat request failed')
				setState({ isLoading: false, error, result: null })
				throw error
			}
		},
		[config]
	)

	return {
		chat,
		...state,
	}
}

/**
 * Streaming chat completion hook
 *
 * @example
 * ```tsx
 * function StreamingChat() {
 *   const { stream, isStreaming, content, error, abort } = useChatStream()
 *
 *   const handleSend = () => {
 *     stream({
 *       model: 'gpt-4o',
 *       messages: [{ role: 'user', content: input }],
 *     })
 *   }
 *
 *   return (
 *     <div>
 *       <p>{content}</p>
 *       {isStreaming && <button onClick={abort}>Stop</button>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useChatStream() {
	const config = useSylphxConfig()
	const [state, setState] = useState<UseChatStreamState>({
		isStreaming: false,
		error: null,
		content: '',
		isComplete: false,
	})

	const abortRef = useRef(false)

	const stream = useCallback(
		async (input: ChatInput): Promise<string> => {
			setState({ isStreaming: true, error: null, content: '', isComplete: false })
			abortRef.current = false

			try {
				let fullContent = ''

				for await (const chunk of chatStreamFn(config, input)) {
					if (abortRef.current) break

					const delta = chunk.choices[0]?.delta.content ?? ''
					fullContent += delta
					setState((s) => ({
						...s,
						content: fullContent,
						isComplete: chunk.choices[0]?.finishReason !== null,
					}))
				}

				setState((s) => ({
					...s,
					isStreaming: false,
					isComplete: true,
				}))

				return fullContent
			} catch (e) {
				const error = e instanceof Error ? e : new Error('Stream request failed')
				setState((s) => ({
					...s,
					isStreaming: false,
					error,
				}))
				throw error
			}
		},
		[config]
	)

	const abort = useCallback(() => {
		abortRef.current = true
		setState((s) => ({ ...s, isStreaming: false }))
	}, [])

	const reset = useCallback(() => {
		setState({
			isStreaming: false,
			error: null,
			content: '',
			isComplete: false,
		})
	}, [])

	return {
		stream,
		abort,
		reset,
		...state,
	}
}

/**
 * Embedding hook
 *
 * @example
 * ```tsx
 * function EmbeddingComponent() {
 *   const { embed, isLoading, result } = useEmbed()
 *
 *   const handleEmbed = async () => {
 *     const result = await embed({
 *       model: 'text-embedding-3-small',
 *       input: ['Hello', 'World'],
 *     })
 *     console.log(result.data[0].embedding)
 *   }
 * }
 * ```
 */
export function useEmbed() {
	const config = useSylphxConfig()
	const [state, setState] = useState<UseEmbedState>({
		isLoading: false,
		error: null,
		result: null,
	})

	const embed = useCallback(
		async (input: EmbedInput): Promise<EmbedResult> => {
			setState({ isLoading: true, error: null, result: null })

			try {
				const result = await embedFn(config, input)
				setState({ isLoading: false, error: null, result })
				return result
			} catch (e) {
				const error = e instanceof Error ? e : new Error('Embed request failed')
				setState({ isLoading: false, error, result: null })
				throw error
			}
		},
		[config]
	)

	return {
		embed,
		...state,
	}
}
