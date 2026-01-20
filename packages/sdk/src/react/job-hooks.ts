/**
 * Background Job Hooks
 *
 * React hooks for Sylphx Platform background jobs.
 * Schedule one-time or cron jobs via the platform.
 *
 * Uses proper React Context pattern (no module singletons).
 */

'use client'

import { useCallback, useState, useEffect, useRef } from 'react'
import {
	useJobsContext,
	type SdkJobStatus as JobStatus,
	type SdkJobStatusFilter as JobStatusFilter,
	type SdkJob as Job,
	type ScheduleJobOptions,
	type CreateCronOptions,
	type ScheduleResult,
	type CronResult,
} from './services-context'

// Re-export types from services-context for convenience
export type { JobStatus, JobStatusFilter, Job, ScheduleJobOptions, CreateCronOptions, ScheduleResult, CronResult }

// ============================================
// useJobs
// ============================================

export interface UseJobsReturn {
	/** Check if background jobs are available */
	isAvailable: () => Promise<boolean>
	/** Schedule a one-time job */
	schedule: (options: ScheduleJobOptions) => Promise<ScheduleResult>
	/** Create a recurring cron job */
	createCron: (options: CreateCronOptions) => Promise<CronResult>
	/** Pause a cron job */
	pauseCron: (scheduleId: string) => Promise<boolean>
	/** Resume a paused cron job */
	resumeCron: (scheduleId: string) => Promise<boolean>
	/** Delete a cron job */
	deleteCron: (scheduleId: string) => Promise<boolean>
	/** Get job status */
	getJob: (jobId: string) => Promise<Job>
	/** List jobs */
	listJobs: (options?: {
		status?: JobStatusFilter
		type?: 'one-time' | 'cron'
		limit?: number
		offset?: number
	}) => Promise<Job[]>
	/** Cancel a pending/queued job */
	cancelJob: (jobId: string) => Promise<boolean>
	/** Whether a job operation is in progress */
	isLoading: boolean
	/** Last error */
	error: Error | null
}

/**
 * Hook for background job management
 *
 * @example
 * ```tsx
 * function JobScheduler() {
 *   const { schedule, createCron, isLoading } = useJobs()
 *
 *   const handleSchedule = async () => {
 *     // Schedule a job to run in 1 hour
 *     const result = await schedule({
 *       callbackUrl: 'https://myapp.com/api/process',
 *       payload: { orderId: '123' },
 *       delay: 3600, // 1 hour
 *       name: 'process-order',
 *     })
 *     console.log('Scheduled job:', result.jobId)
 *   }
 *
 *   const handleCron = async () => {
 *     // Create a job that runs every day at 9am
 *     const result = await createCron({
 *       callbackUrl: 'https://myapp.com/api/daily-report',
 *       cron: '0 9 * * *',
 *       name: 'daily-report',
 *     })
 *     console.log('Created cron:', result.scheduleId)
 *   }
 *
 *   return (
 *     <div>
 *       <button onClick={handleSchedule} disabled={isLoading}>
 *         Schedule Job
 *       </button>
 *       <button onClick={handleCron} disabled={isLoading}>
 *         Create Cron
 *       </button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useJobs(): UseJobsReturn {
	const ctx = useJobsContext()
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	const isAvailable = useCallback(async (): Promise<boolean> => {
		try {
			const status = await ctx.checkStatus()
			return status.available
		} catch {
			return false
		}
	}, [ctx])

	const schedule = useCallback(
		async (options: ScheduleJobOptions): Promise<ScheduleResult> => {
			setIsLoading(true)
			setError(null)

			try {
				return await ctx.schedule(options)
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Failed to schedule job')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx]
	)

	const createCron = useCallback(
		async (options: CreateCronOptions): Promise<CronResult> => {
			setIsLoading(true)
			setError(null)

			try {
				return await ctx.createCron(options)
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Failed to create cron job')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx]
	)

	const pauseCron = useCallback(
		async (scheduleId: string): Promise<boolean> => {
			setIsLoading(true)
			setError(null)

			try {
				return await ctx.pauseCron(scheduleId)
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Failed to pause cron')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx]
	)

	const resumeCron = useCallback(
		async (scheduleId: string): Promise<boolean> => {
			setIsLoading(true)
			setError(null)

			try {
				return await ctx.resumeCron(scheduleId)
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Failed to resume cron')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx]
	)

	const deleteCron = useCallback(
		async (scheduleId: string): Promise<boolean> => {
			setIsLoading(true)
			setError(null)

			try {
				return await ctx.deleteCron(scheduleId)
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Failed to delete cron')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx]
	)

	const getJob = useCallback(
		async (jobId: string): Promise<Job> => {
			try {
				return await ctx.getJob(jobId)
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Failed to get job')
				setError(error)
				throw error
			}
		},
		[ctx]
	)

	const listJobs = useCallback(
		async (
			options: {
				status?: JobStatusFilter
				type?: 'one-time' | 'cron'
				limit?: number
				offset?: number
			} = {}
		): Promise<Job[]> => {
			try {
				const result = await ctx.listJobs(options)
				return result.jobs
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Failed to list jobs')
				setError(error)
				throw error
			}
		},
		[ctx]
	)

	const cancelJob = useCallback(
		async (jobId: string): Promise<boolean> => {
			setIsLoading(true)
			setError(null)

			try {
				return await ctx.cancelJob(jobId)
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Failed to cancel job')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx]
	)

	return {
		isAvailable,
		schedule,
		createCron,
		pauseCron,
		resumeCron,
		deleteCron,
		getJob,
		listJobs,
		cancelJob,
		isLoading,
		error,
	}
}

// ============================================
// useJobProgress
// ============================================

export type JobPhase = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface JobProgress {
	/** Current phase of the job */
	phase: JobPhase
	/** Progress percentage (0-100), estimated based on phase */
	progress: number
	/** Whether the job is still in progress */
	isInProgress: boolean
	/** Whether the job completed successfully */
	isComplete: boolean
	/** Whether the job failed */
	isFailed: boolean
	/** Time elapsed since job was scheduled (ms) */
	elapsedMs: number
	/** Estimated time remaining (ms), null if unknown */
	estimatedRemainingMs: number | null
}

export interface UseJobProgressOptions {
	/** Polling interval in ms (default: 2000) */
	pollInterval?: number
	/** Stop polling when job completes (default: true) */
	stopOnComplete?: boolean
	/** Maximum poll attempts before stopping (default: 100) */
	maxPolls?: number
	/** Callback when job completes successfully */
	onComplete?: (job: Job) => void
	/** Callback when job fails */
	onFailed?: (job: Job, error: string | null) => void
	/** Callback when job status changes */
	onStatusChange?: (job: Job, previousStatus: JobStatus | null) => void
}

export interface UseJobProgressReturn {
	/** Current job data (null until first fetch) */
	job: Job | null
	/** Progress information */
	progress: JobProgress
	/** Whether currently fetching job status */
	isPolling: boolean
	/** Last error */
	error: Error | null
	/** Start polling for job progress */
	start: () => void
	/** Stop polling */
	stop: () => void
	/** Manually refresh job status */
	refresh: () => Promise<void>
}

/**
 * Hook for tracking job progress with polling
 *
 * Polls the job status at a configurable interval and provides
 * progress information including phase, percentage, and timing.
 *
 * @example
 * ```tsx
 * function JobTracker({ jobId }: { jobId: string }) {
 *   const { job, progress, isPolling, error } = useJobProgress(jobId, {
 *     pollInterval: 1000,
 *     onComplete: (job) => console.log('Job completed!', job),
 *     onFailed: (job, error) => console.error('Job failed:', error),
 *   })
 *
 *   if (error) return <div>Error: {error.message}</div>
 *   if (!job) return <div>Loading...</div>
 *
 *   return (
 *     <div>
 *       <p>Status: {progress.phase}</p>
 *       <progress value={progress.progress} max={100} />
 *       <p>{progress.progress}% complete</p>
 *       {progress.isInProgress && (
 *         <p>Elapsed: {Math.round(progress.elapsedMs / 1000)}s</p>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With schedule + tracking
 * function ScheduleAndTrack() {
 *   const { schedule } = useJobs()
 *   const [jobId, setJobId] = useState<string | null>(null)
 *
 *   // Only start tracking when we have a jobId
 *   const { progress, job } = useJobProgress(jobId, {
 *     onComplete: () => toast.success('Job completed!'),
 *   })
 *
 *   const handleSchedule = async () => {
 *     const result = await schedule({
 *       callbackUrl: '/api/process',
 *       payload: { data: 'test' },
 *     })
 *     setJobId(result.jobId)
 *   }
 *
 *   return (
 *     <div>
 *       <button onClick={handleSchedule}>Schedule Job</button>
 *       {jobId && (
 *         <div>
 *           <p>Progress: {progress.progress}%</p>
 *           {progress.isComplete && <p>✓ Done!</p>}
 *         </div>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */
export function useJobProgress(
	jobId: string | null | undefined,
	options: UseJobProgressOptions = {}
): UseJobProgressReturn {
	const {
		pollInterval = 2000,
		stopOnComplete = true,
		maxPolls = 100,
		onComplete,
		onFailed,
		onStatusChange,
	} = options

	const ctx = useJobsContext()
	const [job, setJob] = useState<Job | null>(null)
	const [isPolling, setIsPolling] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	const pollCountRef = useRef(0)
	const previousStatusRef = useRef<JobStatus | null>(null)
	const startTimeRef = useRef<number | null>(null)
	const intervalRef = useRef<NodeJS.Timeout | null>(null)

	// Calculate progress based on job status
	const calculateProgress = useCallback((job: Job | null): JobProgress => {
		const now = Date.now()
		const startTime = startTimeRef.current ?? now

		if (!job) {
			return {
				phase: 'pending',
				progress: 0,
				isInProgress: false,
				isComplete: false,
				isFailed: false,
				elapsedMs: 0,
				estimatedRemainingMs: null,
			}
		}

		const status = job.status as JobStatus
		const elapsedMs = now - startTime

		// Map status to phase and progress
		let phase: JobPhase
		let progress: number
		let isInProgress: boolean
		let isComplete: boolean
		let isFailed: boolean

		switch (status) {
			case 'pending':
				phase = 'pending'
				progress = 10
				isInProgress = true
				isComplete = false
				isFailed = false
				break
			case 'queued':
				phase = 'queued'
				progress = 25
				isInProgress = true
				isComplete = false
				isFailed = false
				break
			case 'running':
				phase = 'running'
				progress = 50 // Could be enhanced with actual progress from job metadata
				isInProgress = true
				isComplete = false
				isFailed = false
				break
			case 'completed':
				phase = 'completed'
				progress = 100
				isInProgress = false
				isComplete = true
				isFailed = false
				break
			case 'failed':
				phase = 'failed'
				progress = 0
				isInProgress = false
				isComplete = false
				isFailed = true
				break
			case 'cancelled':
				phase = 'cancelled'
				progress = 0
				isInProgress = false
				isComplete = false
				isFailed = false
				break
			default:
				phase = 'pending'
				progress = 0
				isInProgress = true
				isComplete = false
				isFailed = false
		}

		// Estimate remaining time based on average completion time
		// This is a simple estimate; could be enhanced with historical data
		let estimatedRemainingMs: number | null = null
		if (isInProgress && elapsedMs > 0 && progress > 0 && progress < 100) {
			const progressRate = progress / elapsedMs
			const remainingProgress = 100 - progress
			estimatedRemainingMs = Math.round(remainingProgress / progressRate)
		}

		return {
			phase,
			progress,
			isInProgress,
			isComplete,
			isFailed,
			elapsedMs,
			estimatedRemainingMs,
		}
	}, [])

	// Fetch job status
	const fetchJob = useCallback(async (): Promise<Job | null> => {
		if (!jobId) return null

		try {
			const jobData = await ctx.getJob(jobId)
			return jobData
		} catch (err) {
			const fetchError = err instanceof Error ? err : new Error('Failed to fetch job')
			setError(fetchError)
			return null
		}
	}, [ctx, jobId])

	// Polling logic
	const poll = useCallback(async () => {
		pollCountRef.current++

		const jobData = await fetchJob()
		if (!jobData) return

		// Check for status change
		const currentStatus = jobData.status as JobStatus
		if (previousStatusRef.current !== currentStatus) {
			onStatusChange?.(jobData, previousStatusRef.current)
			previousStatusRef.current = currentStatus
		}

		setJob(jobData)

		// Check for completion/failure
		if (currentStatus === 'completed') {
			onComplete?.(jobData)
			if (stopOnComplete) {
				setIsPolling(false)
				if (intervalRef.current) {
					clearInterval(intervalRef.current)
					intervalRef.current = null
				}
			}
		} else if (currentStatus === 'failed') {
			onFailed?.(jobData, jobData.lastError ?? null)
			if (stopOnComplete) {
				setIsPolling(false)
				if (intervalRef.current) {
					clearInterval(intervalRef.current)
					intervalRef.current = null
				}
			}
		} else if (currentStatus === 'cancelled') {
			if (stopOnComplete) {
				setIsPolling(false)
				if (intervalRef.current) {
					clearInterval(intervalRef.current)
					intervalRef.current = null
				}
			}
		}

		// Check max polls
		if (pollCountRef.current >= maxPolls) {
			setIsPolling(false)
			if (intervalRef.current) {
				clearInterval(intervalRef.current)
				intervalRef.current = null
			}
		}
	}, [fetchJob, maxPolls, onComplete, onFailed, onStatusChange, stopOnComplete])

	// Start polling
	const start = useCallback(() => {
		if (!jobId || isPolling) return

		setIsPolling(true)
		setError(null)
		pollCountRef.current = 0
		startTimeRef.current = Date.now()

		// Initial fetch
		poll()

		// Start interval
		intervalRef.current = setInterval(poll, pollInterval)
	}, [jobId, isPolling, poll, pollInterval])

	// Stop polling
	const stop = useCallback(() => {
		setIsPolling(false)
		if (intervalRef.current) {
			clearInterval(intervalRef.current)
			intervalRef.current = null
		}
	}, [])

	// Manual refresh
	const refresh = useCallback(async () => {
		const jobData = await fetchJob()
		if (jobData) {
			setJob(jobData)
		}
	}, [fetchJob])

	// Auto-start polling when jobId changes
	useEffect(() => {
		if (jobId) {
			start()
		} else {
			stop()
			setJob(null)
			previousStatusRef.current = null
		}

		return () => {
			stop()
		}
	}, [jobId]) // eslint-disable-line react-hooks/exhaustive-deps

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current)
			}
		}
	}, [])

	const progress = calculateProgress(job)

	return {
		job,
		progress,
		isPolling,
		error,
		start,
		stop,
		refresh,
	}
}

// ============================================
// useScheduleWithProgress
// ============================================

export interface UseScheduleWithProgressOptions extends UseJobProgressOptions {
	/** Auto-start tracking after scheduling */
	autoStart?: boolean
}

export interface UseScheduleWithProgressReturn {
	/** Schedule a job and start tracking */
	scheduleAndTrack: (options: ScheduleJobOptions) => Promise<ScheduleResult>
	/** Current job being tracked */
	job: Job | null
	/** Progress information */
	progress: JobProgress
	/** Job ID of the scheduled job */
	jobId: string | null
	/** Whether scheduling is in progress */
	isScheduling: boolean
	/** Whether polling job status */
	isPolling: boolean
	/** Last error */
	error: Error | null
	/** Reset the tracker to initial state */
	reset: () => void
}

/**
 * Convenience hook that combines scheduling and progress tracking
 *
 * @example
 * ```tsx
 * function ProcessOrder({ orderId }: { orderId: string }) {
 *   const {
 *     scheduleAndTrack,
 *     progress,
 *     isScheduling,
 *     isPolling,
 *     reset,
 *   } = useScheduleWithProgress({
 *     onComplete: () => toast.success('Order processed!'),
 *     onFailed: (job, error) => toast.error(`Failed: ${error}`),
 *   })
 *
 *   const handleProcess = async () => {
 *     await scheduleAndTrack({
 *       callbackUrl: '/api/process-order',
 *       payload: { orderId },
 *       name: `process-order-${orderId}`,
 *     })
 *   }
 *
 *   return (
 *     <div>
 *       <button onClick={handleProcess} disabled={isScheduling || isPolling}>
 *         {isScheduling ? 'Scheduling...' : isPolling ? 'Processing...' : 'Process Order'}
 *       </button>
 *
 *       {progress.isInProgress && (
 *         <div>
 *           <progress value={progress.progress} max={100} />
 *           <span>{progress.phase}</span>
 *         </div>
 *       )}
 *
 *       {progress.isComplete && (
 *         <div>
 *           <p>✓ Order processed successfully!</p>
 *           <button onClick={reset}>Process Another</button>
 *         </div>
 *       )}
 *
 *       {progress.isFailed && (
 *         <div>
 *           <p>❌ Processing failed</p>
 *           <button onClick={reset}>Try Again</button>
 *         </div>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */
export function useScheduleWithProgress(
	options: UseScheduleWithProgressOptions = {}
): UseScheduleWithProgressReturn {
	const { autoStart = true, ...progressOptions } = options

	const { schedule } = useJobs()
	const [jobId, setJobId] = useState<string | null>(null)
	const [isScheduling, setIsScheduling] = useState(false)
	const [scheduleError, setScheduleError] = useState<Error | null>(null)

	const { job, progress, isPolling, error: progressError, start } = useJobProgress(
		autoStart ? jobId : null,
		progressOptions
	)

	const scheduleAndTrack = useCallback(
		async (scheduleOptions: ScheduleJobOptions): Promise<ScheduleResult> => {
			setIsScheduling(true)
			setScheduleError(null)

			try {
				const result = await schedule(scheduleOptions)
				setJobId(result.jobId)

				// If autoStart is false, manually start polling
				if (!autoStart) {
					start()
				}

				return result
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Failed to schedule job')
				setScheduleError(error)
				throw error
			} finally {
				setIsScheduling(false)
			}
		},
		[schedule, autoStart, start]
	)

	const reset = useCallback(() => {
		setJobId(null)
		setIsScheduling(false)
		setScheduleError(null)
	}, [])

	return {
		scheduleAndTrack,
		job,
		progress,
		jobId,
		isScheduling,
		isPolling,
		error: scheduleError ?? progressError,
		reset,
	}
}
