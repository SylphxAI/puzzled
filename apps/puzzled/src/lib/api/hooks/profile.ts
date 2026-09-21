'use client'

/**
 * Puzzled API hooks - Profile domain (sole Connect, ADR-170).
 */

import { type UseQueryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { checkUsername, getProfile, updateProfile } from '@/lib/connect/preferences-client'
import { type ApiError, toApiError } from './shared'

// ==========================================
// Profile (sole Connect) — used by future settings surfaces
// ==========================================

export function useProfile(
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: ['puzzled', 'profile'] as const,
		queryFn: async () => {
			try {
				return await getProfile()
			} catch (e) {
				throw toApiError(e, 'PROFILE_FAILED')
			}
		},
		...options,
	})
}

export function useUpdateProfile() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: Record<string, unknown>) => {
			try {
				return await updateProfile({
					username: typeof input.username === 'string' ? input.username : undefined,
					bio: typeof input.bio === 'string' ? input.bio : undefined,
					isPublicProfile:
						typeof input.isPublicProfile === 'boolean' ? input.isPublicProfile : undefined,
					compactMode: typeof input.compactMode === 'boolean' ? input.compactMode : undefined,
					leaderboardVisible:
						typeof input.leaderboardVisible === 'boolean' ? input.leaderboardVisible : undefined,
				})
			} catch (e) {
				throw toApiError(e, 'PROFILE_UPDATE_FAILED')
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['puzzled', 'profile'] as const })
		},
	})
}

export function useCheckUsername() {
	return useMutation({
		mutationFn: async (input: { username: string }) => {
			try {
				return { available: await checkUsername(input.username) }
			} catch (e) {
				throw toApiError(e, 'USERNAME_CHECK_FAILED')
			}
		},
	})
}
