import { destCommerceCredential } from './credentials'
import {
	destCommerceOrigin,
	destIdentityOrigin,
	destJson,
	type IdentityUser,
} from './dest'

export type { IdentityUser }

export type EngagementLeaderboardResult = {
	entries: Array<{
		userId: string
		score: number
		rank: number
		displayName?: string
		value: number
		isCurrentUser?: boolean
	}>
	currentUserEntry?: {
		userId: string
		score: number
		rank: number
		displayName?: string
		value: number
		isCurrentUser?: boolean
	} | null
}

export type DestPeelConfig = {
	identityOrigin: string
	commerceOrigin: string
	credential?: string
}

export function createConfig(opts: { secretKey?: string; platformUrl?: string }): DestPeelConfig {
	return {
		identityOrigin: destIdentityOrigin(opts.platformUrl ?? process.env.IDENTITY_API_ORIGIN),
		commerceOrigin: destCommerceOrigin(process.env.COMMERCE_API_ORIGIN),
		credential: destCommerceCredential() ?? opts.secretKey,
	}
}

export type SylphxConfig = ReturnType<typeof createConfig>

function commerceOrigin(config?: DestPeelConfig): string {
	return config?.commerceOrigin ?? destCommerceOrigin(process.env.COMMERCE_API_ORIGIN)
}

function commerceCredential(config?: DestPeelConfig): string {
	const credential = config?.credential ?? destCommerceCredential()
	if (!credential) {
		throw new Error('Commerce dest requires COMMERCE_API_KEY or IDENTITY_API_KEY')
	}
	return credential
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined
}

function readText(value: unknown, keys: string[]): string | undefined {
	const record = asRecord(value)
	if (!record) return undefined
	for (const key of keys) {
		const candidate = record[key]
		if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
	}
	return undefined
}

function readNumber(value: unknown, keys: string[]): number | undefined {
	const record = asRecord(value)
	if (!record) return undefined
	for (const key of keys) {
		const candidate = record[key]
		if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate
		if (typeof candidate === 'string' && candidate.trim()) {
			const parsed = Number(candidate)
			if (Number.isFinite(parsed)) return parsed
		}
	}
	return undefined
}

export async function getLeaderboard(
	config: unknown,
	_board: string,
	userId?: string | null,
	opts?: { limit?: number },
): Promise<EngagementLeaderboardResult> {
	const destConfig = (config ?? {}) as DestPeelConfig
	const body = await destJson<{ entries?: unknown[] }>(
		commerceOrigin(destConfig),
		'/v1/sylphx.commerce.v1.EngagementService/ListEngagementLeaderboard',
		{
			method: 'POST',
			credential: commerceCredential(destConfig),
			body: {
				as_of: new Date().toISOString(),
				page: { limit: opts?.limit ?? 10 },
			},
		},
	)
	const entries = (body.entries ?? []).flatMap((entry, index) => {
		const record = asRecord(entry)
		if (!record) return []
		const id = readText(record, ['account_id', 'accountId', 'userId', 'user_id']) ?? ''
		if (!id) return []
		const value = readNumber(record, ['activity_count', 'activityCount', 'score', 'value']) ?? 0
		const rank = readNumber(record, ['rank']) ?? index + 1
		return [
			{
				userId: id,
				score: value,
				rank,
				displayName: readText(record, ['display_name', 'displayName']),
				value,
				isCurrentUser: Boolean(userId && id === userId),
			},
		]
	})
	return {
		entries,
		currentUserEntry: entries.find((entry) => entry.isCurrentUser) ?? null,
	}
}

export async function getSubscription(
	config: unknown,
	userId?: string,
): Promise<{ planSlug?: string; status?: string } | null> {
	if (!userId) return null
	const destConfig = (config ?? {}) as DestPeelConfig
	const policyId = process.env.COMMERCE_ENTITLEMENT_POLICY_ID?.trim() || 'premium'
	const body = await destJson<{
		entitlement?: {
			value?: { enabled?: boolean }
			policy_id?: string
			policyId?: string
		}
	}>(commerceOrigin(destConfig), '/v1/sylphx.commerce.v1.EntitlementService/EvaluateEntitlement', {
		method: 'POST',
		credential: commerceCredential(destConfig),
		body: {
			policy_id: policyId,
			subject_id: userId,
			as_of: new Date().toISOString(),
		},
	})
	const entitlement = asRecord(body.entitlement) ?? asRecord(body)
	if (!entitlement) return null
	const value = asRecord(entitlement.value)
	const enabled = value?.enabled === true
	return {
		planSlug: enabled
			? (readText(entitlement, ['entitlement_code', 'entitlementCode', 'planSlug']) ?? 'premium')
			: 'free',
		status: enabled ? 'active' : 'inactive',
	}
}

export function createSylphxMiddleware(_opts: Record<string, unknown>) {
	return async () => {
		const { NextResponse } = await import('next/server')
		return NextResponse.next()
	}
}
