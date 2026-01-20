/**
 * AI Chat Interface Component
 *
 * Full-featured chat UI that integrates with useChat hook.
 * Supports markdown rendering, code blocks, and streaming.
 */

'use client'

import {
	useState,
	useRef,
	useEffect,
	type CSSProperties,
	type ReactNode,
	type KeyboardEvent,
	type FormEvent,
} from 'react'
import type { ThemeVariables } from './styles'
import { defaultTheme, baseStyles, mergeStyles, injectGlobalStyles } from './styles'
import { useChat, type UseChatOptions } from '../ai-hooks'

// ============================================
// Types
// ============================================

export interface ChatInterfaceProps extends UseChatOptions {
	/** Theme variables */
	theme?: ThemeVariables
	/** Custom class name */
	className?: string
	/** Title shown in header */
	title?: string
	/** Placeholder text for input */
	placeholder?: string
	/** Whether to show the header */
	showHeader?: boolean
	/** Whether to show timestamps */
	showTimestamps?: boolean
	/** Whether to auto-scroll to bottom */
	autoScroll?: boolean
	/** Maximum height (CSS value) */
	maxHeight?: string
	/** Render custom message bubble */
	renderMessage?: (message: ChatMessage, index: number) => ReactNode
	/** Render custom empty state */
	renderEmpty?: () => ReactNode
	/** Render custom loading indicator */
	renderLoading?: () => ReactNode
	/** Custom send button content */
	sendButtonContent?: ReactNode
	/** Called when user sends a message */
	onSend?: (content: string) => void
	/** Show suggested prompts when empty */
	suggestedPrompts?: string[]
	/** Enable voice input (future) */
	enableVoice?: boolean
	/** Show model selector */
	showModelSelector?: boolean
	/** Available models */
	models?: { id: string; name: string }[]
	/** Selected model */
	selectedModel?: string
	/** Model change callback */
	onModelChange?: (modelId: string) => void
}

export interface ChatMessage {
	role: 'user' | 'assistant' | 'system' | 'tool'
	content: string
	timestamp?: Date
	toolCallId?: string
	name?: string
}

// ============================================
// ChatInterface Component
// ============================================

/**
 * Full-featured AI chat interface
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ChatInterface
 *   systemMessage="You are a helpful assistant."
 *   placeholder="Ask me anything..."
 * />
 *
 * // With custom styling
 * <ChatInterface
 *   theme={darkTheme}
 *   title="AI Assistant"
 *   suggestedPrompts={[
 *     "What can you help me with?",
 *     "Tell me a joke",
 *     "Explain quantum computing"
 *   ]}
 * />
 * ```
 */
export function ChatInterface({
	theme = defaultTheme,
	className,
	title = 'Chat',
	placeholder = 'Type a message...',
	showHeader = true,
	showTimestamps = false,
	autoScroll = true,
	maxHeight = '600px',
	renderMessage,
	renderEmpty,
	renderLoading,
	sendButtonContent,
	onSend,
	suggestedPrompts = [],
	showModelSelector = false,
	models = [],
	selectedModel,
	onModelChange,
	...chatOptions
}: ChatInterfaceProps) {
	const { messages, send, isLoading, error, clear, retry } = useChat(chatOptions)
	const [input, setInput] = useState('')
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLTextAreaElement>(null)
	const styles = baseStyles(theme)

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// Auto-scroll to bottom
	useEffect(() => {
		if (autoScroll && messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
		}
	}, [messages, autoScroll])

	// Auto-resize textarea
	useEffect(() => {
		if (inputRef.current) {
			inputRef.current.style.height = 'auto'
			inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`
		}
	}, [input])

	const handleSubmit = async (e?: FormEvent) => {
		e?.preventDefault()
		if (!input.trim() || isLoading) return

		const content = input.trim()
		setInput('')
		onSend?.(content)
		await send(content)
	}

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			handleSubmit()
		}
	}

	const handleSuggestedPrompt = (prompt: string) => {
		setInput(prompt)
		inputRef.current?.focus()
	}

	// Styles
	const containerStyle: CSSProperties = {
		display: 'flex',
		flexDirection: 'column',
		height: '100%',
		maxHeight,
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadius,
		backgroundColor: theme.colorBackground,
		fontFamily: theme.fontFamily,
		overflow: 'hidden',
	}

	const headerStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: '0.75rem 1rem',
		borderBottom: `1px solid ${theme.colorBorder}`,
		backgroundColor: theme.colorMuted,
	}

	const messagesContainerStyle: CSSProperties = {
		flex: 1,
		overflowY: 'auto',
		padding: '1rem',
		display: 'flex',
		flexDirection: 'column',
		gap: '1rem',
	}

	const inputContainerStyle: CSSProperties = {
		padding: '1rem',
		borderTop: `1px solid ${theme.colorBorder}`,
		backgroundColor: theme.colorBackground,
	}

	const textareaStyle: CSSProperties = {
		width: '100%',
		padding: '0.75rem 1rem',
		paddingRight: '3rem',
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadius,
		backgroundColor: theme.colorBackground,
		color: theme.colorForeground,
		fontSize: theme.fontSizeSm,
		fontFamily: theme.fontFamily,
		resize: 'none',
		outline: 'none',
		minHeight: '44px',
		maxHeight: '150px',
	}

	const sendButtonStyle: CSSProperties = {
		position: 'absolute',
		right: '0.5rem',
		bottom: '0.5rem',
		padding: '0.5rem',
		border: 'none',
		borderRadius: theme.borderRadiusSm,
		backgroundColor: isLoading || !input.trim() ? theme.colorMuted : theme.colorPrimary,
		color: isLoading || !input.trim() ? theme.colorMutedForeground : theme.colorPrimaryForeground,
		cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		transition: 'all 0.15s ease',
	}

	return (
		<div style={containerStyle} className={className}>
			{/* Header */}
			{showHeader && (
				<div style={headerStyle}>
					<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
						<ChatIcon color={theme.colorPrimary} />
						<span style={{ fontWeight: 600, fontSize: theme.fontSizeSm }}>{title}</span>
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
						{showModelSelector && models.length > 0 && (
							<select
								value={selectedModel}
								onChange={(e) => onModelChange?.(e.target.value)}
								style={{
									padding: '0.25rem 0.5rem',
									fontSize: theme.fontSizeXs,
									border: `1px solid ${theme.colorBorder}`,
									borderRadius: theme.borderRadiusSm,
									backgroundColor: theme.colorBackground,
									color: theme.colorForeground,
								}}
							>
								{models.map((m) => (
									<option key={m.id} value={m.id}>
										{m.name}
									</option>
								))}
							</select>
						)}
						{messages.length > 0 && (
							<button
								type="button"
								onClick={clear}
								style={{
									padding: '0.25rem 0.5rem',
									fontSize: theme.fontSizeXs,
									border: `1px solid ${theme.colorBorder}`,
									borderRadius: theme.borderRadiusSm,
									backgroundColor: 'transparent',
									color: theme.colorMutedForeground,
									cursor: 'pointer',
								}}
							>
								Clear
							</button>
						)}
					</div>
				</div>
			)}

			{/* Messages */}
			<div style={messagesContainerStyle}>
				{messages.length === 0 ? (
					renderEmpty?.() ?? (
						<div
							style={{
								flex: 1,
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								justifyContent: 'center',
								gap: '1rem',
								color: theme.colorMutedForeground,
								textAlign: 'center',
								padding: '2rem',
							}}
						>
							<ChatIcon color={theme.colorMuted} size={48} />
							<div>
								<p style={{ margin: 0, fontWeight: 500 }}>Start a conversation</p>
								<p style={{ margin: '0.25rem 0 0', fontSize: theme.fontSizeXs }}>
									Send a message to begin chatting
								</p>
							</div>
							{suggestedPrompts.length > 0 && (
								<div
									style={{
										display: 'flex',
										flexWrap: 'wrap',
										gap: '0.5rem',
										marginTop: '0.5rem',
										justifyContent: 'center',
									}}
								>
									{suggestedPrompts.map((prompt, i) => (
										<button
											key={i}
											type="button"
											onClick={() => handleSuggestedPrompt(prompt)}
											style={{
												padding: '0.5rem 0.75rem',
												fontSize: theme.fontSizeXs,
												border: `1px solid ${theme.colorBorder}`,
												borderRadius: theme.borderRadius,
												backgroundColor: theme.colorBackground,
												color: theme.colorForeground,
												cursor: 'pointer',
												transition: 'all 0.15s ease',
											}}
										>
											{prompt}
										</button>
									))}
								</div>
							)}
						</div>
					)
				) : (
					<>
						{messages
							.filter((m) => m.role !== 'system')
							.map((message, index) =>
								renderMessage ? (
									renderMessage({ ...message, timestamp: new Date() }, index)
								) : (
									<MessageBubble
										key={index}
										message={message}
										theme={theme}
										showTimestamp={showTimestamps}
									/>
								)
							)}
						{isLoading &&
							(renderLoading?.() ?? (
								<div
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: '0.5rem',
										color: theme.colorMutedForeground,
										fontSize: theme.fontSizeXs,
									}}
								>
									<span style={styles.spinner} />
									<span>Thinking...</span>
								</div>
							))}
					</>
				)}
				<div ref={messagesEndRef} />
			</div>

			{/* Error */}
			{error && (
				<div
					style={mergeStyles(styles.alert, styles.alertError, {
						margin: '0 1rem',
						marginBottom: '0.5rem',
					})}
				>
					<span>{error.message}</span>
					<button
						type="button"
						onClick={retry}
						style={{
							marginLeft: 'auto',
							padding: '0.25rem 0.5rem',
							fontSize: theme.fontSizeXs,
							border: `1px solid ${theme.colorDestructive}`,
							borderRadius: theme.borderRadiusSm,
							backgroundColor: 'transparent',
							color: theme.colorDestructive,
							cursor: 'pointer',
						}}
					>
						Retry
					</button>
				</div>
			)}

			{/* Input */}
			<div style={inputContainerStyle}>
				<form onSubmit={handleSubmit} style={{ position: 'relative' }}>
					<textarea
						ref={inputRef}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder={placeholder}
						disabled={isLoading}
						rows={1}
						style={textareaStyle}
					/>
					<button
						type="submit"
						disabled={isLoading || !input.trim()}
						style={sendButtonStyle}
					>
						{sendButtonContent ?? <SendIcon color="currentColor" />}
					</button>
				</form>
			</div>
		</div>
	)
}

// ============================================
// MessageBubble Component
// ============================================

interface MessageBubbleProps {
	message: { role: string; content: string }
	theme: ThemeVariables
	showTimestamp?: boolean
}

function MessageBubble({ message, theme, showTimestamp }: MessageBubbleProps) {
	const isUser = message.role === 'user'

	const bubbleStyle: CSSProperties = {
		maxWidth: '80%',
		padding: '0.75rem 1rem',
		borderRadius: theme.borderRadius,
		backgroundColor: isUser ? theme.colorPrimary : theme.colorMuted,
		color: isUser ? theme.colorPrimaryForeground : theme.colorForeground,
		alignSelf: isUser ? 'flex-end' : 'flex-start',
		fontSize: theme.fontSizeSm,
		lineHeight: 1.5,
		wordBreak: 'break-word',
	}

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: isUser ? 'flex-end' : 'flex-start',
				gap: '0.25rem',
			}}
		>
			<div style={bubbleStyle}>
				<MessageContent content={message.content} theme={theme} isUser={isUser} />
			</div>
			{showTimestamp && (
				<span
					style={{
						fontSize: '0.625rem',
						color: theme.colorMutedForeground,
					}}
				>
					{new Date().toLocaleTimeString()}
				</span>
			)}
		</div>
	)
}

// ============================================
// MessageContent (with code block support)
// ============================================

function MessageContent({
	content,
	theme,
	isUser,
}: {
	content: string
	theme: ThemeVariables
	isUser: boolean
}) {
	// Simple markdown-like parsing for code blocks
	const parts = content.split(/(```[\s\S]*?```)/g)

	return (
		<>
			{parts.map((part, i) => {
				if (part.startsWith('```') && part.endsWith('```')) {
					const lines = part.slice(3, -3).split('\n')
					const language = lines[0] || 'text'
					const code = lines.slice(1).join('\n')

					return (
						<pre
							key={i}
							style={{
								margin: '0.5rem 0',
								padding: '0.75rem',
								borderRadius: theme.borderRadiusSm,
								backgroundColor: isUser ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
								overflow: 'auto',
								fontSize: theme.fontSizeXs,
								fontFamily: 'monospace',
							}}
						>
							<code>{code || language}</code>
						</pre>
					)
				}

				// Handle inline code
				const inlineParts = part.split(/(`[^`]+`)/g)
				return (
					<span key={i}>
						{inlineParts.map((inline, j) => {
							if (inline.startsWith('`') && inline.endsWith('`')) {
								return (
									<code
										key={j}
										style={{
											padding: '0.125rem 0.25rem',
											borderRadius: '3px',
											backgroundColor: isUser ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
											fontFamily: 'monospace',
											fontSize: '0.9em',
										}}
									>
										{inline.slice(1, -1)}
									</code>
								)
							}
							return inline
						})}
					</span>
				)
			})}
		</>
	)
}

// ============================================
// ChatBubble (standalone export)
// ============================================

export interface ChatBubbleProps {
	/** Message content */
	content: string
	/** Message role */
	role: 'user' | 'assistant'
	/** Theme variables */
	theme?: ThemeVariables
	/** Show avatar */
	showAvatar?: boolean
	/** Avatar URL or initials */
	avatar?: string
	/** Show timestamp */
	timestamp?: Date
}

export function ChatBubble({
	content,
	role,
	theme = defaultTheme,
	showAvatar = false,
	avatar,
	timestamp,
}: ChatBubbleProps) {
	return (
		<MessageBubble
			message={{ role, content }}
			theme={theme}
			showTimestamp={!!timestamp}
		/>
	)
}

// ============================================
// ChatInput (standalone export)
// ============================================

export interface ChatInputProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Placeholder text */
	placeholder?: string
	/** Whether input is disabled */
	disabled?: boolean
	/** Called when user submits */
	onSubmit: (content: string) => void
	/** Whether loading */
	isLoading?: boolean
}

export function ChatInput({
	theme = defaultTheme,
	placeholder = 'Type a message...',
	disabled = false,
	onSubmit,
	isLoading = false,
}: ChatInputProps) {
	const [input, setInput] = useState('')
	const inputRef = useRef<HTMLTextAreaElement>(null)

	const handleSubmit = (e?: FormEvent) => {
		e?.preventDefault()
		if (!input.trim() || disabled || isLoading) return
		onSubmit(input.trim())
		setInput('')
	}

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			handleSubmit()
		}
	}

	return (
		<form onSubmit={handleSubmit} style={{ position: 'relative' }}>
			<textarea
				ref={inputRef}
				value={input}
				onChange={(e) => setInput(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				disabled={disabled || isLoading}
				rows={1}
				style={{
					width: '100%',
					padding: '0.75rem 1rem',
					paddingRight: '3rem',
					border: `1px solid ${theme.colorBorder}`,
					borderRadius: theme.borderRadius,
					backgroundColor: theme.colorBackground,
					color: theme.colorForeground,
					fontSize: theme.fontSizeSm,
					fontFamily: theme.fontFamily,
					resize: 'none',
					outline: 'none',
				}}
			/>
			<button
				type="submit"
				disabled={disabled || isLoading || !input.trim()}
				style={{
					position: 'absolute',
					right: '0.5rem',
					bottom: '0.5rem',
					padding: '0.5rem',
					border: 'none',
					borderRadius: theme.borderRadiusSm,
					backgroundColor: disabled || isLoading || !input.trim() ? theme.colorMuted : theme.colorPrimary,
					color: disabled || isLoading || !input.trim() ? theme.colorMutedForeground : theme.colorPrimaryForeground,
					cursor: disabled || isLoading || !input.trim() ? 'not-allowed' : 'pointer',
				}}
			>
				{isLoading ? <span style={{ width: 16, height: 16 }} className="sylphx-spinner" /> : <SendIcon color="currentColor" />}
			</button>
		</form>
	)
}

// ============================================
// Icons
// ============================================

function ChatIcon({ color, size = 20 }: { color: string; size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
		</svg>
	)
}

function SendIcon({ color }: { color: string }) {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<line x1="22" y1="2" x2="11" y2="13" />
			<polygon points="22 2 15 22 11 13 2 9 22 2" />
		</svg>
	)
}
