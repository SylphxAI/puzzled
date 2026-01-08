/**
 * Database seed script
 * Run with: npx tsx src/lib/db/seed.ts
 *
 * Seeds:
 * - Plans and plan prices
 *
 * Note: Games are defined in code registry (GAME_CONFIGS in src/games/registry.ts)
 * and do NOT need database seeding - they are the SSOT.
 */

import dotenv from 'dotenv'

// Load .env.local for local development
dotenv.config({ path: '.env.local' })

import { getAllGames } from '@/games/registry'
import { db } from './index'
import { planPrices, plans } from './schema'

async function seed() {
	console.log('🌱 Seeding database...')

	// Games are defined in code registry (SSOT) - no database seeding needed
	const registryGames = getAllGames()
	console.log(`📦 Games from registry: ${registryGames.length} games (code-defined, no DB sync needed)`)
	for (const game of registryGames) {
		console.log(`   - ${game.name} (${game.slug})`)
	}

	// Seed plans
	console.log('📦 Seeding plans...')
	const [_freePlan, premiumPlan] = await db
		.insert(plans)
		.values([
			{
				slug: 'free',
				name: 'Free',
				description: 'Basic access to daily puzzles',
				features: ['1 daily puzzle per game', 'Basic statistics'],
				isActive: true,
				sortOrder: 1,
			},
			{
				slug: 'premium',
				name: 'Premium',
				description: 'Unlimited access to all features',
				features: [
					'Full puzzle archive',
					'Streak freeze protection',
					'Leaderboard access',
					'No ads',
				],
				isActive: true,
				sortOrder: 2,
			},
		])
		.onConflictDoNothing({ target: plans.slug })
		.returning()

	console.log('✅ Plans seeded')

	// Seed plan prices (only if plans were inserted)
	if (premiumPlan) {
		console.log('📦 Seeding plan prices...')
		await db
			.insert(planPrices)
			.values([
				{
					planId: premiumPlan.id,
					interval: 'monthly',
					amount: 499, // $4.99
					currency: 'usd',
					isActive: true,
				},
				{
					planId: premiumPlan.id,
					interval: 'annual',
					amount: 3999, // $39.99
					currency: 'usd',
					isActive: true,
				},
			])
			.onConflictDoNothing()

		console.log('✅ Plan prices seeded')
	}

	console.log('🎉 Database seeded successfully!')
}

seed()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error('❌ Seed failed:', error)
		process.exit(1)
	})
