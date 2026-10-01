/**
 * PreferencesService generated client (sole Connect surface).
 */
import { create } from '@bufbuild/protobuf'
import { type Client, createClient } from '@connectrpc/connect'
import {
	CheckUsernameRequestSchema,
	DeleteAccountDataRequestSchema,
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

/** The device's IANA time zone, so the daily reminder lands at the player's own hour. */
export function deviceTimeZone(): string | undefined {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
	} catch {
		return undefined
	}
}

export async function updatePushPreferences(
	input: {
		pushEnabled?: boolean
		pushDailyReminder?: boolean
		pushStreakAlert?: boolean
		pushNewGames?: boolean
		dailyReminderTime?: string
		/** IANA time zone the reminder time is read in; defaults to this device's */
		timezone?: string
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
			timezone: input.timezone ?? deviceTimeZone(),
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

/** Acceptance is not completion; expose the durable operation and state. */
export async function deleteAccountData(client?: PreferencesServiceClient): Promise<{
	requestId: string
	state: string
	rowsDeleted: bigint
}> {
	const c = client ?? createPreferencesServiceClient()
	const res = await c.deleteAccountData(
		create(DeleteAccountDataRequestSchema, { confirm: 'DELETE' }),
	)
	if (
		!res.requestId ||
		!['pending', 'auth_pending', 'local_erased', 'completed'].includes(res.state)
	) {
		throw new Error('invalid_erasure_receipt')
	}
	return {
		requestId: res.requestId,
		state: res.state,
		rowsDeleted: res.rowsDeleted,
	}
}
