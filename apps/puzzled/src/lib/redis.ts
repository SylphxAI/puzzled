import IORedis from 'ioredis'
import { RateLimiterRedis } from 'rate-limiter-flexible'

// Validate environment variables at module load - fail fast
const REDIS_URL = process.env.REDIS_URL

if (!REDIS_URL) {
	throw new Error(
		'[Redis] Missing required environment variable REDIS_URL. ' +
			'Format: redis://:password@host:6379',
	)
}

// Create Redis client
export const redis = new IORedis(REDIS_URL, {
	maxRetriesPerRequest: 3,
	lazyConnect: false,
	enableReadyCheck: false,
})

redis.on('error', (err: Error) => {
	console.error('[Redis] Connection error:', err.message)
})

// ==========================================
// Rate Limiter
// ==========================================

const _rateLimiter = new RateLimiterRedis({
	storeClient: redis,
	keyPrefix: 'puzzled:ratelimit',
	points: 10, // max requests
	duration: 10, // per 10 seconds
})

export const ratelimit = {
	async limit(identifier: string): Promise<{
		success: boolean
		remaining: number
		limit: number
		reset: number
	}> {
		try {
			const result = await _rateLimiter.consume(identifier)
			return {
				success: true,
				remaining: result.remainingPoints,
				limit: 10,
				reset: Date.now() + (result.msBeforeNext ?? 0),
			}
		} catch {
			return {
				success: false,
				remaining: 0,
				limit: 10,
				reset: Date.now() + 10000,
			}
		}
	},
}

// ==========================================
// Helpers: JSON-aware get/set
// ==========================================

async function redisGet<T>(key: string): Promise<T | null> {
	const val = await redis.get(key)
	if (val === null) return null
	try {
		return JSON.parse(val) as T
	} catch {
		return val as unknown as T
	}
}

async function redisSet(key: string, value: unknown, exSeconds?: number): Promise<void> {
	const serialized = typeof value === 'string' ? value : JSON.stringify(value)
	if (exSeconds) {
		await redis.setex(key, exSeconds, serialized)
	} else {
		await redis.set(key, serialized)
	}
}

// ==========================================
// Cache helpers
// ==========================================

export const cache = {
	async get<T>(key: string): Promise<T | null> {
		return redisGet<T>(key)
	},

	async set<T>(key: string, value: T, exSeconds?: number): Promise<void> {
		return redisSet(key, value, exSeconds)
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
		return redis.zadd(key, score, member)
	},

	async zrange(key: string, start: number, stop: number): Promise<string[]> {
		return redis.zrange(key, start, stop)
	},

	async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
		return redis.zrevrange(key, start, stop)
	},

	async zscore(key: string, member: string): Promise<number | null> {
		const val = await redis.zscore(key, member)
		return val !== null ? parseFloat(val) : null
	},

	async zrank(key: string, member: string): Promise<number | null> {
		return redis.zrank(key, member)
	},

	async zrevrank(key: string, member: string): Promise<number | null> {
		return redis.zrevrank(key, member)
	},
}

// ==========================================
// Key generators
// ==========================================

export const keys = {
	dailyPuzzle: (gameSlug: string, date: string) => `puzzle:${gameSlug}:${date}`,
	leaderboard: (gameSlug: string, period: 'daily' | 'weekly' | 'all') =>
		`leaderboard:${gameSlug}:${period}`,
	userStreak: (userId: string, gameSlug: string) => `streak:${userId}:${gameSlug}`,
	sessionCache: (sessionId: string) => `session:${sessionId}`,
	impersonation: (adminUserId: string) => `impersonate:${adminUserId}`,
}

// ==========================================
// Impersonation helpers
// ==========================================

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
