import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Validate environment variables at module load - fail fast
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN

if (!REDIS_URL || !REDIS_TOKEN) {
	throw new Error(
		'[Redis] Missing required environment variables. ' +
			'Set either KV_REST_API_URL/KV_REST_API_TOKEN (Vercel KV) ' +
			'or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN (Upstash).',
	)
}

// Create Redis client
export const redis = new Redis({
	url: REDIS_URL,
	token: REDIS_TOKEN,
})

// Rate limiter for API routes
export const ratelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(10, '10 s'),
	analytics: true,
	prefix: 'puzzled:ratelimit',
})

// Cache helpers
export const cache = {
	async get<T>(key: string): Promise<T | null> {
		return redis.get<T>(key)
	},

	async set<T>(key: string, value: T, exSeconds?: number): Promise<void> {
		if (exSeconds) {
			await redis.setex(key, exSeconds, value)
		} else {
			await redis.set(key, value)
		}
	},

	/**
	 * Check timestamp-based rate limit
	 * @returns seconds remaining until cooldown expires, or 0 if no limit
	 */
	async getRateLimitSeconds(key: string, cooldownSeconds: number): Promise<number> {
		const lastSent = await this.get<number>(key)
		if (lastSent) {
			const secondsRemaining = Math.ceil(cooldownSeconds - (Date.now() - lastSent) / 1000)
			return secondsRemaining > 0 ? secondsRemaining : 0
		}
		return 0
	},

	/**
	 * Set timestamp for rate limiting
	 */
	async setRateLimitTimestamp(key: string, cooldownSeconds: number): Promise<void> {
		await this.set(key, Date.now(), cooldownSeconds)
	},

	async del(key: string): Promise<void> {
		await redis.del(key)
	},

	async exists(key: string): Promise<boolean> {
		return (await redis.exists(key)) === 1
	},

	// Increment counter (for leaderboards, stats)
	async incr(key: string): Promise<number> {
		return redis.incr(key)
	},

	async incrBy(key: string, amount: number): Promise<number> {
		return redis.incrby(key, amount)
	},

	// Sorted sets for leaderboards
	async zadd(key: string, score: number, member: string): Promise<number | null> {
		return redis.zadd(key, { score, member })
	},

	async zrange(key: string, start: number, stop: number): Promise<string[]> {
		return redis.zrange(key, start, stop)
	},

	async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
		return redis.zrange(key, start, stop, { rev: true })
	},

	async zscore(key: string, member: string): Promise<number | null> {
		return redis.zscore(key, member)
	},

	async zrank(key: string, member: string): Promise<number | null> {
		return redis.zrank(key, member)
	},

	async zrevrank(key: string, member: string): Promise<number | null> {
		return redis.zrevrank(key, member)
	},
}

// Key generators
export const keys = {
	dailyPuzzle: (gameSlug: string, date: string) => `puzzle:${gameSlug}:${date}`,
	leaderboard: (gameSlug: string, period: 'daily' | 'weekly' | 'all') =>
		`leaderboard:${gameSlug}:${period}`,
	userStreak: (userId: string, gameSlug: string) => `streak:${userId}:${gameSlug}`,
	sessionCache: (sessionId: string) => `session:${sessionId}`,
	impersonation: (adminUserId: string) => `impersonate:${adminUserId}`,
}

// Impersonation helpers
type ImpersonationState = {
	targetUserId: string
	targetEmail: string
	adminUserId: string
	adminEmail: string
	startedAt: string
}

const IMPERSONATION_TTL = 60 * 60 // 1 hour max impersonation duration

const _impersonation = {
	async start(adminUserId: string, state: Omit<ImpersonationState, 'startedAt'>): Promise<void> {
		await cache.set(
			keys.impersonation(adminUserId),
			{ ...state, startedAt: new Date().toISOString() },
			IMPERSONATION_TTL,
		)
	},

	async get(adminUserId: string): Promise<ImpersonationState | null> {
		return cache.get<ImpersonationState>(keys.impersonation(adminUserId))
	},

	async stop(adminUserId: string): Promise<void> {
		await cache.del(keys.impersonation(adminUserId))
	},
}
