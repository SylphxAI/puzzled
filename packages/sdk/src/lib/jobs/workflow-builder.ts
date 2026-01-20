/**
 * Workflow Builder DSL
 *
 * Fluent API for defining workflows with type safety.
 *
 * @example
 * ```typescript
 * const workflow = createWorkflow('onboarding')
 *   .name('User Onboarding')
 *   .step('create-account', job('create-user'))
 *   .step('send-welcome', job('send-email', (ctx) => ({
 *     to: ctx.results['create-account'].email,
 *     template: 'welcome',
 *   })))
 *   .step('wait-verification', wait(24 * 60 * 60 * 1000))
 *   .step('check-verified', conditional(
 *     (ctx) => ctx.results['create-account'].verified,
 *     [job('activate-account')],
 *     [job('send-reminder')]
 *   ))
 *   .build()
 * ```
 */

import type {
	WorkflowDefinition,
	WorkflowStep,
	WorkflowOptions,
	JobStep,
	ConditionalStep,
	ParallelStep,
	LoopStep,
	WaitStep,
	SubworkflowStep,
	StepContext,
	JobPayload,
	JobResult,
	JobOptions,
} from './types'

// ==========================================
// Workflow Builder
// ==========================================

/**
 * Create a new workflow builder
 */
export function createWorkflow<TInput extends JobPayload = JobPayload, TOutput = JobResult>(
	type: string
): WorkflowBuilder<TInput, TOutput> {
	return new WorkflowBuilder<TInput, TOutput>(type)
}

/**
 * Workflow Builder
 *
 * Fluent API for building workflow definitions.
 */
export class WorkflowBuilder<TInput extends JobPayload = JobPayload, TOutput = JobResult> {
	private definition: Partial<WorkflowDefinition<TInput, TOutput>> = {}
	private _steps: WorkflowStep[] = []

	constructor(type: string) {
		this.definition.type = type
	}

	/**
	 * Set workflow name
	 */
	name(name: string): this {
		this.definition.name = name
		return this
	}

	/**
	 * Set workflow description
	 */
	description(description: string): this {
		this.definition.description = description
		return this
	}

	/**
	 * Set default options
	 */
	defaults(options: WorkflowOptions): this {
		this.definition.defaults = options
		return this
	}

	/**
	 * Add a step to the workflow
	 */
	step(name: string, step: WorkflowStep): this {
		// Override step name
		const namedStep = { ...step, name }
		this._steps.push(namedStep)
		return this
	}

	/**
	 * Add multiple steps
	 */
	steps(...steps: Array<[string, WorkflowStep]>): this {
		for (const [name, step] of steps) {
			this.step(name, step)
		}
		return this
	}

	/**
	 * Add on complete callback
	 */
	onComplete(callback: (result: TOutput) => void): this {
		this.definition.onComplete = callback
		return this
	}

	/**
	 * Add on error callback
	 */
	onError(callback: (error: Error, step: string) => void): this {
		this.definition.onError = callback
		return this
	}

	/**
	 * Build the workflow definition
	 */
	build(): WorkflowDefinition<TInput, TOutput> {
		return {
			type: this.definition.type!,
			name: this.definition.name,
			description: this.definition.description,
			steps: this._steps,
			defaults: this.definition.defaults,
			onComplete: this.definition.onComplete,
			onError: this.definition.onError,
		}
	}
}

// ==========================================
// Step Builders
// ==========================================

/**
 * Create a job step
 */
export function job(
	jobType: string,
	payload?: JobPayload | ((context: StepContext) => JobPayload),
	options?: JobOptions
): JobStep {
	return {
		type: 'job',
		name: jobType,
		jobType,
		payload: typeof payload === 'function' ? payload : payload ? () => payload : undefined,
		options,
	}
}

/**
 * Create a conditional step
 */
export function conditional(
	condition: (context: StepContext) => boolean,
	thenSteps: WorkflowStep[],
	elseSteps?: WorkflowStep[]
): ConditionalStep {
	return {
		type: 'conditional',
		name: 'conditional',
		condition,
		then: thenSteps,
		else: elseSteps,
	}
}

/**
 * Create a parallel step
 */
export function parallel(
	steps: WorkflowStep[],
	options?: { waitFor?: 'all' | 'any'; maxConcurrency?: number }
): ParallelStep {
	return {
		type: 'parallel',
		name: 'parallel',
		steps,
		waitFor: options?.waitFor || 'all',
		maxConcurrency: options?.maxConcurrency,
	}
}

/**
 * Create a loop step
 */
export function loop(
	items: unknown[] | ((context: StepContext) => unknown[]),
	step: WorkflowStep,
	options?: { maxConcurrency?: number; breakIf?: (item: unknown, index: number, context: StepContext) => boolean }
): LoopStep {
	return {
		type: 'loop',
		name: 'loop',
		items,
		step,
		maxConcurrency: options?.maxConcurrency,
		breakIf: options?.breakIf,
	}
}

/**
 * Create a wait step
 */
export function wait(
	until: number | Date | ((context: StepContext) => number | Date)
): WaitStep {
	return {
		type: 'wait',
		name: 'wait',
		until,
	}
}

/**
 * Create a sub-workflow step
 */
export function subworkflow(
	workflowType: string,
	payload?: JobPayload | ((context: StepContext) => JobPayload),
	options?: WorkflowOptions
): SubworkflowStep {
	return {
		type: 'subworkflow',
		name: workflowType,
		workflowType,
		payload: typeof payload === 'function' ? payload : payload ? () => payload : undefined,
		options,
	}
}

// ==========================================
// Step Helpers
// ==========================================

/**
 * Create a job step with conditional execution
 */
export function jobIf(
	condition: (context: StepContext) => boolean,
	jobType: string,
	payload?: JobPayload | ((context: StepContext) => JobPayload),
	options?: JobOptions
): JobStep {
	const step = job(jobType, payload, options)
	return {
		...step,
		if: condition,
	}
}

/**
 * Create a delay step (alias for wait)
 */
export function delay(ms: number): WaitStep {
	return wait(ms)
}

/**
 * Create a step that sleeps until a specific time
 */
export function sleepUntil(date: Date | ((context: StepContext) => Date)): WaitStep {
	return wait(date)
}

/**
 * Create a retry wrapper for a step
 */
export function withRetry(
	step: JobStep,
	options: { maxRetries: number; retryDelay?: number }
): JobStep {
	return {
		...step,
		options: {
			...step.options,
			maxRetries: options.maxRetries,
			retryDelay: options.retryDelay
				? { type: 'fixed', delay: options.retryDelay }
				: undefined,
		},
	}
}

/**
 * Create a timeout wrapper for a step
 */
export function withTimeout(step: JobStep, timeoutMs: number): JobStep {
	return {
		...step,
		options: {
			...step.options,
			timeout: timeoutMs,
		},
	}
}

// ==========================================
// Workflow Composition
// ==========================================

/**
 * Compose multiple workflows sequentially
 */
export function sequence(...workflows: WorkflowDefinition[]): WorkflowStep[] {
	return workflows.map((workflow, index) => ({
		type: 'subworkflow' as const,
		name: `sequence-${index}-${workflow.type}`,
		workflowType: workflow.type,
	}))
}

/**
 * Fan-out pattern: Execute same job for multiple items
 */
export function fanOut(
	items: unknown[] | ((context: StepContext) => unknown[]),
	jobType: string,
	payloadMapper: (item: unknown, index: number) => JobPayload,
	options?: { maxConcurrency?: number }
): LoopStep {
	return loop(
		items,
		{
			type: 'job',
			name: `fanout-${jobType}`,
			jobType,
			payload: (ctx) => {
				// This is a simplified version - real implementation needs item context
				return {} as JobPayload
			},
		},
		{ maxConcurrency: options?.maxConcurrency }
	)
}

/**
 * Saga pattern: Define compensating actions for each step
 */
export interface SagaStep {
	forward: JobStep
	compensate: JobStep
}

export function saga(steps: SagaStep[]): WorkflowStep[] {
	// Build forward steps with compensation tracking
	const workflowSteps: WorkflowStep[] = []

	for (let i = 0; i < steps.length; i++) {
		const step = steps[i]!

		// Add forward step with error handling
		const forwardStep: JobStep = {
			...step.forward,
			name: `saga-forward-${i}-${step.forward.jobType}`,
			onComplete: (result, ctx) => {
				// Track completed step for potential compensation
				ctx.metadata.completedSagaSteps = [
					...(ctx.metadata.completedSagaSteps as number[] || []),
					i,
				]
				return result
			},
		}

		workflowSteps.push(forwardStep)
	}

	// Note: Actual saga compensation logic would be handled by the executor
	// This is a simplified client-side representation

	return workflowSteps
}

// ==========================================
// Validation
// ==========================================

/**
 * Validate a workflow definition
 */
export function validateWorkflow(workflow: WorkflowDefinition): string[] {
	const errors: string[] = []

	if (!workflow.type) {
		errors.push('Workflow type is required')
	}

	if (!workflow.steps || workflow.steps.length === 0) {
		errors.push('Workflow must have at least one step')
	}

	// Check for duplicate step names
	const stepNames = new Set<string>()
	const checkSteps = (steps: WorkflowStep[]) => {
		for (const step of steps) {
			if (stepNames.has(step.name)) {
				errors.push(`Duplicate step name: ${step.name}`)
			}
			stepNames.add(step.name)

			// Recursively check nested steps
			if (step.type === 'conditional') {
				checkSteps(step.then)
				if (step.else) checkSteps(step.else)
			} else if (step.type === 'parallel') {
				checkSteps(step.steps)
			} else if (step.type === 'loop') {
				checkSteps([step.step])
			}
		}
	}

	if (workflow.steps) {
		checkSteps(workflow.steps)
	}

	return errors
}
