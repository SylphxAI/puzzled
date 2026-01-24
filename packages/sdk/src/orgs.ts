/**
 * Organization Functions
 *
 * Pure functions for organization management - no hidden state.
 * Each function takes config as the first parameter.
 *
 * Uses REST API at /api/sdk/orgs/* for all operations.
 */

import { type SylphxConfig, callApi } from './config'

// ============================================================================
// Types
// ============================================================================

export interface Organization {
	id: string
	name: string
	slug: string
	logoUrl: string | null
	email: string | null
	billingEmail: string | null
	createdAt: string
}

export interface OrganizationMember {
	id: string
	userId: string
	email: string
	name: string | null
	image: string | null
	role: OrgRole
	joinedAt: string
}

export interface OrganizationInvitation {
	id: string
	email: string
	role: OrgRole
	status: 'pending' | 'accepted' | 'expired' | 'revoked'
	invitedById: string
	invitedByName: string | null
	expiresAt: string
	createdAt: string
}

export interface OrganizationMembership {
	role: OrgRole
	joinedAt: string
}

export type OrgRole =
	| 'super_admin'
	| 'admin'
	| 'billing'
	| 'analytics'
	| 'developer'
	| 'viewer'

export interface CreateOrgInput {
	name: string
	slug?: string
	email?: string
}

export interface UpdateOrgInput {
	name?: string
	slug?: string
	logoUrl?: string | null
	email?: string | null
	billingEmail?: string | null
}

export interface InviteMemberInput {
	email: string
	role: OrgRole
}

// ============================================================================
// Organization CRUD
// ============================================================================

/**
 * Get all organizations the current user belongs to
 *
 * @example
 * ```typescript
 * const { organizations } = await getOrganizations(config)
 * ```
 */
export async function getOrganizations(
	config: SylphxConfig,
): Promise<{ organizations: Organization[] }> {
	return callApi<{ organizations: Organization[] }>(config, '/orgs')
}

/**
 * Get organization by ID or slug
 *
 * @example
 * ```typescript
 * const { organization, membership } = await getOrganization(config, 'my-org')
 * ```
 */
export async function getOrganization(
	config: SylphxConfig,
	orgIdOrSlug: string,
): Promise<{ organization: Organization; membership: OrganizationMembership | null }> {
	return callApi<{ organization: Organization; membership: OrganizationMembership | null }>(
		config,
		`/orgs/${orgIdOrSlug}`,
	)
}

/**
 * Create a new organization
 *
 * @example
 * ```typescript
 * const { organization } = await createOrganization(config, {
 *   name: 'My Company',
 *   slug: 'my-company',
 * })
 * ```
 */
export async function createOrganization(
	config: SylphxConfig,
	input: CreateOrgInput,
): Promise<{ organization: Organization }> {
	return callApi<{ organization: Organization }>(config, '/orgs', {
		method: 'POST',
		body: input,
	})
}

/**
 * Update an organization
 *
 * @example
 * ```typescript
 * const { organization } = await updateOrganization(config, 'my-org', {
 *   name: 'New Name',
 * })
 * ```
 */
export async function updateOrganization(
	config: SylphxConfig,
	orgIdOrSlug: string,
	input: UpdateOrgInput,
): Promise<{ organization: Organization }> {
	return callApi<{ organization: Organization }>(config, `/orgs/${orgIdOrSlug}`, {
		method: 'PUT',
		body: input,
	})
}

/**
 * Delete an organization
 *
 * Requires super_admin role.
 *
 * @example
 * ```typescript
 * await deleteOrganization(config, 'my-org')
 * ```
 */
export async function deleteOrganization(
	config: SylphxConfig,
	orgIdOrSlug: string,
): Promise<{ success: boolean }> {
	return callApi<{ success: boolean }>(config, `/orgs/${orgIdOrSlug}`, {
		method: 'DELETE',
	})
}

// ============================================================================
// Members
// ============================================================================

/**
 * Get organization members
 *
 * @example
 * ```typescript
 * const { members } = await getOrganizationMembers(config, 'my-org')
 * ```
 */
export async function getOrganizationMembers(
	config: SylphxConfig,
	orgIdOrSlug: string,
): Promise<{ members: OrganizationMember[] }> {
	return callApi<{ members: OrganizationMember[] }>(config, `/orgs/${orgIdOrSlug}/members`)
}

/**
 * Invite a member to an organization
 *
 * Requires admin or super_admin role.
 *
 * @example
 * ```typescript
 * const { invitation } = await inviteOrganizationMember(config, 'my-org', {
 *   email: 'user@example.com',
 *   role: 'developer',
 * })
 * ```
 */
export async function inviteOrganizationMember(
	config: SylphxConfig,
	orgIdOrSlug: string,
	input: InviteMemberInput,
): Promise<{ invitation: OrganizationInvitation }> {
	return callApi<{ invitation: OrganizationInvitation }>(
		config,
		`/orgs/${orgIdOrSlug}/members/invite`,
		{
			method: 'POST',
			body: input,
		},
	)
}

/**
 * Update a member's role
 *
 * Requires admin or super_admin role.
 *
 * @example
 * ```typescript
 * const { member } = await updateOrganizationMemberRole(config, 'my-org', userId, 'admin')
 * ```
 */
export async function updateOrganizationMemberRole(
	config: SylphxConfig,
	orgIdOrSlug: string,
	memberId: string,
	role: OrgRole,
): Promise<{ member: OrganizationMember }> {
	return callApi<{ member: OrganizationMember }>(
		config,
		`/orgs/${orgIdOrSlug}/members/${memberId}/role`,
		{
			method: 'PUT',
			body: { role },
		},
	)
}

/**
 * Remove a member from an organization
 *
 * Requires admin or super_admin role.
 *
 * @example
 * ```typescript
 * await removeOrganizationMember(config, 'my-org', userId)
 * ```
 */
export async function removeOrganizationMember(
	config: SylphxConfig,
	orgIdOrSlug: string,
	memberId: string,
): Promise<{ success: boolean }> {
	return callApi<{ success: boolean }>(config, `/orgs/${orgIdOrSlug}/members/${memberId}`, {
		method: 'DELETE',
	})
}

/**
 * Leave an organization
 *
 * @example
 * ```typescript
 * await leaveOrganization(config, 'my-org')
 * ```
 */
export async function leaveOrganization(
	config: SylphxConfig,
	orgIdOrSlug: string,
): Promise<{ success: boolean }> {
	return callApi<{ success: boolean }>(config, `/orgs/${orgIdOrSlug}/leave`, {
		method: 'POST',
	})
}

// ============================================================================
// Invitations
// ============================================================================

/**
 * Get pending invitations for an organization
 *
 * Requires admin or super_admin role.
 *
 * @example
 * ```typescript
 * const { invitations } = await getOrganizationInvitations(config, 'my-org')
 * ```
 */
export async function getOrganizationInvitations(
	config: SylphxConfig,
	orgIdOrSlug: string,
): Promise<{ invitations: OrganizationInvitation[] }> {
	return callApi<{ invitations: OrganizationInvitation[] }>(
		config,
		`/orgs/${orgIdOrSlug}/invitations`,
	)
}

/**
 * Accept an organization invitation
 *
 * @example
 * ```typescript
 * const { organization } = await acceptOrganizationInvitation(config, invitationToken)
 * ```
 */
export async function acceptOrganizationInvitation(
	config: SylphxConfig,
	token: string,
): Promise<{ organization: Organization }> {
	return callApi<{ organization: Organization }>(config, '/orgs/invitations/accept', {
		method: 'POST',
		body: { token },
	})
}

/**
 * Revoke a pending invitation
 *
 * Requires admin or super_admin role.
 *
 * @example
 * ```typescript
 * await revokeOrganizationInvitation(config, 'my-org', invitationId)
 * ```
 */
export async function revokeOrganizationInvitation(
	config: SylphxConfig,
	orgIdOrSlug: string,
	invitationId: string,
): Promise<{ success: boolean }> {
	return callApi<{ success: boolean }>(
		config,
		`/orgs/${orgIdOrSlug}/invitations/${invitationId}`,
		{
			method: 'DELETE',
		},
	)
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if user has a specific role or higher in the organization
 */
export function hasRole(membership: OrganizationMembership | null, minimumRole: OrgRole): boolean {
	if (!membership) return false

	const roleHierarchy: OrgRole[] = [
		'viewer',
		'analytics',
		'developer',
		'billing',
		'admin',
		'super_admin',
	]

	const userRoleIndex = roleHierarchy.indexOf(membership.role)
	const requiredRoleIndex = roleHierarchy.indexOf(minimumRole)

	return userRoleIndex >= requiredRoleIndex
}

/**
 * Check if user can manage members (invite, remove, change roles)
 */
export function canManageMembers(membership: OrganizationMembership | null): boolean {
	return hasRole(membership, 'admin')
}

/**
 * Check if user can manage organization settings
 */
export function canManageSettings(membership: OrganizationMembership | null): boolean {
	return hasRole(membership, 'admin')
}

/**
 * Check if user can delete the organization
 */
export function canDeleteOrganization(membership: OrganizationMembership | null): boolean {
	return hasRole(membership, 'super_admin')
}
