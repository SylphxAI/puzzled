/**
 * AI Hooks
 *
 * React hooks for the Sylphx AI Gateway.
 * Provides chat, completion, embedding, and vision capabilities.
 *
 * Uses proper React Context pattern (no module singletons).
 */

'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { STALE_TIME_STABLE_MS } from '../constants'
import { useAIContext } from './services-context'
import type {
	AIMessage,
	AITool,
	ChatCompletionResponse,
	AIUsageStats,
	AIRateLimitInfo,
	AIModelInfo,
	AIListModelsOptions,
	AIListModelsResponse,
} from '../types'

// ============================================
// Types
// ============================================

export interface UseChatOptions {
	/** Model to use (default: app config default) */
	model?: string
	/** System message to prepend to conversation */
	systemMessage?: string
	/** Temperature (0-2) */
	temperature?: number
	/** Max tokens for response */
	maxTokens?: number
	/** Tools/functions the model can call */
	tools?: AITool[]
	/** Initial messages */
	initialMessages?: AIMessage[]
	/** Enable streaming mode (default: false) */
	stream?: boolean
	/** Called for each token during streaming */
	onToken?: (token: string) => void
	/** Called when streaming completes */
	onStreamComplete?: () => void
	/** Called when a message is received */
	onMessage?: (message: AIMessage) => void
	/** Called on error */
	onError?: (error: Error) => void
}

export interface UseChatReturn {
	/** All messages in the conversation */
	messages: AIMessage[]
	/** Whether a request is in progress */
	isLoading: boolean
	/** Whether currently streaming a response */
	isStreaming: boolean
	/** Current streaming content (updated in real-time) */
	streamingContent: string
	/** Error from last request */
	error: Error | null
	/** Send a message and get response */
	send: (content: string) => Promise<void>
	/** Append a message without sending */
	append: (message: AIMessage) => void
	/** Clear all messages */
	clear: () => void
	/** Stop current streaming response */
	stop: () => void
	/** Retry last message */
	retry: () => Promise<void>
}

export interface UseCompletionOptions {
	/** Model to use */
	model?: string
	/** Temperature (0-2) */
	temperature?: number
	/** Max tokens for response */
	maxTokens?: number
	/** Stop sequences */
	stop?: string | string[]
	/** Called when completion is received */
	onComplete?: (text: string) => void
	/** Called on error */
	onError?: (error: Error) => void
}

export interface UseCompletionReturn {
	/** Complete a prompt */
	complete: (prompt: string) => Promise<string>
	/** Current completion text */
	completion: string
	/** Whether a request is in progress */
	isLoading: boolean
	/** Error from last request */
	error: Error | null
}

export interface UseEmbeddingOptions {
	/** Model to use */
	model?: string
	/** Embedding dimensions */
	dimensions?: number
}

export interface UseEmbeddingReturn {
	/** Embed a single text */
	embed: (text: string) => Promise<number[]>
	/** Embed multiple texts */
	embedMany: (texts: string[]) => Promise<number[][]>
	/** Whether a request is in progress */
	isLoading: boolean
	/** Error from last request */
	error: Error | null
}

// ============================================
// useChat
// ============================================

/**
 * Hook for conversational AI chat
 *
 * Supports both streaming and non-streaming modes.
 *
 * @example
 * ```tsx
 * // Non-streaming (default)
 * function ChatBot() {
 *   const { messages, send, isLoading } = useChat({
 *     systemMessage: 'You are a helpful assistant.',
 *   })
 *
 *   return (
 *     <div>
 *       {messages.map((m, i) => (
 *         <div key={i} className={m.role}>{m.content}</div>
 *       ))}
 *       <input
 *         onKeyDown={(e) => {
 *           if (e.key === 'Enter') {
 *             send(e.currentTarget.value)
 *             e.currentTarget.value = ''
 *           }
 *         }}
 *         disabled={isLoading}
 *       />
 *     </div>
 *   )
 * }
 *
 * // Streaming mode - real-time token display
 * function StreamingChatBot() {
 *   const { messages, send, isLoading, isStreaming, streamingContent, stop } = useChat({
 *     stream: true,
 *     systemMessage: 'You are a helpful assistant.',
 *     onToken: (token) => console.log('Token:', token),
 *   })
 *
 *   return (
 *     <div>
 *       {messages.map((m, i) => (
 *         <div key={i} className={m.role}>{m.content}</div>
 *       ))}
 *       {isStreaming && (
 *         <div className="assistant streaming">{streamingContent}</div>
 *       )}
 *       <button onClick={stop} disabled={!isStreaming}>Stop</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useChat(options: UseChatOptions = {}): UseChatReturn {
	const ctx = useAIContext()
	const [messages, setMessages] = useState<AIMessage[]>(options.initialMessages ?? [])
	const [isLoading, setIsLoading] = useState(false)
	const [isStreaming, setIsStreaming] = useState(false)
	const [streamingContent, setStreamingContent] = useState('')
	const [error, setError] = useState<Error | null>(null)
	const abortControllerRef = useRef<AbortController | null>(null)
	const lastUserMessageRef = useRef<string | null>(null)
	const shouldAbortRef = useRef(false)

	// Build messages with system message
	const buildMessages = useCallback(
		(userContent: string): AIMessage[] => {
			const allMessages: AIMessage[] = []

			if (options.systemMessage) {
				allMessages.push({ role: 'system', content: options.systemMessage })
			}

			allMessages.push(...messages)
			allMessages.push({ role: 'user', content: userContent })

			return allMessages
		},
		[messages, options.systemMessage]
	)

	const send = useCallback(
		async (content: string) => {
			setIsLoading(true)
			setError(null)
			setStreamingContent('')
			shouldAbortRef.current = false
			lastUserMessageRef.current = content

			const userMessage: AIMessage = { role: 'user', content }
			setMessages((prev) => [...prev, userMessage])

			try {
				abortControllerRef.current = new AbortController()

				const chatInput = {
					model: options.model,
					messages: buildMessages(content),
					temperature: options.temperature,
					maxTokens: options.maxTokens,
					tools: options.tools,
				}

				if (options.stream) {
					// Streaming mode
					setIsStreaming(true)
					let fullContent = ''

					for await (const chunk of ctx.chatStream(chatInput)) {
						if (shouldAbortRef.current) break

						const token = chunk.choices?.[0]?.delta?.content ?? chunk.delta?.content ?? ''
						if (token) {
							fullContent += token
							setStreamingContent(fullContent)
							options.onToken?.(token)
						}
					}

					setIsStreaming(false)
					options.onStreamComplete?.()

					const assistantMessage: AIMessage = {
						role: 'assistant',
						content: fullContent,
					}

					setMessages((prev) => [...prev, assistantMessage])
					setStreamingContent('')
					options.onMessage?.(assistantMessage)
				} else {
					// Non-streaming mode
					const response = await ctx.chat(chatInput)

					const assistantMessage: AIMessage = {
						role: 'assistant',
						content: response.choices[0]?.message.content ?? '',
					}

					setMessages((prev) => [...prev, assistantMessage])
					options.onMessage?.(assistantMessage)
				}
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Chat failed')
				setError(error)
				options.onError?.(error)
				setIsStreaming(false)
			} finally {
				setIsLoading(false)
				abortControllerRef.current = null
			}
		},
		[ctx, buildMessages, options]
	)

	const append = useCallback((message: AIMessage) => {
		setMessages((prev) => [...prev, message])
	}, [])

	const clear = useCallback(() => {
		setMessages([])
		setError(null)
		setStreamingContent('')
	}, [])

	const stop = useCallback(() => {
		shouldAbortRef.current = true
		abortControllerRef.current?.abort()
		setIsStreaming(false)
	}, [])

	const retry = useCallback(async () => {
		if (lastUserMessageRef.current) {
			// Remove last user and assistant messages
			setMessages((prev) => prev.slice(0, -2))
			await send(lastUserMessageRef.current)
		}
	}, [send])

	return {
		messages,
		isLoading,
		isStreaming,
		streamingContent,
		error,
		send,
		append,
		clear,
		stop,
		retry,
	}
}

// ============================================
// useCompletion
// ============================================

/**
 * Hook for text completion
 *
 * @example
 * ```tsx
 * function TextCompleter() {
 *   const { complete, completion, isLoading } = useCompletion()
 *
 *   return (
 *     <div>
 *       <input
 *         onBlur={(e) => complete(e.target.value)}
 *         disabled={isLoading}
 *       />
 *       <p>{completion}</p>
 *     </div>
 *   )
 * }
 * ```
 */
export function useCompletion(options: UseCompletionOptions = {}): UseCompletionReturn {
	const ctx = useAIContext()
	const [completion, setCompletion] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	const complete = useCallback(
		async (prompt: string): Promise<string> => {
			setIsLoading(true)
			setError(null)

			try {
				const stopSequences = options.stop
					? Array.isArray(options.stop)
						? options.stop
						: [options.stop]
					: undefined
				const response = await ctx.complete({
					model: options.model,
					prompt,
					temperature: options.temperature,
					maxTokens: options.maxTokens,
					stop: stopSequences,
				})

				const text = response.choices[0]?.text ?? ''
				setCompletion(text)
				options.onComplete?.(text)
				return text
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Completion failed')
				setError(error)
				options.onError?.(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx, options]
	)

	return {
		complete,
		completion,
		isLoading,
		error,
	}
}

// ============================================
// useEmbedding
// ============================================

/**
 * Hook for generating text embeddings
 *
 * @example
 * ```tsx
 * function SemanticSearch() {
 *   const { embed, embedMany, isLoading } = useEmbedding()
 *
 *   const search = async (query: string) => {
 *     const queryEmbedding = await embed(query)
 *     // Use queryEmbedding for similarity search
 *   }
 *
 *   return <input onBlur={(e) => search(e.target.value)} />
 * }
 * ```
 */
export function useEmbedding(options: UseEmbeddingOptions = {}): UseEmbeddingReturn {
	const ctx = useAIContext()
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	const embed = useCallback(
		async (text: string): Promise<number[]> => {
			setIsLoading(true)
			setError(null)

			try {
				const response = await ctx.embed({
					model: options.model,
					input: text,
					dimensions: options.dimensions,
				})

				return response.data[0]?.embedding ?? []
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Embedding failed')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx, options]
	)

	const embedMany = useCallback(
		async (texts: string[]): Promise<number[][]> => {
			setIsLoading(true)
			setError(null)

			try {
				const response = await ctx.embed({
					model: options.model,
					input: texts,
					dimensions: options.dimensions,
				})

				return response.data.map((d) => d.embedding)
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Embedding failed')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx, options]
	)

	return {
		embed,
		embedMany,
		isLoading,
		error,
	}
}

// ============================================
// useAI
// ============================================

export interface UseAIReturn {
	/** Generate chat completion */
	chat: (
		messages: AIMessage[],
		options?: {
			model?: string
			temperature?: number
			maxTokens?: number
			tools?: AITool[]
		}
	) => Promise<ChatCompletionResponse>
	/** Generate text completion */
	complete: (
		prompt: string,
		options?: {
			model?: string
			temperature?: number
			maxTokens?: number
		}
	) => Promise<string>
	/** Generate embeddings */
	embed: (input: string | string[], options?: { model?: string; dimensions?: number }) => Promise<number[][] | number[]>
	/** Analyze image */
	vision: (
		imageUrl: string,
		prompt: string,
		options?: { model?: string; maxTokens?: number }
	) => Promise<string>
	/** Get usage statistics */
	getUsage: (period?: 'day' | 'week' | 'month') => Promise<AIUsageStats>
	/** Get rate limit status */
	getRateLimitStatus: () => Promise<AIRateLimitInfo>
	/** Get available models */
	getModels: (options?: AIListModelsOptions) => Promise<AIListModelsResponse>
	/** Whether any AI request is in progress */
	isLoading: boolean
	/** Last error */
	error: Error | null
}

/**
 * Low-level hook for AI Gateway access
 *
 * @example
 * ```tsx
 * function AIDemo() {
 *   const { chat, embed, vision, isLoading } = useAI()
 *
 *   const analyze = async () => {
 *     const response = await chat([
 *       { role: 'user', content: 'Hello!' }
 *     ])
 *     console.log(response.choices[0].message.content)
 *   }
 *
 *   return <button onClick={analyze} disabled={isLoading}>Analyze</button>
 * }
 * ```
 */
export function useAI(): UseAIReturn {
	const ctx = useAIContext()
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	const chat = useCallback(
		async (
			messages: AIMessage[],
			options?: {
				model?: string
				temperature?: number
				maxTokens?: number
				tools?: AITool[]
			}
		): Promise<ChatCompletionResponse> => {
			setIsLoading(true)
			setError(null)

			try {
				return await ctx.chat({
					messages,
					...options,
				})
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Chat failed')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx]
	)

	const complete = useCallback(
		async (
			prompt: string,
			options?: {
				model?: string
				temperature?: number
				maxTokens?: number
			}
		): Promise<string> => {
			setIsLoading(true)
			setError(null)

			try {
				const response = await ctx.complete({
					prompt,
					...options,
				})
				return response.choices[0]?.text ?? ''
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Completion failed')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx]
	)

	const embed = useCallback(
		async (
			input: string | string[],
			options?: { model?: string; dimensions?: number }
		): Promise<number[][] | number[]> => {
			setIsLoading(true)
			setError(null)

			try {
				const response = await ctx.embed({
					input,
					...options,
				})

				if (Array.isArray(input)) {
					return response.data.map((d) => d.embedding)
				}
				return response.data[0]?.embedding ?? []
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Embedding failed')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx]
	)

	const vision = useCallback(
		async (
			imageUrl: string,
			prompt: string,
			options?: { model?: string; maxTokens?: number }
		): Promise<string> => {
			setIsLoading(true)
			setError(null)

			try {
				const response = await ctx.vision({
					messages: [
						{
							role: 'user',
							content: [
								{ type: 'text', text: prompt },
								{ type: 'image_url', image_url: { url: imageUrl } },
							],
						},
					],
					...options,
				})
				return response.choices[0]?.message.content ?? ''
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Vision analysis failed')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx]
	)

	const getUsage = useCallback(
		async (period: 'day' | 'week' | 'month' = 'day'): Promise<AIUsageStats> => {
			return await ctx.getUsage(period)
		},
		[ctx]
	)

	const getRateLimitStatus = useCallback(async (): Promise<AIRateLimitInfo> => {
		return await ctx.getRateLimitStatus()
	}, [ctx])

	const getModels = useCallback(
		async (options?: AIListModelsOptions): Promise<AIListModelsResponse> => {
			return await ctx.listModels(options)
		},
		[ctx]
	)

	return {
		chat,
		complete,
		embed,
		vision,
		getUsage,
		getRateLimitStatus,
		getModels,
		isLoading,
		error,
	}
}

// ============================================
// useModels
// ============================================

export interface UseModelsOptions {
	/** Filter by capability */
	capability?: 'chat' | 'vision' | 'tool' | 'embedding'
	/** Search by name or ID */
	search?: string
	/** Number of models per page */
	pageSize?: number
	/** Whether to fetch immediately */
	fetchOnMount?: boolean
}

export interface UseModelsReturn {
	/** List of models */
	models: AIModelInfo[]
	/** Total number of models matching filters */
	total: number
	/** Whether more models are available */
	hasMore: boolean
	/** Whether loading */
	isLoading: boolean
	/** Error if any */
	error: Error | null
	/** Fetch models with current filters */
	fetch: () => Promise<void>
	/** Load more models (pagination) */
	loadMore: () => Promise<void>
	/** Search models */
	setSearch: (search: string) => void
	/** Filter by capability */
	setCapability: (capability: UseModelsOptions['capability']) => void
}

/**
 * Hook for fetching and filtering available AI models
 *
 * @example
 * ```tsx
 * function ModelSelector({ onSelect }: { onSelect: (modelId: string) => void }) {
 *   const { models, isLoading, setSearch, setCapability } = useModels({
 *     fetchOnMount: true,
 *     capability: 'chat',
 *   })
 *
 *   return (
 *     <div>
 *       <input
 *         placeholder="Search models..."
 *         onChange={(e) => setSearch(e.target.value)}
 *       />
 *       <select onChange={(e) => setCapability(e.target.value as UseModelsOptions['capability'] || undefined)}>
 *         <option value="">All</option>
 *         <option value="chat">Chat</option>
 *         <option value="vision">Vision</option>
 *         <option value="embedding">Embedding</option>
 *       </select>
 *       {isLoading ? (
 *         <div>Loading...</div>
 *       ) : (
 *         <ul>
 *           {models.map((model) => (
 *             <li key={model.id} onClick={() => onSelect(model.id)}>
 *               <strong>{model.name}</strong>
 *               <span>{model.contextWindow.toLocaleString()} tokens</span>
 *               <span>${model.inputCostPer1M}/1M input</span>
 *             </li>
 *           ))}
 *         </ul>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */
export function useModels(options: UseModelsOptions = {}): UseModelsReturn {
	const ctx = useAIContext()
	const queryClient = useQueryClient()
	const [search, setSearch] = useState(options.search ?? '')
	const [capability, setCapability] = useState(options.capability)
	const [debouncedSearch, setDebouncedSearch] = useState(search)
	const pageSize = options.pageSize ?? 50

	// Debounce search input
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(search)
		}, 300)
		return () => clearTimeout(timer)
	}, [search])

	// React Query infinite query for paginated models
	const modelsQuery = useInfiniteQuery({
		queryKey: ['sylphx', 'ai-models', capability, debouncedSearch, pageSize],
		queryFn: async ({ pageParam = 0 }) => {
			return ctx.listModels({
				capability,
				search: debouncedSearch || undefined,
				limit: pageSize,
				offset: pageParam,
			})
		},
		initialPageParam: 0,
		getNextPageParam: (lastPage, allPages) => {
			if (!lastPage.hasMore) return undefined
			return allPages.length * pageSize
		},
		enabled: options.fetchOnMount !== false,
		staleTime: STALE_TIME_STABLE_MS, // 5 min - model list is stable
	})

	// Flatten all pages into single models array
	const models = useMemo(
		() => modelsQuery.data?.pages.flatMap((page) => page.models) ?? [],
		[modelsQuery.data]
	)
	const total = modelsQuery.data?.pages[0]?.total ?? 0

	// Fetch (refresh) via React Query invalidation
	const fetch = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: ['sylphx', 'ai-models'],
		})
	}, [queryClient])

	// Load more via fetchNextPage
	const loadMore = useCallback(async () => {
		if (modelsQuery.hasNextPage && !modelsQuery.isFetchingNextPage) {
			await modelsQuery.fetchNextPage()
		}
	}, [modelsQuery])

	return {
		models,
		total,
		hasMore: modelsQuery.hasNextPage ?? false,
		isLoading: modelsQuery.isLoading,
		error: modelsQuery.error as Error | null,
		fetch,
		loadMore,
		setSearch,
		setCapability,
	}
}
