/**
 * Prompt Template Utilities
 *
 * Build, validate, and render prompt templates with variables.
 *
 * @example
 * ```typescript
 * import { createPromptTemplate, renderPrompt, buildMessages } from '@sylphx/platform-sdk/ai'
 *
 * // Create a reusable template
 * const template = createPromptTemplate({
 *   name: 'code-review',
 *   template: `Review this {{language}} code:
 *
 * \`\`\`{{language}}
 * {{code}}
 * \`\`\`
 *
 * Focus on: {{focus}}`,
 *   variables: [
 *     { name: 'language', required: true },
 *     { name: 'code', required: true },
 *     { name: 'focus', default: 'bugs, performance, readability' },
 *   ],
 * })
 *
 * // Render with variables
 * const prompt = renderPrompt(template, {
 *   language: 'TypeScript',
 *   code: 'function add(a, b) { return a + b }',
 * })
 *
 * // Build complete message array
 * const messages = buildMessages({
 *   system: 'You are a senior code reviewer.',
 *   user: prompt.text,
 * })
 * ```
 */

import type {
	PromptTemplate,
	TemplateVariable,
	CompiledPrompt,
	ChatMessage,
	ConversationContext,
} from './types'
import { countTokens, countMessageTokens, estimateTokens } from './tokens'
import { getModel } from './models'

// ============================================================================
// Template Creation
// ============================================================================

/**
 * Create a prompt template
 *
 * @param config - Template configuration
 * @returns Validated prompt template
 *
 * @example
 * ```typescript
 * const template = createPromptTemplate({
 *   name: 'summarize',
 *   template: 'Summarize this text in {{style}} style:\n\n{{text}}',
 *   variables: [
 *     { name: 'text', required: true },
 *     { name: 'style', default: 'concise' },
 *   ],
 * })
 * ```
 */
export function createPromptTemplate(config: {
	name: string
	description?: string
	template: string
	variables?: TemplateVariable[]
	outputFormat?: PromptTemplate['outputFormat']
}): PromptTemplate {
	const { name, description, template, outputFormat } = config

	// Extract variables from template if not provided
	const variableMatches = template.match(/\{\{(\w+)\}\}/g) ?? []
	const templateVarNames = variableMatches.map((m) => m.slice(2, -2))

	const variables = config.variables ?? templateVarNames.map((name) => ({
		name,
		required: true,
	}))

	// Validate all template variables are defined
	for (const varName of templateVarNames) {
		if (!variables.some((v) => v.name === varName)) {
			throw new Error(`Template variable '${varName}' is not defined`)
		}
	}

	return {
		name,
		description,
		template,
		variables,
		outputFormat,
	}
}

/**
 * Render a prompt template with variables
 *
 * @param template - The template to render
 * @param values - Variable values
 * @returns Compiled prompt with substituted variables
 *
 * @example
 * ```typescript
 * const result = renderPrompt(template, {
 *   language: 'Python',
 *   code: 'def hello(): print("hi")',
 * })
 * console.log(result.text)
 * console.log(result.estimatedTokens)
 * ```
 */
export function renderPrompt(
	template: PromptTemplate,
	values: Record<string, string>
): CompiledPrompt {
	const substitutions: Record<string, string> = {}

	// Validate required variables and apply defaults
	for (const variable of template.variables) {
		const value = values[variable.name] ?? variable.default

		if (value === undefined) {
			if (variable.required !== false) {
				throw new Error(`Missing required variable: ${variable.name}`)
			}
			continue
		}

		// Validate pattern if specified
		if (variable.pattern) {
			const regex = new RegExp(variable.pattern)
			if (!regex.test(value)) {
				throw new Error(
					`Variable '${variable.name}' does not match pattern: ${variable.pattern}`
				)
			}
		}

		substitutions[variable.name] = value
	}

	// Perform substitution
	let text = template.template
	for (const [name, value] of Object.entries(substitutions)) {
		text = text.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), value)
	}

	// Remove any remaining optional placeholders
	text = text.replace(/\{\{\w+\}\}/g, '')

	return {
		text,
		substitutions,
		estimatedTokens: estimateTokens(text),
	}
}

/**
 * Validate template variables without rendering
 *
 * @param template - Template to validate
 * @param values - Variable values to validate
 * @returns Validation result
 */
export function validateTemplateValues(
	template: PromptTemplate,
	values: Record<string, string>
): { valid: boolean; errors: string[] } {
	const errors: string[] = []

	for (const variable of template.variables) {
		const value = values[variable.name] ?? variable.default

		if (value === undefined && variable.required !== false) {
			errors.push(`Missing required variable: ${variable.name}`)
			continue
		}

		if (value !== undefined && variable.pattern) {
			const regex = new RegExp(variable.pattern)
			if (!regex.test(value)) {
				errors.push(`Variable '${variable.name}' does not match pattern`)
			}
		}
	}

	return {
		valid: errors.length === 0,
		errors,
	}
}

// ============================================================================
// Message Building
// ============================================================================

/**
 * Build a message array from common patterns
 *
 * @param config - Message configuration
 * @returns Array of chat messages
 *
 * @example
 * ```typescript
 * // Simple system + user
 * const messages = buildMessages({
 *   system: 'You are a helpful assistant.',
 *   user: 'Hello!',
 * })
 *
 * // With conversation history
 * const messages = buildMessages({
 *   system: 'You are a helpful assistant.',
 *   history: [
 *     { role: 'user', content: 'Hi' },
 *     { role: 'assistant', content: 'Hello!' },
 *   ],
 *   user: 'How are you?',
 * })
 * ```
 */
export function buildMessages(config: {
	/** System message (prepended) */
	system?: string
	/** Conversation history */
	history?: ChatMessage[]
	/** Current user message */
	user?: string
	/** Optional assistant prefix (for continue mode) */
	assistantPrefix?: string
}): ChatMessage[] {
	const messages: ChatMessage[] = []

	if (config.system) {
		messages.push({ role: 'system', content: config.system })
	}

	if (config.history) {
		messages.push(...config.history)
	}

	if (config.user) {
		messages.push({ role: 'user', content: config.user })
	}

	if (config.assistantPrefix) {
		messages.push({ role: 'assistant', content: config.assistantPrefix })
	}

	return messages
}

/**
 * Create a conversation context manager
 *
 * Tracks messages and token usage, handles context window limits.
 *
 * @param config - Context configuration
 * @returns Conversation context object
 *
 * @example
 * ```typescript
 * const ctx = createConversationContext({
 *   model: 'gpt-4o',
 *   systemMessage: 'You are a helpful assistant.',
 * })
 *
 * ctx.addUser('Hello!')
 * ctx.addAssistant('Hi there!')
 *
 * console.log(ctx.getMessages())
 * console.log(ctx.getRemainingTokens())
 *
 * // Auto-truncate if needed
 * ctx.addUser(veryLongMessage)
 * ```
 */
export function createConversationContext(config: {
	model: string
	systemMessage?: string
	maxTokens?: number
}): {
	addUser: (content: string) => void
	addAssistant: (content: string) => void
	addTool: (content: string, toolCallId: string) => void
	getMessages: () => ChatMessage[]
	getContext: () => ConversationContext
	getRemainingTokens: () => number
	clear: () => void
	truncateToFit: (reserveTokens?: number) => void
} {
	const modelInfo = getModel(config.model)
	const maxTokens = config.maxTokens ?? modelInfo?.contextWindow ?? 128000

	const messages: ChatMessage[] = []
	const systemMessage = config.systemMessage

	function recalculateTokens(): number {
		const allMessages = systemMessage
			? [{ role: 'system' as const, content: systemMessage }, ...messages]
			: messages
		return countMessageTokens(allMessages, { model: config.model }).tokens
	}

	let totalTokens = systemMessage ? estimateTokens(systemMessage, config.model) + 4 : 0

	function addMessage(message: ChatMessage): void {
		const messageTokens = estimateTokens(message.content, config.model) + 4
		messages.push(message)
		totalTokens += messageTokens
	}

	function truncateToFit(reserveTokens: number = 0): void {
		const targetTokens = maxTokens - reserveTokens

		while (totalTokens > targetTokens && messages.length > 0) {
			const removed = messages.shift()
			if (removed) {
				totalTokens -= estimateTokens(removed.content, config.model) + 4
			}
		}
	}

	return {
		addUser(content: string) {
			addMessage({ role: 'user', content })
		},

		addAssistant(content: string) {
			addMessage({ role: 'assistant', content })
		},

		addTool(content: string, toolCallId: string) {
			addMessage({ role: 'tool', content, tool_call_id: toolCallId })
		},

		getMessages(): ChatMessage[] {
			const allMessages: ChatMessage[] = []
			if (systemMessage) {
				allMessages.push({ role: 'system', content: systemMessage })
			}
			allMessages.push(...messages)
			return allMessages
		},

		getContext(): ConversationContext {
			return {
				messages: this.getMessages(),
				systemMessage,
				totalTokens,
				model: config.model,
				remainingTokens: maxTokens - totalTokens,
			}
		},

		getRemainingTokens(): number {
			return maxTokens - totalTokens
		},

		clear(): void {
			messages.length = 0
			totalTokens = systemMessage ? estimateTokens(systemMessage, config.model) + 4 : 0
		},

		truncateToFit,
	}
}

// ============================================================================
// Common Prompt Patterns
// ============================================================================

/**
 * Create a JSON mode system prompt
 *
 * @param schema - JSON schema or description of expected output
 * @returns System message for JSON mode
 */
export function jsonModePrompt(schema?: string): string {
	let prompt = 'Respond with valid JSON only. No markdown, no explanation, just JSON.'

	if (schema) {
		prompt += `\n\nExpected format:\n${schema}`
	}

	return prompt
}

/**
 * Create a chain-of-thought prompt wrapper
 *
 * @param task - The task to perform
 * @returns Prompt that encourages step-by-step reasoning
 */
export function chainOfThoughtPrompt(task: string): string {
	return `${task}

Think through this step-by-step:
1. First, understand what is being asked
2. Break down the problem into parts
3. Solve each part
4. Combine for the final answer

Show your reasoning before giving the final answer.`
}

/**
 * Create a few-shot prompt with examples
 *
 * @param config - Few-shot configuration
 * @returns Formatted few-shot prompt
 */
export function fewShotPrompt(config: {
	task: string
	examples: Array<{ input: string; output: string }>
	input: string
}): string {
	let prompt = `${config.task}\n\n`

	for (let i = 0; i < config.examples.length; i++) {
		const example = config.examples[i]
		prompt += `Example ${i + 1}:\nInput: ${example.input}\nOutput: ${example.output}\n\n`
	}

	prompt += `Now, process this input:\nInput: ${config.input}\nOutput:`

	return prompt
}

/**
 * Create a role-playing system prompt
 *
 * @param config - Role configuration
 * @returns System prompt for role-playing
 */
export function rolePrompt(config: {
	role: string
	expertise?: string[]
	personality?: string[]
	constraints?: string[]
}): string {
	let prompt = `You are ${config.role}.`

	if (config.expertise?.length) {
		prompt += `\n\nYour expertise includes: ${config.expertise.join(', ')}.`
	}

	if (config.personality?.length) {
		prompt += `\n\nYour personality: ${config.personality.join(', ')}.`
	}

	if (config.constraints?.length) {
		prompt += `\n\nImportant constraints:\n${config.constraints.map((c) => `- ${c}`).join('\n')}`
	}

	return prompt
}

// ============================================================================
// Prompt Optimization
// ============================================================================

/**
 * Compress a prompt to reduce tokens while preserving meaning
 *
 * Uses simple heuristics - for production, consider using a dedicated service.
 *
 * @param text - Text to compress
 * @returns Compressed text
 */
export function compressPrompt(text: string): string {
	return text
		// Remove extra whitespace
		.replace(/\s+/g, ' ')
		// Remove filler words (careful - this is aggressive)
		.replace(/\b(just|very|really|actually|basically|simply|literally)\b/gi, '')
		// Compress multiple periods/punctuation
		.replace(/\.{2,}/g, '.')
		.replace(/\s+/g, ' ')
		.trim()
}

/**
 * Expand abbreviations in user input for better model understanding
 *
 * @param text - Text with abbreviations
 * @param abbreviations - Map of abbreviation to expansion
 * @returns Expanded text
 */
export function expandAbbreviations(
	text: string,
	abbreviations: Record<string, string>
): string {
	let result = text
	for (const [abbr, expansion] of Object.entries(abbreviations)) {
		result = result.replace(new RegExp(`\\b${abbr}\\b`, 'gi'), expansion)
	}
	return result
}
