/**
 * Jobs Types
 *
 * Type definitions for background job scheduling and workflows.
 * Supports durable execution, retries, and workflow composition.
 */

// ==========================================
// Core Types
// ==========================================

/** Job status */
export type JobStatus =
	| 'pending'
	| 'scheduled'
	| 'running'
	| 'completed'
	| 'failed'
	| 'cancelled'
	| 'retrying'
	| 'dead' // In DLQ

/** Job priority */
export type JobPriority = 'low' | 'normal' | 'high' | 'critical'

/** Job payload - must be JSON serializable */
export type JobPayload = Record<string, unknown>

/** Job result */
export type JobResult = unknown

// ==========================================
// Job Definition
// ==========================================

/** Job definition */
export interface JobDefinition<TPayload extends JobPayload = JobPayload, TResult = JobResult> {
	/** Unique job type identifier */
	type: string
	/** Human-readable name */
	name?: string
	/** Description */
	description?: string
	/** Job handler (server-side) */
	handler?: (payload: TPayload, context: JobContext) => Promise<TResult>
	/** Default options */
	defaults?: JobOptions
	/** Validation schema */
	validate?: (payload: TPayload) => boolean | string
}

/** Job options */
export interface JobOptions {
	/** Priority */
	priority?: JobPriority
	/** Max retry attempts */
	maxRetries?: number
	/** Retry delay strategy */
	retryDelay?: RetryDelayStrategy
	/** Timeout in ms */
	timeout?: number
	/** Delay execution */
	delay?: number | Date
	/** Cron schedule */
	cron?: string
	/** Unique job ID (for deduplication) */
	uniqueId?: string
	/** Unique key TTL in ms (how long to prevent duplicates) */
	uniqueTtl?: number
	/** Dead letter queue options */
	dlq?: DLQOptions
	/** Tags for filtering */
	tags?: string[]
	/** Custom metadata */
	metadata?: Record<string, unknown>
}

/** Retry delay strategy */
export type RetryDelayStrategy =
	| { type: 'fixed'; delay: number }
	| { type: 'exponential'; base: number; maxDelay?: number }
	| { type: 'linear'; initial: number; increment: number; maxDelay?: number }
	| { type: 'custom'; delays: number[] }

/** DLQ options */
export interface DLQOptions {
	/** Enable DLQ */
	enabled?: boolean
	/** Max age before auto-discard (ms) */
	maxAge?: number
	/** Auto-retry from DLQ */
	autoRetry?: boolean
	/** Auto-retry interval (ms) */
	autoRetryInterval?: number
	/** Max auto-retry attempts from DLQ */
	maxAutoRetries?: number
}

// ==========================================
// Job Instance
// ==========================================

/** Job instance */
export interface Job<TPayload extends JobPayload = JobPayload, TResult = JobResult> {
	/** Unique job ID */
	id: string
	/** Job type */
	type: string
	/** Job payload */
	payload: TPayload
	/** Current status */
	status: JobStatus
	/** Priority */
	priority: JobPriority
	/** Created timestamp */
	createdAt: number
	/** Scheduled execution time */
	scheduledAt?: number
	/** Started timestamp */
	startedAt?: number
	/** Completed timestamp */
	completedAt?: number
	/** Current attempt number */
	attempt: number
	/** Max retry attempts */
	maxRetries: number
	/** Job result (if completed) */
	result?: TResult
	/** Error message (if failed) */
	error?: string
	/** Error stack trace */
	errorStack?: string
	/** Progress (0-100) */
	progress?: number
	/** Progress message */
	progressMessage?: string
	/** Tags */
	tags?: string[]
	/** Custom metadata */
	metadata?: Record<string, unknown>
	/** Parent job ID (for workflows) */
	parentId?: string
	/** Workflow step name (for workflows) */
	stepName?: string
}

/** Job context passed to handlers */
export interface JobContext {
	/** Job ID */
	jobId: string
	/** Current attempt number */
	attempt: number
	/** Signal for cancellation */
	signal?: AbortSignal
	/** Update progress */
	setProgress: (progress: number, message?: string) => void
	/** Log message */
	log: (message: string, level?: 'info' | 'warn' | 'error') => void
	/** Check if should continue (for long-running jobs) */
	shouldContinue: () => boolean
	/** Schedule a child job */
	scheduleChild: <T extends JobPayload>(type: string, payload: T, options?: JobOptions) => Promise<string>
	/** Sleep (durable) */
	sleep: (ms: number) => Promise<void>
}

// ==========================================
// Workflow Types
// ==========================================

/** Workflow definition */
export interface WorkflowDefinition<TInput extends JobPayload = JobPayload, TOutput = JobResult> {
	/** Unique workflow type */
	type: string
	/** Human-readable name */
	name?: string
	/** Description */
	description?: string
	/** Workflow steps */
	steps: WorkflowStep[]
	/** Default options */
	defaults?: WorkflowOptions
	/** On complete callback */
	onComplete?: (result: TOutput) => void
	/** On error callback */
	onError?: (error: Error, step: string) => void
}

/** Workflow options */
export interface WorkflowOptions extends JobOptions {
	/** Continue on step failure */
	continueOnFailure?: boolean
	/** Max concurrent steps (for parallel) */
	maxConcurrency?: number
}

/** Workflow step */
export type WorkflowStep =
	| JobStep
	| ConditionalStep
	| ParallelStep
	| LoopStep
	| WaitStep
	| SubworkflowStep

/** Job step */
export interface JobStep {
	type: 'job'
	name: string
	/** Job type to execute */
	jobType: string
	/** Payload transform (receives workflow input + previous results) */
	payload?: (context: StepContext) => JobPayload
	/** Step options */
	options?: JobOptions
	/** Condition to run this step */
	if?: (context: StepContext) => boolean
	/** On complete transform */
	onComplete?: (result: JobResult, context: StepContext) => unknown
}

/** Conditional step */
export interface ConditionalStep {
	type: 'conditional'
	name: string
	/** Condition function */
	condition: (context: StepContext) => boolean
	/** Steps if condition is true */
	then: WorkflowStep[]
	/** Steps if condition is false */
	else?: WorkflowStep[]
}

/** Parallel step */
export interface ParallelStep {
	type: 'parallel'
	name: string
	/** Steps to run in parallel */
	steps: WorkflowStep[]
	/** Wait for all or any */
	waitFor?: 'all' | 'any'
	/** Max concurrent */
	maxConcurrency?: number
}

/** Loop step */
export interface LoopStep {
	type: 'loop'
	name: string
	/** Array to iterate over, or function to get items */
	items: unknown[] | ((context: StepContext) => unknown[])
	/** Step to execute for each item */
	step: WorkflowStep
	/** Max concurrent iterations */
	maxConcurrency?: number
	/** Break condition */
	breakIf?: (item: unknown, index: number, context: StepContext) => boolean
}

/** Wait step */
export interface WaitStep {
	type: 'wait'
	name: string
	/** Duration in ms, Date, or function */
	until: number | Date | ((context: StepContext) => number | Date)
}

/** Sub-workflow step */
export interface SubworkflowStep {
	type: 'subworkflow'
	name: string
	/** Workflow type to execute */
	workflowType: string
	/** Payload transform */
	payload?: (context: StepContext) => JobPayload
	/** Options */
	options?: WorkflowOptions
}

/** Step context */
export interface StepContext {
	/** Workflow input */
	input: JobPayload
	/** Results from previous steps */
	results: Record<string, JobResult>
	/** Current step name */
	currentStep: string
	/** Workflow metadata */
	metadata: Record<string, unknown>
}

// ==========================================
// Workflow Instance
// ==========================================

/** Workflow instance */
export interface Workflow<TInput extends JobPayload = JobPayload, TOutput = JobResult> {
	/** Unique workflow ID */
	id: string
	/** Workflow type */
	type: string
	/** Input payload */
	input: TInput
	/** Current status */
	status: JobStatus
	/** Created timestamp */
	createdAt: number
	/** Started timestamp */
	startedAt?: number
	/** Completed timestamp */
	completedAt?: number
	/** Current step name */
	currentStep?: string
	/** Step results */
	stepResults: Record<string, JobResult>
	/** Step statuses */
	stepStatuses: Record<string, JobStatus>
	/** Final output */
	output?: TOutput
	/** Error */
	error?: string
	/** Metadata */
	metadata?: Record<string, unknown>
}

// ==========================================
// Scheduling
// ==========================================

/** Cron schedule */
export interface CronSchedule {
	/** Cron expression */
	expression: string
	/** Timezone */
	timezone?: string
	/** Start date */
	startAt?: Date
	/** End date */
	endAt?: Date
	/** Max runs */
	maxRuns?: number
}

/** Scheduled job */
export interface ScheduledJob {
	/** Schedule ID */
	id: string
	/** Job type */
	type: string
	/** Job payload */
	payload: JobPayload
	/** Cron schedule */
	cron: CronSchedule
	/** Current status */
	status: 'active' | 'paused' | 'completed'
	/** Run count */
	runCount: number
	/** Next run timestamp */
	nextRunAt?: number
	/** Last run timestamp */
	lastRunAt?: number
	/** Created timestamp */
	createdAt: number
}

// ==========================================
// Events
// ==========================================

/** Job event */
export type JobEvent =
	| { type: 'job:created'; job: Job }
	| { type: 'job:started'; job: Job }
	| { type: 'job:progress'; job: Job; progress: number; message?: string }
	| { type: 'job:completed'; job: Job; result: JobResult }
	| { type: 'job:failed'; job: Job; error: string }
	| { type: 'job:retrying'; job: Job; attempt: number }
	| { type: 'job:dead'; job: Job }
	| { type: 'job:cancelled'; job: Job }

/** Workflow event */
export type WorkflowEvent =
	| { type: 'workflow:started'; workflow: Workflow }
	| { type: 'workflow:step:started'; workflow: Workflow; step: string }
	| { type: 'workflow:step:completed'; workflow: Workflow; step: string; result: JobResult }
	| { type: 'workflow:step:failed'; workflow: Workflow; step: string; error: string }
	| { type: 'workflow:completed'; workflow: Workflow; output: JobResult }
	| { type: 'workflow:failed'; workflow: Workflow; error: string }

// ==========================================
// Configuration
// ==========================================

/** Jobs client configuration */
export interface JobsConfig {
	/** API endpoint */
	apiEndpoint?: string
	/** API key */
	apiKey?: string
	/** Default job options */
	defaultOptions?: JobOptions
	/** Enable debug logging */
	debug?: boolean
	/** Event callbacks */
	onJobEvent?: (event: JobEvent) => void
	onWorkflowEvent?: (event: WorkflowEvent) => void
}

/** Default configuration */
export const DEFAULT_JOBS_CONFIG: Required<
	Pick<JobsConfig, 'defaultOptions' | 'debug'>
> = {
	defaultOptions: {
		priority: 'normal',
		maxRetries: 3,
		retryDelay: { type: 'exponential', base: 1000, maxDelay: 60000 },
		timeout: 30000,
		dlq: {
			enabled: true,
			maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
		},
	},
	debug: false,
}

/** Default retry delays (ms) */
export const DEFAULT_RETRY_DELAYS = [1000, 5000, 15000, 30000, 60000]
