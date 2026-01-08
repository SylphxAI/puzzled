'use client'

import { CheckCircle, Loader2, Sparkles, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Input, Textarea } from '@/shared/components/ui'
import { useToast } from '@/shared/components/ui/toast'
import { trpc } from '@/trpc'
import { LIMITS } from '../lib/constants'
import {
	generateRecoverySuggestions,
	generateUsernameSuggestions,
	validateUsernameFormat,
} from '../lib/username-utils'

type ProfileFormProps = {
	user: {
		name: string | null
		email: string
		username: string | null
		bio: string | null
	}
}

export function ProfileForm({ user }: ProfileFormProps) {
	const t = useTranslations('settings.profile')
	const toast = useToast()
	const router = useRouter()
	const utils = trpc.useUtils()

	// Current saved values (updated after mutations)
	const [savedName, setSavedName] = useState(user.name)
	const [savedUsername, setSavedUsername] = useState(user.username)
	const [savedBio, setSavedBio] = useState(user.bio)

	// Form state
	const [name, setName] = useState(user.name || '')
	const [username, setUsername] = useState(user.username || '')
	const [bio, setBio] = useState(user.bio || '')

	// Edit states
	const [editingName, setEditingName] = useState(false)
	const [editingUsername, setEditingUsername] = useState(false)

	// Username suggestions
	const [suggestions] = useState(() => generateUsernameSuggestions(user.name, user.email))

	// Username validation
	const [usernameError, setUsernameError] = useState<string | null>(null)
	const [usernameChecking, setUsernameChecking] = useState(false)
	const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
	const [recoverySuggestions, setRecoverySuggestions] = useState<string[]>([])

	// Character count
	const bioCharCount = bio.length
	const bioMaxLength = LIMITS.BIO_MAX_LENGTH

	// Mutations
	const updateProfile = trpc.user.updateProfile.useMutation({
		onSuccess: (data) => {
			toast.success(t('saved'), t('savedDescription'))
			// Update local saved state from response
			if (data.user) {
				if (data.user.name !== undefined) setSavedName(data.user.name)
				if (data.user.username !== undefined) setSavedUsername(data.user.username)
				if (data.user.bio !== undefined) setSavedBio(data.user.bio)
			}
			utils.user.getProfile.invalidate()
			// Refresh server data for other components
			router.refresh()
		},
		onError: (error) => {
			toast.error(t('updateFailed'), error.message)
		},
	})

	// Check username availability using stable utils.fetch (not useQuery to avoid reference issues)
	const checkUsernameAvailability = useCallback(
		async (usernameToCheck: string): Promise<{ available: boolean; username: string } | null> => {
			if (!usernameToCheck || validateUsernameFormat(usernameToCheck)) {
				return null
			}

			try {
				// utils.user.checkUsername.fetch is stable and doesn't cause re-renders
				const result = await utils.user.checkUsername.fetch({ username: usernameToCheck })
				return result
			} catch (_error) {
				// Silent fail - just return null to indicate check failed
				return null
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps -- utils is stable from useUtils()
		[utils.user.checkUsername.fetch],
	)

	// Validate username on blur (fallback if debounce didn't complete)
	const handleUsernameBlur = useCallback(async () => {
		// Skip if empty, unchanged, has format error, or already checked
		if (
			!username ||
			username === savedUsername ||
			validateUsernameFormat(username) ||
			usernameAvailable !== null ||
			usernameChecking
		) {
			return
		}

		// Trigger immediate check if debounce hasn't fired yet
		setUsernameChecking(true)
		const result = await checkUsernameAvailability(username)
		if (result) {
			setUsernameAvailable(result.available)
			if (!result.available) {
				setUsernameError(t('usernameTaken'))
			}
		}
		setUsernameChecking(false)
	}, [username, savedUsername, usernameAvailable, usernameChecking, checkUsernameAvailability, t])

	// Auto-lowercase username + real-time format validation
	const handleUsernameChange = (value: string) => {
		const lowercased = value.toLowerCase()
		setUsername(lowercased)
		setUsernameAvailable(null)
		setRecoverySuggestions([]) // Clear recovery suggestions on change

		// Real-time format validation (instant feedback)
		if (!lowercased) {
			setUsernameError(null)
		} else {
			const formatError = validateUsernameFormat(lowercased)
			setUsernameError(formatError)
		}
	}

	// Debounced availability check while typing
	useEffect(() => {
		// Skip if empty, same as saved, or has format error
		if (!username || username === savedUsername || validateUsernameFormat(username)) {
			setRecoverySuggestions([])
			return
		}

		let cancelled = false

		const timer = setTimeout(async () => {
			setUsernameChecking(true)
			const result = await checkUsernameAvailability(username)

			// Don't update state if cancelled (username changed during check)
			if (cancelled) return

			if (result) {
				setUsernameAvailable(result.available)
				if (!result.available) {
					setUsernameError(t('usernameTaken'))
					// Generate Facebook-style recovery suggestions
					setRecoverySuggestions(generateRecoverySuggestions(username))
				} else {
					setRecoverySuggestions([])
				}
			}
			setUsernameChecking(false)
		}, 500) // 500ms debounce

		return () => {
			cancelled = true
			clearTimeout(timer)
		}
	}, [username, savedUsername, checkUsernameAvailability, t])

	// Save name
	const handleSaveName = async () => {
		if (!name.trim()) {
			toast.error(t('nameRequired'), t('nameRequiredDescription'))
			return
		}

		await updateProfile.mutateAsync({ name })
		setEditingName(false)
	}

	// Save username
	const handleSaveUsername = async () => {
		const trimmedUsername = username.trim().toLowerCase()

		if (!trimmedUsername) {
			toast.error(t('usernameRequired'), t('usernameRequiredDescription'))
			return
		}

		// Skip if no change
		if (trimmedUsername === savedUsername) {
			setEditingUsername(false)
			return
		}

		// Validate format
		const formatError = validateUsernameFormat(trimmedUsername)
		if (formatError) {
			setUsernameError(formatError)
			toast.error(t('usernameInvalid'), formatError)
			return
		}

		// Check availability if not already checked
		if (usernameAvailable === null) {
			setUsernameChecking(true)
			const result = await checkUsernameAvailability(trimmedUsername)
			setUsernameChecking(false)

			if (!result) {
				toast.error(t('checkFailed'), t('checkFailedDescription'))
				return
			}

			if (!result.available) {
				setUsernameAvailable(false)
				setUsernameError(t('usernameTaken'))
				toast.error(t('usernameTaken'), t('usernameTakenDescription'))
				return
			}
			setUsernameAvailable(true)
		}

		if (usernameAvailable === false) {
			toast.error(t('usernameTaken'), usernameError || t('usernameTakenDescription'))
			return
		}

		await updateProfile.mutateAsync({ username: trimmedUsername })
		setEditingUsername(false)
		setUsernameAvailable(null)
	}

	// Bio auto-save with proper race condition handling
	// Uses ref to track pending bio value and prevent stale saves
	const pendingBioRef = useRef<string | null>(null)
	const bioSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const [bioSaving, setBioSaving] = useState(false)

	// Stable save function that uses ref for latest value
	const saveBio = useCallback(async () => {
		const bioToSave = pendingBioRef.current
		if (bioToSave === null) return

		// Clear pending to prevent duplicate saves
		pendingBioRef.current = null
		setBioSaving(true)

		try {
			await updateProfile.mutateAsync({ bio: bioToSave })
		} finally {
			setBioSaving(false)
		}
	}, [updateProfile])

	// Effect to trigger debounced save when bio changes
	useEffect(() => {
		// Skip if bio matches saved value
		if (bio === savedBio) {
			pendingBioRef.current = null
			return
		}

		// Store the latest bio value in ref
		pendingBioRef.current = bio

		// Clear existing timer
		if (bioSaveTimerRef.current) {
			clearTimeout(bioSaveTimerRef.current)
		}

		// Set new debounced save
		bioSaveTimerRef.current = setTimeout(() => {
			saveBio()
		}, 1000)

		return () => {
			if (bioSaveTimerRef.current) {
				clearTimeout(bioSaveTimerRef.current)
			}
		}
	}, [bio, savedBio, saveBio])

	return (
		<div className="space-y-6">
			{/* Display Name */}
			<div>
				{/* biome-ignore lint/a11y/noLabelWithoutControl: Label is for conditional input */}
				<label className="mb-2 block text-sm font-medium">{t('displayName')}</label>
				{editingName ? (
					<div className="flex items-center gap-2">
						<Input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder={t('displayNamePlaceholder')}
							className="flex-1"
							autoFocus
						/>
						<Button
							onClick={handleSaveName}
							disabled={updateProfile.isPending || !name.trim()}
							size="sm"
						>
							{updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('save')}
						</Button>
						<Button
							variant="outline"
							onClick={() => {
								setName(savedName || '')
								setEditingName(false)
							}}
							size="sm"
						>
							{t('cancel')}
						</Button>
					</div>
				) : (
					<div className="flex items-center justify-between">
						<p className="text-base">{savedName || t('noNameSet')}</p>
						<Button variant="outline" size="sm" onClick={() => setEditingName(true)}>
							{t('edit')}
						</Button>
					</div>
				)}
			</div>

			{/* Username */}
			<div>
				{/* biome-ignore lint/a11y/noLabelWithoutControl: Label is for conditional input */}
				<label className="mb-2 block text-sm font-medium">
					{t('username')}
					<span className="ml-2 text-xs text-muted-foreground">{t('usernameHint')}</span>
				</label>
				{editingUsername ? (
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<div className="relative flex-1">
								<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
									@
								</span>
								<Input
									value={username}
									onChange={(e) => handleUsernameChange(e.target.value)}
									onBlur={handleUsernameBlur}
									placeholder={t('usernamePlaceholder')}
									className="pl-7"
									error={usernameError || undefined}
									autoFocus
								/>
								{usernameChecking && (
									<Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
								)}
								{!usernameChecking && usernameAvailable === true && (
									<CheckCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-success" />
								)}
								{!usernameChecking && usernameAvailable === false && (
									<XCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-error" />
								)}
							</div>
							<Button
								onClick={handleSaveUsername}
								disabled={
									updateProfile.isPending ||
									usernameChecking ||
									!username.trim() ||
									usernameAvailable === false ||
									!!usernameError
								}
								size="sm"
							>
								{updateProfile.isPending || usernameChecking ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									t('save')
								)}
							</Button>
							<Button
								variant="outline"
								onClick={() => {
									setUsername(savedUsername || '')
									setEditingUsername(false)
									setUsernameError(null)
									setUsernameAvailable(null)
									setRecoverySuggestions([])
								}}
								size="sm"
							>
								{t('cancel')}
							</Button>
						</div>

						{/* Initial suggestions - show when input is empty */}
						{(() => {
							const availableSuggestions = suggestions.filter((s) => s !== savedUsername)
							if (availableSuggestions.length === 0 || username) return null
							return (
								<div className="flex flex-wrap items-center gap-2">
									<span className="flex items-center gap-1 text-xs text-muted-foreground">
										<Sparkles className="h-3 w-3" />
										{savedUsername ? t('try') : t('suggestions')}
									</span>
									{availableSuggestions.map((suggestion) => (
										<button
											key={suggestion}
											type="button"
											onClick={() => {
												setUsername(suggestion)
												setUsernameAvailable(null)
												setUsernameError(null)
												setRecoverySuggestions([])
											}}
											className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium hover:bg-muted/80 transition-colors"
										>
											@{suggestion}
										</button>
									))}
								</div>
							)
						})()}

						{/* Recovery suggestions - show when username is taken (Facebook-style) */}
						{usernameAvailable === false && recoverySuggestions.length > 0 && (
							<div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-2">
								<span className="text-xs text-muted-foreground">{t('tryInstead')}</span>
								{recoverySuggestions.map((suggestion) => (
									<button
										key={suggestion}
										type="button"
										onClick={() => {
											setUsername(suggestion)
											setUsernameAvailable(null)
											setUsernameError(null)
											setRecoverySuggestions([])
										}}
										className="rounded-full bg-background px-2.5 py-0.5 text-xs font-medium hover:bg-primary/10 transition-colors border"
									>
										@{suggestion}
									</button>
								))}
							</div>
						)}

						<p className="text-xs text-muted-foreground">{t('usernameRules')}</p>
					</div>
				) : (
					<div className="flex items-center justify-between">
						<p className="text-base">{savedUsername ? `@${savedUsername}` : t('noUsernameSet')}</p>
						<Button variant="outline" size="sm" onClick={() => setEditingUsername(true)}>
							{savedUsername ? t('edit') : t('setUsername')}
						</Button>
					</div>
				)}
			</div>

			{/* Bio */}
			<div>
				<label htmlFor="profile-bio" className="mb-2 block text-sm font-medium">
					{t('bio')}
				</label>
				<Textarea
					id="profile-bio"
					value={bio}
					onChange={(e) => setBio(e.target.value)}
					placeholder={t('bioPlaceholder')}
					maxLength={bioMaxLength}
					rows={3}
				/>
				<div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
					<span>{t('bioHint')}</span>
					<span className={bioCharCount > bioMaxLength - 20 ? 'text-warning' : ''}>
						{t('bioCharacters', { count: bioCharCount })}
					</span>
				</div>
				{bioSaving && <p className="mt-1 text-xs text-muted-foreground">{t('saving')}</p>}
			</div>
		</div>
	)
}
