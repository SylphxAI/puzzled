/**
 * Notification Job Handlers
 *
 * Production-ready handlers for notification-related cron jobs.
 * Uses Platform SDK for email and push notification delivery.
 */

import { sendEmailToUser, sendPush } from '@sylphx/sdk'
import { and, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm'
import { getTodayUTC, getYesterdayUTC } from '@/features/daily/server'
import { db } from '@/lib/db'
import {
	gameSessions,
	notificationPreferences,
	userDisplayCache,
	userStats,
	type WinBackEmailType,
	winBackEmails,
} from '@/lib/db/schema'
import { getSdkConfig } from '@/lib/sdk-server'
import type { JobHandler } from '../handlers'

// ==========================================
// Daily Reminder Handler
// ==========================================

/**
 * Daily reminder handler
 *
 * Sends daily reminder push notifications to users who have opted in.
 * Runs hourly, sends to users whose reminder time matches current hour.
 */
export const dailyReminderHandler: JobHandler = async (payload, context) => {
	const logPrefix = `[DailyReminder] [${context.jobId}]`
	console.log(`${logPrefix} Starting daily reminder job`)

	const config = getSdkConfig()
	const now = new Date()
	const currentHour = now.getUTCHours().toString().padStart(2, '0')

	// Find users who:
	// 1. Have push enabled
	// 2. Have daily reminders enabled
	// 3. Have reminder time matching current hour (HH:00 format)
	// 4. Haven't played today
	const todayUTC = getTodayUTC()

	// Get users who want reminders at this hour
	const eligibleUsers = await db
		.select({
			userId: notificationPreferences.userId,
			reminderTime: notificationPreferences.dailyReminderTime,
		})
		.from(notificationPreferences)
		.where(
			and(
				eq(notificationPreferences.pushEnabled, true),
				eq(notificationPreferences.pushDailyReminder, true),
				sql`LEFT(${notificationPreferences.dailyReminderTime}, 2) = ${currentHour}`,
			),
		)

	if (eligibleUsers.length === 0) {
		console.log(`${logPrefix} No users eligible for reminders at ${currentHour}:00 UTC`)
		return { success: true, data: { sent: 0, skipped: 0 } }
	}

	const userIds = eligibleUsers.map((u) => u.userId)

	// Find users who already played today
	const playedToday = await db
		.select({ userId: gameSessions.userId })
		.from(gameSessions)
		.where(and(inArray(gameSessions.userId, userIds), gt(gameSessions.completedAt, todayUTC)))
		.groupBy(gameSessions.userId)

	const playedTodaySet = new Set(playedToday.map((u) => u.userId))

	// Filter to users who haven't played today
	const usersToNotify = eligibleUsers.filter((u) => !playedTodaySet.has(u.userId))

	if (usersToNotify.length === 0) {
		console.log(`${logPrefix} All ${eligibleUsers.length} eligible users already played today`)
		return { success: true, data: { sent: 0, skipped: eligibleUsers.length } }
	}

	console.log(`${logPrefix} Sending reminders to ${usersToNotify.length} users`)

	// Send push notifications
	let sent = 0
	let failed = 0

	for (const user of usersToNotify) {
		try {
			await sendPush(config, user.userId, {
				title: 'Time to play! 🎮',
				body: 'Your daily puzzles are ready. Keep your streak alive!',
				url: '/',
			})
			sent++
		} catch (error) {
			console.error(`${logPrefix} Failed to send to ${user.userId}:`, error)
			failed++
		}
	}

	const result = {
		sent,
		failed,
		skipped: eligibleUsers.length - usersToNotify.length,
		hour: `${currentHour}:00`,
	}

	console.log(`${logPrefix} Completed:`, result)
	return { success: true, data: result }
}

// ==========================================
// Streak-at-Risk Handler
// ==========================================

/**
 * Streak-at-risk handler
 *
 * Sends notifications to users whose streaks are about to expire.
 * Runs in the evening (e.g., 21:00 UTC) to remind users who haven't played.
 */
export const streakAtRiskHandler: JobHandler = async (_payload, context) => {
	const logPrefix = `[StreakAtRisk] [${context.jobId}]`
	console.log(`${logPrefix} Starting streak-at-risk notifications`)

	const config = getSdkConfig()
	const todayUTC = getTodayUTC()
	const yesterdayUTC = getYesterdayUTC()

	// Find users with:
	// 1. Active streak (currentStreak > 0)
	// 2. Last played yesterday (not today)
	// 3. Push notifications enabled
	// 4. Streak alerts enabled
	const usersAtRisk = await db
		.select({
			userId: userStats.userId,
			currentStreak: userStats.currentStreak,
			gameSlug: userStats.gameSlug,
		})
		.from(userStats)
		.innerJoin(notificationPreferences, eq(userStats.userId, notificationPreferences.userId))
		.where(
			and(
				gt(userStats.currentStreak, 0),
				lt(userStats.lastPlayedAt, todayUTC),
				gt(userStats.lastPlayedAt, yesterdayUTC),
				eq(notificationPreferences.pushEnabled, true),
				eq(notificationPreferences.pushStreakAlert, true),
			),
		)

	if (usersAtRisk.length === 0) {
		console.log(`${logPrefix} No users with at-risk streaks`)
		return { success: true, data: { sent: 0 } }
	}

	// Group by user to get their highest streak at risk
	const userStreakMap = new Map<string, { maxStreak: number; games: string[] }>()
	for (const row of usersAtRisk) {
		const existing = userStreakMap.get(row.userId)
		if (!existing) {
			userStreakMap.set(row.userId, {
				maxStreak: row.currentStreak,
				games: [row.gameSlug],
			})
		} else {
			existing.maxStreak = Math.max(existing.maxStreak, row.currentStreak)
			existing.games.push(row.gameSlug)
		}
	}

	console.log(`${logPrefix} Found ${userStreakMap.size} users with at-risk streaks`)

	let sent = 0
	let failed = 0

	for (const [userId, data] of userStreakMap) {
		try {
			const streakText = data.maxStreak === 1 ? '1 day' : `${data.maxStreak} days`
			await sendPush(config, userId, {
				title: '🔥 Streak at risk!',
				body: `Your ${streakText} streak is about to end! Play now to keep it alive.`,
				url: '/',
			})
			sent++
		} catch (error) {
			console.error(`${logPrefix} Failed to send to ${userId}:`, error)
			failed++
		}
	}

	const result = { sent, failed, totalAtRisk: userStreakMap.size }
	console.log(`${logPrefix} Completed:`, result)
	return { success: true, data: result }
}

// ==========================================
// Win-Back Emails Handler
// ==========================================

interface WinBackConfig {
	type: WinBackEmailType
	daysInactive: number
	subject: string
	getHtml: (name: string) => string
}

const WIN_BACK_SEQUENCE: WinBackConfig[] = [
	{
		type: 'day7',
		daysInactive: 7,
		subject: 'We miss you! 🎮',
		getHtml: (name) => `
			<h1>Hey${name ? ` ${name}` : ''}!</h1>
			<p>We noticed you haven't played in a week. Your daily puzzles are waiting!</p>
			<p>Come back and challenge yourself with:</p>
			<ul>
				<li>New daily puzzles every day</li>
				<li>Track your streaks and stats</li>
				<li>Compete on the leaderboards</li>
			</ul>
			<p><a href="${process.env.NEXT_PUBLIC_APP_URL}">Play now →</a></p>
		`,
	},
	{
		type: 'day14',
		daysInactive: 14,
		subject: 'Your puzzles miss you! 🧩',
		getHtml: (name) => `
			<h1>It's been a while${name ? `, ${name}` : ''}!</h1>
			<p>Two weeks have passed and we've added new puzzles and features.</p>
			<p>Here's what you're missing:</p>
			<ul>
				<li>Fresh daily challenges every day</li>
				<li>New games and modes</li>
				<li>Your friends are climbing the leaderboard</li>
			</ul>
			<p><a href="${process.env.NEXT_PUBLIC_APP_URL}">Jump back in →</a></p>
		`,
	},
	{
		type: 'day30',
		daysInactive: 30,
		subject: 'A fresh start awaits! ✨',
		getHtml: (name) => `
			<h1>Ready for a fresh start${name ? `, ${name}` : ''}?</h1>
			<p>It's been a month! We've made lots of improvements and would love to see you back.</p>
			<p>Start fresh with:</p>
			<ul>
				<li>No pressure - just fun puzzles</li>
				<li>New challenges waiting for you</li>
				<li>A welcoming community</li>
			</ul>
			<p><a href="${process.env.NEXT_PUBLIC_APP_URL}">Start playing again →</a></p>
		`,
	},
]

/**
 * Win-back emails handler
 *
 * Sends win-back email sequence to churned users.
 * Day 7, 14, and 30 emails based on last activity.
 */
export const winBackEmailsHandler: JobHandler = async (_payload, context) => {
	const logPrefix = `[WinBackEmails] [${context.jobId}]`
	console.log(`${logPrefix} Starting win-back email campaign`)

	const config = getSdkConfig()
	const now = new Date()

	const results: Record<WinBackEmailType, { sent: number; failed: number; skipped: number }> = {
		day7: { sent: 0, failed: 0, skipped: 0 },
		day14: { sent: 0, failed: 0, skipped: 0 },
		day30: { sent: 0, failed: 0, skipped: 0 },
	}

	for (const emailConfig of WIN_BACK_SEQUENCE) {
		const targetDate = new Date(now)
		targetDate.setDate(targetDate.getDate() - emailConfig.daysInactive)
		const targetDateStart = new Date(targetDate.setHours(0, 0, 0, 0))
		const targetDateEnd = new Date(targetDate.setHours(23, 59, 59, 999))

		console.log(
			`${logPrefix} Processing ${emailConfig.type} (inactive since ${targetDateStart.toISOString()})`,
		)

		// Find users who:
		// 1. Have email enabled and marketing enabled
		// 2. Last played on exactly the target date (X days ago)
		// 3. Haven't received this email type yet
		// 4. Have cached email (from userDisplayCache)
		const eligibleUsers = await db
			.select({
				userId: userStats.userId,
				email: userDisplayCache.email,
				displayName: userDisplayCache.displayName,
				lastPlayedAt: userStats.lastPlayedAt,
			})
			.from(userStats)
			.innerJoin(notificationPreferences, eq(userStats.userId, notificationPreferences.userId))
			.innerJoin(userDisplayCache, eq(userStats.userId, userDisplayCache.userId))
			.leftJoin(
				winBackEmails,
				and(
					eq(userStats.userId, winBackEmails.userId),
					eq(winBackEmails.emailType, emailConfig.type),
				),
			)
			.where(
				and(
					eq(notificationPreferences.emailEnabled, true),
					eq(notificationPreferences.emailMarketing, true),
					gt(userStats.lastPlayedAt, targetDateStart),
					lt(userStats.lastPlayedAt, targetDateEnd),
					isNull(winBackEmails.id), // Not yet sent this email type
				),
			)
			.groupBy(
				userStats.userId,
				userDisplayCache.email,
				userDisplayCache.displayName,
				userStats.lastPlayedAt,
			)

		// Filter to users with valid emails
		const usersWithEmail = eligibleUsers.filter((u) => u.email)

		console.log(`${logPrefix} ${emailConfig.type}: Found ${usersWithEmail.length} eligible users`)

		for (const user of usersWithEmail) {
			if (!user.email) {
				results[emailConfig.type].skipped++
				continue
			}

			try {
				// Send email via Platform SDK
				await sendEmailToUser(config, {
					userId: user.userId,
					subject: emailConfig.subject,
					html: emailConfig.getHtml(user.displayName ?? ''),
				})

				// Record that we sent this email
				await db.insert(winBackEmails).values({
					userId: user.userId,
					emailType: emailConfig.type,
					sentAt: new Date(),
				})

				results[emailConfig.type].sent++
			} catch (error) {
				console.error(`${logPrefix} Failed to send ${emailConfig.type} to ${user.userId}:`, error)
				results[emailConfig.type].failed++
			}
		}
	}

	console.log(`${logPrefix} Completed:`, results)
	return { success: true, data: results }
}
