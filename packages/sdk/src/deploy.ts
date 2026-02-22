/**
 * Deploy Functions
 *
 * Pure functions for managing app deployments, environment variables,
 * and custom domains via the Platform Deploy API.
 *
 * Requires secret key authentication (`sk_*`).
 *
 * @example
 * ```ts
 * import { createConfig, triggerDeploy, getDeployStatus } from '@sylphx/sdk'
 *
 * const config = createConfig({ secretKey: process.env.SYLPHX_SECRET_KEY! })
 *
 * // Trigger a deployment
 * const deploy = await triggerDeploy(config, { envId: 'env_prod_xxx' })
 *
 * // Poll for completion
 * const status = await getDeployStatus(config, deploy.envId)
 * console.log(status.status) // 'building' | 'deploying' | 'success' | 'failed'
 * ```
 */

import { type SylphxConfig, callApi } from "./config";

// ============================================================================
// Types
// ============================================================================

export type DeployStatus =
	| "queued"
	| "building"
	| "deploying"
	| "success"
	| "failed"
	| "cancelled";

export interface DeployInfo {
	/** Deployment ID */
	deploymentId: string;
	/** Environment ID */
	envId: string;
	/** Current deployment status */
	status: DeployStatus;
	/** Deployment URL */
	url?: string;
	/** Git commit SHA */
	commitSha?: string;
	/** Git branch */
	branch?: string;
	/** Deployment started at (ISO timestamp) */
	startedAt?: string;
	/** Deployment completed at (ISO timestamp) */
	completedAt?: string;
	/** Error message if failed */
	error?: string;
}

export interface TriggerDeployRequest {
	/** Environment ID to deploy */
	envId: string;
	/** Force rebuild without cache */
	forceRebuild?: boolean;
}

export interface RollbackDeployRequest {
	/** Environment ID to rollback */
	envId: string;
	/** Deployment ID to rollback to */
	deploymentId: string;
}

export interface EnvVar {
	/** Environment variable key */
	key: string;
	/** Environment variable value */
	value: string;
	/** Whether value is sensitive (masked in logs) */
	sensitive?: boolean;
}

export interface SetEnvVarRequest {
	/** Environment variable key */
	key: string;
	/** Environment variable value */
	value: string;
	/** Whether value is sensitive/secret */
	sensitive?: boolean;
}

export interface CustomDomain {
	/** Domain name */
	domain: string;
	/** Verification status */
	status: "pending" | "verifying" | "active" | "failed";
	/** DNS records required for verification */
	dnsRecords?: Array<{
		type: string;
		name: string;
		value: string;
	}>;
}

export interface AddDomainRequest {
	/** Domain name to add */
	domain: string;
}

export interface DeployHistoryResponse {
	/** List of past deployments */
	deployments: DeployInfo[];
}

export interface BuildLog {
	/** Log line text */
	text: string;
	/** Log timestamp (ISO) */
	timestamp?: string;
	/** Log level */
	level?: "info" | "warn" | "error";
}

export interface BuildLogHistoryResponse {
	/** Log lines */
	logs: BuildLog[];
}

// ============================================================================
// Functions — Deployments
// ============================================================================

/**
 * Trigger a new deployment for an environment.
 *
 * @example
 * ```ts
 * const deploy = await triggerDeploy(config, { envId: 'env_prod_xxx' })
 * console.log(`Deployment ${deploy.deploymentId} started`)
 * ```
 */
export async function triggerDeploy(
	config: SylphxConfig,
	request: TriggerDeployRequest,
): Promise<DeployInfo> {
	return callApi<DeployInfo>(
		config,
		`/sdk/deploy/trigger/${encodeURIComponent(request.envId)}`,
		{
			method: "POST",
			body:
				request.forceRebuild !== undefined
					? { forceRebuild: request.forceRebuild }
					: undefined,
		},
	);
}

/**
 * Get the current deployment status for an environment.
 *
 * @example
 * ```ts
 * const { status } = await getDeployStatus(config, 'env_prod_xxx')
 * if (status === 'success') {
 *   console.log('Deployment succeeded!')
 * }
 * ```
 */
export async function getDeployStatus(
	config: SylphxConfig,
	envId: string,
): Promise<DeployInfo> {
	return callApi<DeployInfo>(
		config,
		`/sdk/deploy/status/${encodeURIComponent(envId)}`,
		{ method: "GET" },
	);
}

/**
 * Get deployment history for an environment.
 *
 * @example
 * ```ts
 * const { deployments } = await getDeployHistory(config, 'env_prod_xxx')
 * const lastDeploy = deployments[0]
 * ```
 */
export async function getDeployHistory(
	config: SylphxConfig,
	envId: string,
): Promise<DeployHistoryResponse> {
	return callApi<DeployHistoryResponse>(
		config,
		`/sdk/deploy/history/${encodeURIComponent(envId)}`,
		{ method: "GET" },
	);
}

/**
 * Rollback an environment to a previous deployment.
 *
 * @example
 * ```ts
 * await rollbackDeploy(config, {
 *   envId: 'env_prod_xxx',
 *   deploymentId: 'dep_abc123',
 * })
 * ```
 */
export async function rollbackDeploy(
	config: SylphxConfig,
	request: RollbackDeployRequest,
): Promise<DeployInfo> {
	return callApi<DeployInfo>(
		config,
		`/sdk/deploy/rollback/${encodeURIComponent(request.envId)}`,
		{
			method: "POST",
			body: { deploymentId: request.deploymentId },
		},
	);
}

/**
 * Get stored build log history for an environment.
 *
 * For live log streaming during an active build, use the SSE endpoint
 * directly or the `useDeployLogs` React hook.
 *
 * @example
 * ```ts
 * const { logs } = await getBuildLogHistory(config, 'env_prod_xxx')
 * for (const log of logs) {
 *   console.log(log.text)
 * }
 * ```
 */
export async function getBuildLogHistory(
	config: SylphxConfig,
	envId: string,
): Promise<BuildLogHistoryResponse> {
	return callApi<BuildLogHistoryResponse>(
		config,
		`/sdk/deploy/logs/${encodeURIComponent(envId)}/history`,
		{ method: "GET" },
	);
}

// ============================================================================
// Functions — Environment Variables
// ============================================================================

/**
 * List environment variables for a deployment environment.
 *
 * Sensitive values are masked in the response.
 *
 * @example
 * ```ts
 * const envVars = await listEnvVars(config, 'env_prod_xxx')
 * ```
 */
export async function listEnvVars(
	config: SylphxConfig,
	envId: string,
): Promise<EnvVar[]> {
	const result = await callApi<{ envVars: EnvVar[] }>(
		config,
		`/sdk/deploy/envvars/${encodeURIComponent(envId)}`,
		{ method: "GET" },
	);
	return result.envVars;
}

/**
 * Set (create or update) an environment variable.
 *
 * @example
 * ```ts
 * await setEnvVar(config, 'env_prod_xxx', {
 *   key: 'DATABASE_URL',
 *   value: 'postgresql://...',
 *   sensitive: true,
 * })
 * ```
 */
export async function setEnvVar(
	config: SylphxConfig,
	envId: string,
	request: SetEnvVarRequest,
): Promise<EnvVar> {
	return callApi<EnvVar>(
		config,
		`/sdk/deploy/envvars/${encodeURIComponent(envId)}`,
		{
			method: "POST",
			body: request,
		},
	);
}

/**
 * Delete an environment variable.
 *
 * @example
 * ```ts
 * await deleteEnvVar(config, 'env_prod_xxx', 'DATABASE_URL')
 * ```
 */
export async function deleteEnvVar(
	config: SylphxConfig,
	envId: string,
	key: string,
): Promise<{ deleted: boolean }> {
	return callApi<{ deleted: boolean }>(
		config,
		`/sdk/deploy/envvars/${encodeURIComponent(envId)}/${encodeURIComponent(key)}`,
		{ method: "DELETE" },
	);
}

// ============================================================================
// Functions — Custom Domains
// ============================================================================

/**
 * List custom domains for a deployment environment.
 *
 * @example
 * ```ts
 * const domains = await listCustomDomains(config, 'env_prod_xxx')
 * ```
 */
export async function listCustomDomains(
	config: SylphxConfig,
	envId: string,
): Promise<CustomDomain[]> {
	const result = await callApi<{ domains: CustomDomain[] }>(
		config,
		`/sdk/deploy/domains/${encodeURIComponent(envId)}`,
		{ method: "GET" },
	);
	return result.domains;
}

/**
 * Add a custom domain to a deployment environment.
 *
 * After adding, you'll need to update your DNS records to complete verification.
 *
 * @example
 * ```ts
 * const domain = await addCustomDomain(config, 'env_prod_xxx', {
 *   domain: 'myapp.com',
 * })
 * // domain.dnsRecords contains the DNS records to add
 * ```
 */
export async function addCustomDomain(
	config: SylphxConfig,
	envId: string,
	request: AddDomainRequest,
): Promise<CustomDomain> {
	return callApi<CustomDomain>(
		config,
		`/sdk/deploy/domains/${encodeURIComponent(envId)}`,
		{
			method: "POST",
			body: request,
		},
	);
}

/**
 * Remove a custom domain from a deployment environment.
 *
 * @example
 * ```ts
 * await removeCustomDomain(config, 'env_prod_xxx', 'myapp.com')
 * ```
 */
export async function removeCustomDomain(
	config: SylphxConfig,
	envId: string,
	domain: string,
): Promise<{ removed: boolean }> {
	return callApi<{ removed: boolean }>(
		config,
		`/sdk/deploy/domains/${encodeURIComponent(envId)}/${encodeURIComponent(domain)}`,
		{ method: "DELETE" },
	);
}
