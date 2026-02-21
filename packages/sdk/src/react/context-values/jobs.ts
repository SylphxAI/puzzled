/**
 * Jobs Context Value Factory
 *
 * Creates the Jobs context value for the SylphxProvider.
 * Provides job scheduling, cron management, and job status checking.
 */

import type { RestApiClient } from "../rest-client";
import type { JobsContextValue } from "../services-context";

// =============================================================================
// Types
// =============================================================================

export interface CreateJobsValueConfig {
	/** REST API client */
	api: RestApiClient;
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create Jobs context value.
 */
export function createJobsValue(
	config: CreateJobsValueConfig,
): JobsContextValue {
	const { api } = config;

	return {
		checkStatus: async () => {
			return await api.get("/jobs/status");
		},
		schedule: async (options) => {
			return await api.post("/jobs/schedule", options);
		},
		createCron: async (options) => {
			return await api.post("/jobs/cron", options);
		},
		pauseCron: async (scheduleId) => {
			const result = await api.post<{ success: boolean }>(
				`/jobs/cron/${scheduleId}/pause`,
			);
			return result.success;
		},
		resumeCron: async (scheduleId) => {
			const result = await api.post<{ success: boolean }>(
				`/jobs/cron/${scheduleId}/resume`,
			);
			return result.success;
		},
		deleteCron: async (scheduleId) => {
			const result = await api.del<{ success: boolean }>(
				`/jobs/cron/${scheduleId}`,
			);
			return result.success;
		},
		getJob: async (jobId) => {
			return await api.get(`/jobs/${jobId}`);
		},
		listJobs: async (options = {}) => {
			// Cast status to exclude 'cancelled' which isn't in API enum
			const status =
				options.status === "cancelled" ? undefined : options.status;
			return await api.get("/jobs", {
				status,
				limit: options.limit?.toString(),
				offset: options.offset?.toString(),
			});
		},
		cancelJob: async (jobId) => {
			const result = await api.post<{ success: boolean }>(
				`/jobs/${jobId}/cancel`,
			);
			return result.success;
		},
	};
}
