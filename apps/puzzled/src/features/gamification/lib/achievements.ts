// Achievement definitions and checking logic

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
export type AchievementCategory =
	| 'streak'
	| 'wins'
	| 'score'
	| 'special'
	| 'explorer'
	| 'social'
	| 'dedication'
	| 'secret'

export type Achievement = {
	id: string
	name: string
	description: string
	icon: string // Iconify icon name
	tier: AchievementTier
	category: AchievementCategory
	secret?: boolean // Hidden until unlocked
}

export type UserAchievement = Achievement & {
	unlockedAt?: Date
	progress?: number // For progressive achievements
	target?: number
}

// Achievement definitions
const ACHIEVEMENT_LIST: Achievement[] = [
	// Streak achievements
	{
		id: 'streak-3',
		name: 'Getting Started',
		description: 'Win 3 games in a row',
		icon: 'mdi:fire',
		tier: 'bronze',
		category: 'streak',
	},
	{
		id: 'streak-7',
		name: 'Week Warrior',
		description: 'Win 7 games in a row',
		icon: 'mdi:fire',
		tier: 'silver',
		category: 'streak',
	},
	{
		id: 'streak-30',
		name: 'Monthly Master',
		description: 'Win 30 games in a row',
		icon: 'mdi:fire',
		tier: 'gold',
		category: 'streak',
	},
	{
		id: 'streak-100',
		name: 'Legendary Streak',
		description: 'Win 100 games in a row',
		icon: 'mdi:fire',
		tier: 'platinum',
		category: 'streak',
	},

	// Win count achievements
	{
		id: 'wins-10',
		name: 'First Steps',
		description: 'Win 10 games total',
		icon: 'mdi:trophy',
		tier: 'bronze',
		category: 'wins',
	},
	{
		id: 'wins-50',
		name: 'Rising Star',
		description: 'Win 50 games total',
		icon: 'mdi:trophy',
		tier: 'silver',
		category: 'wins',
	},
	{
		id: 'wins-100',
		name: 'Champion',
		description: 'Win 100 games total',
		icon: 'mdi:trophy',
		tier: 'gold',
		category: 'wins',
	},
	{
		id: 'wins-500',
		name: 'Grand Master',
		description: 'Win 500 games total',
		icon: 'mdi:trophy',
		tier: 'platinum',
		category: 'wins',
	},

	// Wordle specific
	{
		id: 'wordle-perfect',
		name: 'Lucky Guess',
		description: 'Solve Wordle in 1 attempt',
		icon: 'mdi:star-four-points',
		tier: 'gold',
		category: 'special',
	},
	{
		id: 'wordle-fast',
		name: 'Quick Thinker',
		description: 'Solve Wordle in 2 attempts',
		icon: 'mdi:lightning-bolt',
		tier: 'silver',
		category: 'special',
	},

	// Connections specific
	{
		id: 'connections-perfect',
		name: 'Perfect Connection',
		description: 'Solve Connections with no mistakes',
		icon: 'mdi:puzzle',
		tier: 'gold',
		category: 'special',
	},

	// Multi-game achievements
	{
		id: 'all-games',
		name: 'Renaissance Player',
		description: 'Win at least once in all games',
		icon: 'mdi:crown',
		tier: 'silver',
		category: 'special',
	},
	{
		id: 'daily-sweep',
		name: 'Daily Sweep',
		description: 'Win all games in one day',
		icon: 'mdi:calendar-check',
		tier: 'gold',
		category: 'special',
	},

	// Explorer achievements - trying different features
	{
		id: 'first-game',
		name: 'Welcome!',
		description: 'Play your first game',
		icon: 'mdi:hand-wave',
		tier: 'bronze',
		category: 'explorer',
	},
	{
		id: 'try-all-games',
		name: 'Explorer',
		description: 'Try all game types',
		icon: 'mdi:compass',
		tier: 'bronze',
		category: 'explorer',
	},
	{
		id: 'check-stats',
		name: 'Data Lover',
		description: 'View your statistics page',
		icon: 'mdi:chart-bar',
		tier: 'bronze',
		category: 'explorer',
	},
	{
		id: 'check-leaderboard',
		name: 'Competitive Spirit',
		description: 'View the leaderboard',
		icon: 'mdi:podium',
		tier: 'bronze',
		category: 'explorer',
	},

	// Social achievements
	{
		id: 'first-share',
		name: 'Sharing is Caring',
		description: 'Share your first result',
		icon: 'mdi:share-variant',
		tier: 'bronze',
		category: 'social',
	},
	{
		id: 'share-10',
		name: 'Social Butterfly',
		description: 'Share 10 results',
		icon: 'mdi:share-all',
		tier: 'silver',
		category: 'social',
	},
	{
		id: 'leaderboard-top10',
		name: 'Ranked',
		description: 'Reach top 10 on any leaderboard',
		icon: 'mdi:medal',
		tier: 'gold',
		category: 'social',
	},
	{
		id: 'leaderboard-top1',
		name: 'Number One',
		description: 'Reach #1 on any leaderboard',
		icon: 'mdi:trophy',
		tier: 'platinum',
		category: 'social',
	},

	// Dedication achievements - time-based
	{
		id: 'early-bird',
		name: 'Early Bird',
		description: 'Play a game before 7 AM',
		icon: 'mdi:weather-sunny',
		tier: 'silver',
		category: 'dedication',
	},
	{
		id: 'night-owl',
		name: 'Night Owl',
		description: 'Play a game after 11 PM',
		icon: 'mdi:weather-night',
		tier: 'silver',
		category: 'dedication',
	},
	{
		id: 'weekend-warrior',
		name: 'Weekend Warrior',
		description: 'Play every day of a weekend',
		icon: 'mdi:calendar-weekend',
		tier: 'bronze',
		category: 'dedication',
	},
	{
		id: 'year-streak',
		name: 'Annual Legend',
		description: 'Maintain a 365-day streak',
		icon: 'mdi:calendar-star',
		tier: 'diamond',
		category: 'dedication',
	},

	// Secret achievements - hidden until unlocked
	{
		id: 'secret-perfect-week',
		name: 'Perfect Week',
		description: 'Win every game for 7 days straight',
		icon: 'mdi:star-circle',
		tier: 'gold',
		category: 'secret',
		secret: true,
	},
	{
		id: 'secret-perfect-month',
		name: 'Perfect Month',
		description: 'Win every game for 30 days straight',
		icon: 'mdi:star-shooting',
		tier: 'platinum',
		category: 'secret',
		secret: true,
	},
	{
		id: 'secret-comeback',
		name: 'Comeback Kid',
		description: 'Win after using all but one attempt',
		icon: 'mdi:emoticon-cool',
		tier: 'silver',
		category: 'secret',
		secret: true,
	},
	{
		id: 'secret-speedrun',
		name: 'Speedrunner',
		description: 'Complete all games in under 5 minutes',
		icon: 'mdi:lightning-bolt',
		tier: 'gold',
		category: 'secret',
		secret: true,
	},
]

// Build Map for O(1) lookup by ID
const ACHIEVEMENT_MAP = new Map<string, Achievement>(ACHIEVEMENT_LIST.map((a) => [a.id, a]))

// Export array for iteration
export const ACHIEVEMENTS = ACHIEVEMENT_LIST

/**
 * Get achievement by ID - throws if not found (catches typos at dev time)
 */
function getAchievement(id: string): Achievement {
	const achievement = ACHIEVEMENT_MAP.get(id)
	if (!achievement) {
		throw new Error(`[Achievements] Unknown achievement ID: ${id}`)
	}
	return achievement
}

// Achievement tier colors
export const TIER_COLORS = {
	bronze: 'text-amber-600',
	silver: 'text-slate-500 dark:text-slate-400',
	gold: 'text-yellow-500',
	platinum: 'text-cyan-500 dark:text-cyan-400',
	diamond: 'text-violet-500 dark:text-violet-400',
} as const

export const TIER_BG_COLORS = {
	bronze: 'bg-amber-600/10',
	silver: 'bg-slate-500/10',
	gold: 'bg-yellow-500/10',
	platinum: 'bg-cyan-500/10',
	diamond: 'bg-violet-500/10',
} as const

export const TIER_BORDER_COLORS = {
	bronze: 'border-amber-600/30',
	silver: 'border-gray-400/30',
	gold: 'border-yellow-500/30',
	platinum: 'border-cyan-400/30',
	diamond: 'border-violet-400/30',
} as const

export const CATEGORY_ICONS = {
	streak: 'mdi:fire',
	wins: 'mdi:trophy',
	score: 'mdi:star',
	special: 'mdi:sparkles',
	explorer: 'mdi:compass',
	social: 'mdi:account-group',
	dedication: 'mdi:clock',
	secret: 'mdi:lock',
} as const

export const CATEGORY_NAMES = {
	streak: 'Streak',
	wins: 'Wins',
	score: 'Score',
	special: 'Special',
	explorer: 'Explorer',
	social: 'Social',
	dedication: 'Dedication',
	secret: 'Secret',
} as const

// Check achievements based on user stats
export function checkAchievements(stats: {
	totalWins: number
	maxStreak: number
	wordleWins: number
	connectionsWins: number
	wordleBestAttempts?: number
	connectionsPerfectGames?: number
}): UserAchievement[] {
	const unlocked: UserAchievement[] = []
	const now = new Date()

	// Check streak achievements
	if (stats.maxStreak >= 3) {
		unlocked.push({ ...getAchievement('streak-3'), unlockedAt: now })
	}
	if (stats.maxStreak >= 7) {
		unlocked.push({ ...getAchievement('streak-7'), unlockedAt: now })
	}
	if (stats.maxStreak >= 30) {
		unlocked.push({ ...getAchievement('streak-30'), unlockedAt: now })
	}
	if (stats.maxStreak >= 100) {
		unlocked.push({ ...getAchievement('streak-100'), unlockedAt: now })
	}

	// Check win count achievements
	if (stats.totalWins >= 10) {
		unlocked.push({ ...getAchievement('wins-10'), unlockedAt: now })
	}
	if (stats.totalWins >= 50) {
		unlocked.push({ ...getAchievement('wins-50'), unlockedAt: now })
	}
	if (stats.totalWins >= 100) {
		unlocked.push({ ...getAchievement('wins-100'), unlockedAt: now })
	}
	if (stats.totalWins >= 500) {
		unlocked.push({ ...getAchievement('wins-500'), unlockedAt: now })
	}

	// Check special achievements
	if (stats.wordleBestAttempts === 1) {
		unlocked.push({ ...getAchievement('wordle-perfect'), unlockedAt: now })
	}
	if (stats.wordleBestAttempts && stats.wordleBestAttempts <= 2) {
		unlocked.push({ ...getAchievement('wordle-fast'), unlockedAt: now })
	}

	if (stats.connectionsPerfectGames && stats.connectionsPerfectGames > 0) {
		unlocked.push({ ...getAchievement('connections-perfect'), unlockedAt: now })
	}

	// All games achievement
	if (stats.wordleWins > 0 && stats.connectionsWins > 0) {
		unlocked.push({ ...getAchievement('all-games'), unlockedAt: now })
	}

	return unlocked
}

// Get next achievement to unlock
export function getNextAchievements(stats: {
	totalWins: number
	maxStreak: number
}): UserAchievement[] {
	const next: UserAchievement[] = []

	// Find next streak achievement
	const streakTargets = [3, 7, 30, 100] as const
	for (const target of streakTargets) {
		if (stats.maxStreak < target) {
			const achievement = ACHIEVEMENT_MAP.get(`streak-${target}`)
			if (achievement) {
				next.push({ ...achievement, progress: stats.maxStreak, target })
			}
			break
		}
	}

	// Find next wins achievement
	const winsTargets = [10, 50, 100, 500] as const
	for (const target of winsTargets) {
		if (stats.totalWins < target) {
			const achievement = ACHIEVEMENT_MAP.get(`wins-${target}`)
			if (achievement) {
				next.push({ ...achievement, progress: stats.totalWins, target })
			}
			break
		}
	}

	return next
}
