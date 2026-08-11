/**
 * PreferencesService generated client (sole Connect surface).
 */
import { create } from '@bufbuild/protobuf'
import { type Client, createClient } from '@connectrpc/connect'
import {
	CheckUsernameRequestSchema,
	GetNotificationPreferencesRequestSchema,
	GetProfileRequestSchema,
	type NotificationPreferences,
	PreferencesService,
	type Profile,
	UpdateEmailPreferencesRequestSchema,
	UpdateProfileRequestSchema,
	UpdatePushPreferencesRequestSchema,
} from '@/gen/connect/puzzled/v1/preferences_pb'
import { getConnectTransport } from './transport'

export type PreferencesServiceClient = Client<typeof PreferencesService>

export function createPreferencesServiceClient(baseUrl?: string): PreferencesServiceClient {
	return createClient(PreferencesService, getConnectTransport(baseUrl))
}

export async function getProfile(client?: PreferencesServiceClient): Promise<Profile> {
	const c = client ?? createPreferencesServiceClient()
	const res = await c.getProfile(create(GetProfileRequestSchema, {}))
	if (!res.profile) throw new Error('profile_unavailable')
	return res.profile
}

export async function updateProfile(
	input: {
		username?: string
		bio?: string
		isPublicProfile?: boolean
		compactMode?: boolean
		leaderboardVisible?: boolean
		locale?: string
	},
	client?: PreferencesServiceClient,
): Promise<Profile> {
	const c = client ?? createPreferencesServiceClient()
	const res = await c.updateProfile(
		create(UpdateProfileRequestSchema, {
			username: input.username ?? undefined,
			bio: input.bio ?? undefined,
			isPublicProfile: input.isPublicProfile ?? undefined,
			compactMode: input.compactMode ?? undefined,
			leaderboardVisible: input.leaderboardVisible ?? undefined,
			locale: input.locale ?? undefined,
		}),
	)
	if (!res.profile) throw new Error('profile_unavailable')
	return res.profile
}

export async function checkUsername(
	username: string,
	client?: PreferencesServiceClient,
): Promise<boolean> {
	const c = client ?? createPreferencesServiceClient()
	const res = await c.checkUsername(create(CheckUsernameRequestSchema, { username }))
	return res.available
}

export async function getNotificationPreferences(
	client?: PreferencesServiceClient,
): Promise<NotificationPreferences> {
	const c = client ?? createPreferencesServiceClient()
	const res = await c.getNotificationPreferences(
		create(GetNotificationPreferencesRequestSchema, {}),
	)
	if (!res.preferences) throw new Error('preferences_unavailable')
	return res.preferences
}

export async function updatePushPreferences(
	input: {
		pushEnabled?: boolean
		pushDailyReminder?: boolean
		pushStreakAlert?: boolean
		pushNewGames?: boolean
		dailyReminderTime?: string
	},
	client?: PreferencesServiceClient,
): Promise<NotificationPreferences> {
	const c = client ?? createPreferencesServiceClient()
	const res = await c.updatePushPreferences(
		create(UpdatePushPreferencesRequestSchema, {
			pushEnabled: input.pushEnabled ?? undefined,
			pushDailyReminder: input.pushDailyReminder ?? undefined,
			pushStreakAlert: input.pushStreakAlert ?? undefined,
			pushNewGames: input.pushNewGames ?? undefined,
			dailyReminderTime: input.dailyReminderTime ?? undefined,
		}),
	)
	if (!res.preferences) throw new Error('preferences_unavailable')
	return res.preferences
}

export async function updateEmailPreferences(
	input: {
		emailEnabled?: boolean
		emailWeeklyDigest?: boolean
		emailMarketing?: boolean
	},
	client?: PreferencesServiceClient,
): Promise<NotificationPreferences> {
	const c = client ?? createPreferencesServiceClient()
	const res = await c.updateEmailPreferences(
		create(UpdateEmailPreferencesRequestSchema, {
			emailEnabled: input.emailEnabled ?? undefined,
			emailWeeklyDigest: input.emailWeeklyDigest ?? undefined,
			emailMarketing: input.emailMarketing ?? undefined,
		}),
	)
	if (!res.preferences) throw new Error('preferences_unavailable')
	return res.preferences
}
