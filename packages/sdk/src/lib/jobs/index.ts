/**
 * Jobs SDK
 *
 * Background job scheduling and workflow orchestration for Sylph platform.
 *
 * ## Features
 *
 * - **Job Scheduling** - Delayed, cron, and immediate execution
 * - **Durable Workflows** - Multi-step workflows with retry and rollback
 * - **Dead Letter Queue** - Failed job recovery and manual retry
 * - **Progress Tracking** - Real-time job progress updates
 * - **Type Safety** - Full TypeScript inference
 *
 * @example
 * ```typescript
 * import { createJobsClient, createWorkflow, job, parallel, wait } from '@sylphx/platform-sdk/jobs'
 *
 * // Create client
 * const jobs = createJobsClient({
 *   apiEndpoint: 'https://api.example.com/jobs',
 *   apiKey: 'your-api-key',
 * })
 *
 * // Schedule a simple job
 * await jobs.schedule('send-email', {
 *   to: 'user@example.com',
 *   subject: 'Welcome!',
 * })
 *
 * // Create a workflow
 * const onboarding = createWorkflow('user-onboarding')
 *   .name('User Onboarding')
 *   .step('create-account', job('create-user'))
 *   .step('send-welcome', job('send-email', (ctx) => ({
 *     to: ctx.results['create-account'].email,
 *     template: 'welcome',
 *   })))
 *   .step('wait-24h', wait(24 * 60 * 60 * 1000))
 *   .step('check-activity', job('check-user-activity'))
 *   .build()
 *
 * await jobs.startWorkflow(onboarding, { userId: '123' })
 * ```
 *
 * @module @sylphx/jobs
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
	// Core Types
	JobStatus,
	JobPriority,
	JobPayload,
	JobResult,
	JobDefinition,
	JobOptions,
	RetryDelayStrategy,
	DLQOptions,
	Job,
	JobContext,
	// Workflow Types
	WorkflowDefinition,
	WorkflowOptions,
	WorkflowStep,
	JobStep,
	ConditionalStep,
	ParallelStep,
	LoopStep,
	WaitStep,
	SubworkflowStep,
	StepContext,
	Workflow,
	// Scheduling Types
	CronSchedule,
	ScheduledJob,
	// Event Types
	JobEvent,
	WorkflowEvent,
	// Configuration
	JobsConfig,
} from "./types";

export { DEFAULT_JOBS_CONFIG, DEFAULT_RETRY_DELAYS } from "./types";

// ============================================================================
// Workflow Builder Exports
// ============================================================================

export {
	// Builder
	createWorkflow,
	WorkflowBuilder,
	// Step Builders
	job,
	conditional,
	parallel,
	loop,
	wait,
	subworkflow,
	// Step Helpers
	jobIf,
	delay,
	sleepUntil,
	withRetry,
	withTimeout,
	// Composition
	sequence,
	fanOut,
	saga,
	type SagaStep,
	// Validation
	validateWorkflow,
} from "./workflow-builder";

// ============================================================================
// Jobs Client
// ============================================================================

import type {
	CronSchedule,
	Job,
	JobEvent,
	JobOptions,
	JobPayload,
	JobResult,
	JobsConfig,
	ScheduledJob,
	Workflow,
	WorkflowDefinition,
	WorkflowEvent,
} from "./types";
import { DEFAULT_JOBS_CONFIG } from "./types";

/**
 * Jobs Client
 *
 * Client for scheduling jobs and workflows via the Sylph API.
 */
export class JobsClient {
	private config: JobsConfig;
	private eventHandlers: {
		job: ((event: JobEvent) => void)[];
		workflow: ((event: WorkflowEvent) => void)[];
	} = { job: [], workflow: [] };

	constructor(config: JobsConfig) {
		this.config = {
			...config,
			defaultOptions: {
				...DEFAULT_JOBS_CONFIG.defaultOptions,
				...config.defaultOptions,
			},
		};

		// Register initial event handlers
		if (config.onJobEvent) {
			this.eventHandlers.job.push(config.onJobEvent);
		}
		if (config.onWorkflowEvent) {
			this.eventHandlers.workflow.push(config.onWorkflowEvent);
		}
	}

	// =========================================================================
	// Job Scheduling
	// =========================================================================

	/**
	 * Schedule a job for execution
	 */
	async schedule<TPayload extends JobPayload = JobPayload>(
		type: string,
		payload: TPayload,
		options?: JobOptions,
	): Promise<Job<TPayload>> {
		const response = await this.fetch("/jobs", {
			method: "POST",
			body: JSON.stringify({
				type,
				payload,
				options: {
					...this.config.defaultOptions,
					...options,
				},
			}),
		});

		return response.job;
	}

	/**
	 * Schedule a job with delay
	 */
	async scheduleDelayed<TPayload extends JobPayload = JobPayload>(
		type: string,
		payload: TPayload,
		delay: number | Date,
		options?: JobOptions,
	): Promise<Job<TPayload>> {
		return this.schedule(type, payload, {
			...options,
			delay: delay instanceof Date ? delay.getTime() - Date.now() : delay,
		});
	}

	/**
	 * Schedule a recurring job (cron)
	 */
	async scheduleCron<TPayload extends JobPayload = JobPayload>(
		type: string,
		payload: TPayload,
		cron: string | CronSchedule,
		options?: JobOptions,
	): Promise<ScheduledJob> {
		const response = await this.fetch("/jobs/scheduled", {
			method: "POST",
			body: JSON.stringify({
				type,
				payload,
				cron: typeof cron === "string" ? { expression: cron } : cron,
				options: {
					...this.config.defaultOptions,
					...options,
				},
			}),
		});

		return response.scheduled;
	}

	// =========================================================================
	// Job Management
	// =========================================================================

	/**
	 * Get a job by ID
	 */
	async getJob<TPayload extends JobPayload = JobPayload, TResult = JobResult>(
		jobId: string,
	): Promise<Job<TPayload, TResult> | null> {
		const response = await this.fetch(`/jobs/${jobId}`);
		return response.job;
	}

	/**
	 * Cancel a job
	 */
	async cancelJob(jobId: string): Promise<boolean> {
		const response = await this.fetch(`/jobs/${jobId}/cancel`, {
			method: "POST",
		});
		return response.cancelled;
	}

	/**
	 * Retry a failed job
	 */
	async retryJob(jobId: string): Promise<Job> {
		const response = await this.fetch(`/jobs/${jobId}/retry`, {
			method: "POST",
		});
		return response.job;
	}

	/**
	 * List jobs with filters
	 */
	async listJobs(options?: {
		type?: string;
		status?: string;
		limit?: number;
		offset?: number;
	}): Promise<{ jobs: Job[]; total: number }> {
		const params = new URLSearchParams();
		if (options?.type) params.set("type", options.type);
		if (options?.status) params.set("status", options.status);
		if (options?.limit) params.set("limit", String(options.limit));
		if (options?.offset) params.set("offset", String(options.offset));

		const response = await this.fetch(`/jobs?${params.toString()}`);
		return { jobs: response.jobs, total: response.total };
	}

	// =========================================================================
	// Dead Letter Queue
	// =========================================================================

	/**
	 * List DLQ entries
	 */
	async listDLQ(options?: {
		limit?: number;
		offset?: number;
	}): Promise<{ entries: Job[]; total: number }> {
		const params = new URLSearchParams();
		if (options?.limit) params.set("limit", String(options.limit));
		if (options?.offset) params.set("offset", String(options.offset));

		const response = await this.fetch(`/jobs/dlq?${params.toString()}`);
		return { entries: response.entries, total: response.total };
	}

	/**
	 * Retry a DLQ entry
	 */
	async retryDLQEntry(entryId: string): Promise<Job> {
		const response = await this.fetch(`/jobs/dlq/${entryId}/retry`, {
			method: "POST",
		});
		return response.job;
	}

	/**
	 * Discard a DLQ entry
	 */
	async discardDLQEntry(entryId: string): Promise<boolean> {
		const response = await this.fetch(`/jobs/dlq/${entryId}`, {
			method: "DELETE",
		});
		return response.discarded;
	}

	// =========================================================================
	// Workflows
	// =========================================================================

	/**
	 * Start a workflow
	 */
	async startWorkflow<
		TInput extends JobPayload = JobPayload,
		TOutput = JobResult,
	>(
		workflow: WorkflowDefinition<TInput, TOutput>,
		input: TInput,
		options?: JobOptions,
	): Promise<Workflow<TInput, TOutput>> {
		const response = await this.fetch("/workflows", {
			method: "POST",
			body: JSON.stringify({
				workflow,
				input,
				options: {
					...this.config.defaultOptions,
					...options,
				},
			}),
		});

		return response.workflow;
	}

	/**
	 * Get a workflow by ID
	 */
	async getWorkflow<
		TInput extends JobPayload = JobPayload,
		TOutput = JobResult,
	>(workflowId: string): Promise<Workflow<TInput, TOutput> | null> {
		const response = await this.fetch(`/workflows/${workflowId}`);
		return response.workflow;
	}

	/**
	 * Cancel a workflow
	 */
	async cancelWorkflow(workflowId: string): Promise<boolean> {
		const response = await this.fetch(`/workflows/${workflowId}/cancel`, {
			method: "POST",
		});
		return response.cancelled;
	}

	/**
	 * List workflows
	 */
	async listWorkflows(options?: {
		type?: string;
		status?: string;
		limit?: number;
		offset?: number;
	}): Promise<{ workflows: Workflow[]; total: number }> {
		const params = new URLSearchParams();
		if (options?.type) params.set("type", options.type);
		if (options?.status) params.set("status", options.status);
		if (options?.limit) params.set("limit", String(options.limit));
		if (options?.offset) params.set("offset", String(options.offset));

		const response = await this.fetch(`/workflows?${params.toString()}`);
		return { workflows: response.workflows, total: response.total };
	}

	// =========================================================================
	// Scheduled Jobs
	// =========================================================================

	/**
	 * List scheduled jobs
	 */
	async listScheduledJobs(options?: {
		status?: "active" | "paused" | "completed";
		limit?: number;
		offset?: number;
	}): Promise<{ scheduled: ScheduledJob[]; total: number }> {
		const params = new URLSearchParams();
		if (options?.status) params.set("status", options.status);
		if (options?.limit) params.set("limit", String(options.limit));
		if (options?.offset) params.set("offset", String(options.offset));

		const response = await this.fetch(`/jobs/scheduled?${params.toString()}`);
		return { scheduled: response.scheduled, total: response.total };
	}

	/**
	 * Pause a scheduled job
	 */
	async pauseScheduledJob(scheduleId: string): Promise<ScheduledJob> {
		const response = await this.fetch(`/jobs/scheduled/${scheduleId}/pause`, {
			method: "POST",
		});
		return response.scheduled;
	}

	/**
	 * Resume a scheduled job
	 */
	async resumeScheduledJob(scheduleId: string): Promise<ScheduledJob> {
		const response = await this.fetch(`/jobs/scheduled/${scheduleId}/resume`, {
			method: "POST",
		});
		return response.scheduled;
	}

	/**
	 * Delete a scheduled job
	 */
	async deleteScheduledJob(scheduleId: string): Promise<boolean> {
		const response = await this.fetch(`/jobs/scheduled/${scheduleId}`, {
			method: "DELETE",
		});
		return response.deleted;
	}

	// =========================================================================
	// Events
	// =========================================================================

	/**
	 * Subscribe to job events
	 */
	onJobEvent(handler: (event: JobEvent) => void): () => void {
		this.eventHandlers.job.push(handler);
		return () => {
			const index = this.eventHandlers.job.indexOf(handler);
			if (index !== -1) {
				this.eventHandlers.job.splice(index, 1);
			}
		};
	}

	/**
	 * Subscribe to workflow events
	 */
	onWorkflowEvent(handler: (event: WorkflowEvent) => void): () => void {
		this.eventHandlers.workflow.push(handler);
		return () => {
			const index = this.eventHandlers.workflow.indexOf(handler);
			if (index !== -1) {
				this.eventHandlers.workflow.splice(index, 1);
			}
		};
	}

	// =========================================================================
	// Internal
	// =========================================================================

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Internal method, type safety enforced at public API level
	private async fetch(
		path: string,
		options?: RequestInit,
	): Promise<Record<string, any>> {
		const url = `${this.config.apiEndpoint}${path}`;
		const response = await fetch(url, {
			...options,
			headers: {
				"Content-Type": "application/json",
				...(this.config.apiKey && {
					Authorization: `Bearer ${this.config.apiKey}`,
				}),
				...options?.headers,
			},
		});

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ message: response.statusText }));
			throw new Error(error.message || `HTTP ${response.status}`);
		}

		return response.json();
	}

	private log(message: string, ...args: unknown[]): void {
		if (this.config.debug) {
			console.log(`[Jobs] ${message}`, ...args);
		}
	}
}

/**
 * Create a Jobs client instance
 */
export function createJobsClient(config: JobsConfig): JobsClient {
	return new JobsClient(config);
}
