import { destCommerceCredential } from './credentials'
import {
	destCommerceOrigin,
	destEntitlementEnabled,
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
		credential: destCommerceCredential(),
	}
}

export type SylphxConfig = ReturnType<typeof createConfig>

function commerceOrigin(config?: DestPeelConfig): string {
	return config?.commerceOrigin ?? destCommerceOrigin(process.env.COMMERCE_API_ORIGIN)
}

function commerceCredential(config?: DestPeelConfig): string {
	const credential = config?.credential ?? destCommerceCredential()
	if (!credential) {
		throw new Error('Commerce dest requires COMMERCE_API_KEY')
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

function destAsOf(): string {
	return new Date().toISOString()
}

function destPage(limit: number) {
	return { page_size: limit, limit }
}

export async function getLeaderboard(
	config: unknown,
	board: string,
	userId?: string | null,
	opts?: { limit?: number },
): Promise<EngagementLeaderboardResult> {
	const destConfig = (config ?? {}) as DestPeelConfig
	const activityKind = board.trim()
	if (!activityKind) {
		throw new Error('commerce_leaderboard_board_required')
	}
	const body = await destJson<{ entries?: unknown[] }>(
		commerceOrigin(destConfig),
		'/v1/sylphx.commerce.v1.EngagementService/ListEngagementLeaderboard',
		{
			method: 'POST',
			credential: commerceCredential(destConfig),
			body: {
				as_of: destAsOf(),
				page: destPage(opts?.limit ?? 10),
				activity_kind: activityKind,
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

type CommerceSubscription = { planSlug?: string; status?: string }

type CommercePremium = {
	isPremium: boolean
	subscription: CommerceSubscription | null
}

async function evaluateCommerceEntitlement(
	userId: string,
	config: unknown | undefined,
	mode: 'throw' | 'fail-closed',
): Promise<CommercePremium> {
	const destConfig = (config ?? {}) as DestPeelConfig
	const credential =
		mode === 'throw'
			? commerceCredential(destConfig)
			: (destConfig.credential ?? destCommerceCredential())
	if (!credential) {
		return { isPremium: false, subscription: null }
	}
	const policyId = process.env.COMMERCE_ENTITLEMENT_POLICY_ID?.trim() || 'premium'
	const run = async (): Promise<CommercePremium> => {
		const body = await destJson<{
			entitlement?: {
				value?: { enabled?: boolean }
				entitlement_code?: string
				entitlementCode?: string
				planSlug?: string
			}
		}>(
			commerceOrigin(destConfig),
			'/v1/sylphx.commerce.v1.EntitlementService/EvaluateEntitlement',
			{
				method: 'POST',
				credential,
				body: {
					policy_id: policyId,
					subject_id: userId,
					as_of: new Date().toISOString(),
				},
			},
		)
		const enabled = destEntitlementEnabled(body)
		const entitlement = asRecord(body.entitlement) ?? asRecord(body)
		return {
			isPremium: enabled,
			subscription: entitlement
				? {
						planSlug: enabled
							? (readText(entitlement, ['entitlement_code', 'entitlementCode', 'planSlug']) ??
								'premium')
							: 'free',
						status: enabled ? 'active' : 'inactive',
					}
				: null,
		}
	}
	if (mode === 'throw') return run()
	try {
		return await run()
	} catch {
		return { isPremium: false, subscription: null }
	}
}

export async function getSubscription(
	config: unknown,
	userId?: string,
): Promise<CommerceSubscription | null> {
	if (!userId) return null
	return (await evaluateCommerceEntitlement(userId, config, 'throw')).subscription
}

/** Chrome + server premium: dest Commerce EvaluateEntitlement `enabled`. */
export async function getBilling(config: unknown, userId?: string): Promise<CommercePremium> {
	if (!userId) return { isPremium: false, subscription: null }
	return evaluateCommerceEntitlement(userId, config, 'fail-closed')
}

/** One premium writer: dest Commerce EvaluateEntitlement `enabled`. */
export async function isPremium(userId?: string, config?: unknown): Promise<boolean> {
	if (!userId) return false
	return (await evaluateCommerceEntitlement(userId, config, 'fail-closed')).isPremium
}

export type { Plan } from './dest'

function cadenceUnit(value: unknown): string {
	const record = asRecord(value)
	const unit = record?.unit ?? record?.cadence
	if (typeof unit === 'string') return unit.toUpperCase()
	if (typeof unit === 'number') {
		if (unit === 4) return 'MONTH'
		if (unit === 5) return 'YEAR'
	}
	return ''
}

function rationalMinor(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) return value
	const record = asRecord(value)
	if (!record) return undefined
	const numerator = readNumber(record, ['numerator'])
	const denominator = readNumber(record, ['denominator']) ?? 1
	if (numerator === undefined || denominator === 0) return undefined
	return numerator / denominator
}

function priceMinor(price: Record<string, unknown>): number | undefined {
	const tiers = price.tiers
	if (!Array.isArray(tiers) || tiers.length === 0) {
		return readNumber(price, ['unit_minor', 'unitMinor', 'amount_minor', 'amountMinor'])
	}
	const first = asRecord(tiers[0])
	if (!first) return undefined
	return (
		rationalMinor(first.unit_minor ?? first.unitMinor) ??
		readNumber(first, ['flat_minor', 'flatMinor'])
	)
}

export async function getPlans(config?: unknown): Promise<import('./dest').Plan[]> {
	const destConfig = (config ?? {}) as DestPeelConfig
	const body = await destJson<{ prices?: unknown[]; products?: unknown[] }>(
		commerceOrigin(destConfig),
		'/v1/sylphx.commerce.v1.InvoicingService/ListPrices',
		{
			method: 'POST',
			credential: commerceCredential(destConfig),
			body: {
				as_of: destAsOf(),
				page: destPage(50),
			},
		},
	)
	const grouped = new Map<string, import('./dest').Plan>()
	for (const raw of body.prices ?? []) {
		const price = asRecord(raw)
		if (!price) continue
		const slug =
			readText(price, ['price_code', 'priceCode', 'product_code', 'productCode', 'slug']) ?? ''
		if (!slug) continue
		const current = grouped.get(slug) ?? {
			slug,
			name: readText(price, ['display_name', 'displayName', 'name']) ?? slug,
		}
		const minor = priceMinor(price)
		const unit = cadenceUnit(asRecord(price.cadence) ?? price)
		if (minor !== undefined) {
			if (unit.includes('YEAR')) current.annualPrice = minor
			else current.monthlyPrice = minor
		}
		grouped.set(slug, current)
	}
	return [...grouped.values()]
}

export async function createCheckout(
	config: unknown,
	input: { planSlug: string; interval?: string; userId?: string },
): Promise<string> {
	const plans = await getPlans(config)
	const plan = plans.find((candidate) => candidate.slug === input.planSlug)
	if (!plan) {
		throw new Error('commerce_plan_not_found')
	}
	throw new Error('commerce_checkout_unconfigured')
}

export async function openPortal(config: unknown, userId?: string): Promise<string> {
	const destConfig = (config ?? {}) as DestPeelConfig
	await destJson(
		commerceOrigin(destConfig),
		'/v1/sylphx.commerce.v1.InvoicingService/ListInvoices',
		{
			method: 'POST',
			credential: commerceCredential(destConfig),
			body: {
				billing_account_id: userId ?? '',
				as_of: destAsOf(),
				page: destPage(20),
			},
		},
	)
	return '/settings/subscription'
}
