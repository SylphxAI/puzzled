/**
 * Organizations Module Tests
 *
 * Tests for organization management functions.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { SylphxConfig } from '../src/config'
import {
	acceptOrganizationInvitation,
	canDeleteOrganization,
	canManageMembers,
	canManageSettings,
	createOrganization,
	deleteOrganization,
	getOrganization,
	getOrganizationInvitations,
	getOrganizationMembers,
	getOrganizations,
	hasRole,
	inviteOrganizationMember,
	leaveOrganization,
	removeOrganizationMember,
	revokeOrganizationInvitation,
	updateOrganization,
	updateOrganizationMemberRole,
	type OrganizationMembership,
	type OrgRole,
} from '../src/orgs'

// ============================================================================
// Test Setup
// ============================================================================

const mockConfig: SylphxConfig = {
	secretKey: 'sk_dev_test123',
	platformUrl: 'https://api.sylphx.com',
}

let fetchCalls: Array<{ url: string; options: RequestInit }> = []
const originalFetch = globalThis.fetch

function createMockResponse<T>(data: T, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	})
}

function getLastCall() {
	return fetchCalls[fetchCalls.length - 1]
}

function getRequestBody(): Record<string, unknown> | null {
	const last = getLastCall()
	if (!last?.options.body) return null
	return JSON.parse(last.options.body as string)
}

beforeEach(() => {
	fetchCalls = []
})

afterEach(() => {
	globalThis.fetch = originalFetch
})

// ============================================================================
// Organization CRUD Tests
// ============================================================================

describe('getOrganizations', () => {
	test('returns all organizations for the user', async () => {
		const mockResponse = {
			organizations: [
				{ id: 'org-1', name: 'Acme Corp', slug: 'acme-corp' },
				{ id: 'org-2', name: 'Globex Inc', slug: 'globex-inc' },
			],
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await getOrganizations(mockConfig)

		expect(result.organizations).toHaveLength(2)
		expect(result.organizations[0]?.name).toBe('Acme Corp')
		expect(getLastCall()?.url).toContain('/orgs')
	})

	test('returns empty array when user has no organizations', async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({ organizations: [] }))
		}) as typeof fetch

		const result = await getOrganizations(mockConfig)

		expect(result.organizations).toHaveLength(0)
	})
})

describe('getOrganization', () => {
	test('gets organization by ID', async () => {
		const mockResponse = {
			organization: { id: 'org-123', name: 'Acme Corp', slug: 'acme-corp' },
			membership: { role: 'admin' },
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await getOrganization(mockConfig, 'org-123')

		expect(result.organization.name).toBe('Acme Corp')
		expect(result.membership?.role).toBe('admin')
		expect(getLastCall()?.url).toContain('/orgs/org-123')
	})

	test('gets organization by slug', async () => {
		const mockResponse = {
			organization: { id: 'org-123', name: 'Acme Corp', slug: 'acme-corp' },
			membership: null,
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await getOrganization(mockConfig, 'acme-corp')

		expect(result.organization.slug).toBe('acme-corp')
		expect(result.membership).toBeNull()
		expect(getLastCall()?.url).toContain('/orgs/acme-corp')
	})
})

describe('createOrganization', () => {
	test('creates a new organization', async () => {
		const mockResponse = {
			organization: {
				id: 'org-new',
				name: 'New Company',
				slug: 'new-company',
			},
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await createOrganization(mockConfig, {
			name: 'New Company',
			slug: 'new-company',
		})

		expect(result.organization.name).toBe('New Company')
		expect(getLastCall()?.options.method).toBe('POST')
		const body = getRequestBody()
		expect(body?.name).toBe('New Company')
		expect(body?.slug).toBe('new-company')
	})
})

describe('updateOrganization', () => {
	test('updates organization name', async () => {
		const mockResponse = {
			organization: { id: 'org-123', name: 'Updated Name', slug: 'acme-corp' },
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await updateOrganization(mockConfig, 'org-123', { name: 'Updated Name' })

		expect(result.organization.name).toBe('Updated Name')
		expect(getLastCall()?.options.method).toBe('PUT')
		const body = getRequestBody()
		expect(body?.name).toBe('Updated Name')
	})
})

describe('deleteOrganization', () => {
	test('deletes an organization', async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({ success: true }))
		}) as typeof fetch

		const result = await deleteOrganization(mockConfig, 'org-123')

		expect(result.success).toBe(true)
		expect(getLastCall()?.options.method).toBe('DELETE')
		expect(getLastCall()?.url).toContain('/orgs/org-123')
	})
})

// ============================================================================
// Member Tests
// ============================================================================

describe('getOrganizationMembers', () => {
	test('returns organization members', async () => {
		const mockResponse = {
			members: [
				{ id: 'user-1', name: 'Alice', role: 'super_admin' },
				{ id: 'user-2', name: 'Bob', role: 'developer' },
			],
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await getOrganizationMembers(mockConfig, 'acme-corp')

		expect(result.members).toHaveLength(2)
		expect(getLastCall()?.url).toContain('/orgs/acme-corp/members')
	})
})

describe('inviteOrganizationMember', () => {
	test('invites a member by email', async () => {
		const mockResponse = {
			invitation: {
				id: 'inv-123',
				email: 'user@example.com',
				role: 'developer',
			},
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await inviteOrganizationMember(mockConfig, 'acme-corp', {
			email: 'user@example.com',
			role: 'developer',
		})

		expect(result.invitation.email).toBe('user@example.com')
		expect(getLastCall()?.options.method).toBe('POST')
		expect(getLastCall()?.url).toContain('/orgs/acme-corp/members/invite')
	})
})

describe('updateOrganizationMemberRole', () => {
	test('updates member role', async () => {
		const mockResponse = {
			member: { id: 'user-123', name: 'Bob', role: 'admin' },
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await updateOrganizationMemberRole(mockConfig, 'acme-corp', 'user-123', 'admin')

		expect(result.member.role).toBe('admin')
		expect(getLastCall()?.options.method).toBe('PUT')
		const body = getRequestBody()
		expect(body?.role).toBe('admin')
	})
})

describe('removeOrganizationMember', () => {
	test('removes a member', async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({ success: true }))
		}) as typeof fetch

		const result = await removeOrganizationMember(mockConfig, 'acme-corp', 'user-123')

		expect(result.success).toBe(true)
		expect(getLastCall()?.options.method).toBe('DELETE')
		expect(getLastCall()?.url).toContain('/orgs/acme-corp/members/user-123')
	})
})

describe('leaveOrganization', () => {
	test('leaves an organization', async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({ success: true }))
		}) as typeof fetch

		const result = await leaveOrganization(mockConfig, 'acme-corp')

		expect(result.success).toBe(true)
		expect(getLastCall()?.options.method).toBe('POST')
		expect(getLastCall()?.url).toContain('/orgs/acme-corp/leave')
	})
})

// ============================================================================
// Invitation Tests
// ============================================================================

describe('getOrganizationInvitations', () => {
	test('returns pending invitations', async () => {
		const mockResponse = {
			invitations: [
				{ id: 'inv-1', email: 'user1@example.com', role: 'developer' },
				{ id: 'inv-2', email: 'user2@example.com', role: 'viewer' },
			],
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await getOrganizationInvitations(mockConfig, 'acme-corp')

		expect(result.invitations).toHaveLength(2)
		expect(getLastCall()?.url).toContain('/orgs/acme-corp/invitations')
	})
})

describe('acceptOrganizationInvitation', () => {
	test('accepts an invitation with token', async () => {
		const mockResponse = {
			organization: { id: 'org-123', name: 'Acme Corp' },
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await acceptOrganizationInvitation(mockConfig, 'invitation-token-abc')

		expect(result.organization.name).toBe('Acme Corp')
		expect(getLastCall()?.options.method).toBe('POST')
		expect(getLastCall()?.url).toContain('/orgs/invitations/accept')
		const body = getRequestBody()
		expect(body?.token).toBe('invitation-token-abc')
	})
})

describe('revokeOrganizationInvitation', () => {
	test('revokes an invitation', async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({ success: true }))
		}) as typeof fetch

		const result = await revokeOrganizationInvitation(mockConfig, 'acme-corp', 'inv-123')

		expect(result.success).toBe(true)
		expect(getLastCall()?.options.method).toBe('DELETE')
		expect(getLastCall()?.url).toContain('/orgs/acme-corp/invitations/inv-123')
	})
})

// ============================================================================
// Role Helper Tests
// ============================================================================

describe('hasRole', () => {
	const roleHierarchy: OrgRole[] = [
		'viewer',
		'analytics',
		'developer',
		'billing',
		'admin',
		'super_admin',
	]

	test('returns false for null membership', () => {
		expect(hasRole(null, 'viewer')).toBe(false)
		expect(hasRole(null, 'admin')).toBe(false)
	})

	test('returns true when user has exact role', () => {
		for (const role of roleHierarchy) {
			const membership = { role } as OrganizationMembership
			expect(hasRole(membership, role)).toBe(true)
		}
	})

	test('returns true when user has higher role', () => {
		const membership = { role: 'super_admin' } as OrganizationMembership
		for (const role of roleHierarchy) {
			expect(hasRole(membership, role)).toBe(true)
		}
	})

	test('returns false when user has lower role', () => {
		const membership = { role: 'viewer' } as OrganizationMembership
		expect(hasRole(membership, 'developer')).toBe(false)
		expect(hasRole(membership, 'admin')).toBe(false)
		expect(hasRole(membership, 'super_admin')).toBe(false)
	})

	test('role hierarchy is respected', () => {
		// viewer < analytics < developer < billing < admin < super_admin
		const viewerMembership = { role: 'viewer' } as OrganizationMembership
		const analyticsMembership = { role: 'analytics' } as OrganizationMembership
		const developerMembership = { role: 'developer' } as OrganizationMembership
		const billingMembership = { role: 'billing' } as OrganizationMembership
		const adminMembership = { role: 'admin' } as OrganizationMembership

		expect(hasRole(viewerMembership, 'analytics')).toBe(false)
		expect(hasRole(analyticsMembership, 'developer')).toBe(false)
		expect(hasRole(developerMembership, 'billing')).toBe(false)
		expect(hasRole(billingMembership, 'admin')).toBe(false)
		expect(hasRole(adminMembership, 'super_admin')).toBe(false)

		expect(hasRole(analyticsMembership, 'viewer')).toBe(true)
		expect(hasRole(developerMembership, 'analytics')).toBe(true)
		expect(hasRole(billingMembership, 'developer')).toBe(true)
		expect(hasRole(adminMembership, 'billing')).toBe(true)
	})
})

describe('canManageMembers', () => {
	test('returns false for null membership', () => {
		expect(canManageMembers(null)).toBe(false)
	})

	test('returns false for viewer role', () => {
		expect(canManageMembers({ role: 'viewer' } as OrganizationMembership)).toBe(false)
	})

	test('returns false for developer role', () => {
		expect(canManageMembers({ role: 'developer' } as OrganizationMembership)).toBe(false)
	})

	test('returns false for billing role', () => {
		expect(canManageMembers({ role: 'billing' } as OrganizationMembership)).toBe(false)
	})

	test('returns true for admin role', () => {
		expect(canManageMembers({ role: 'admin' } as OrganizationMembership)).toBe(true)
	})

	test('returns true for super_admin role', () => {
		expect(canManageMembers({ role: 'super_admin' } as OrganizationMembership)).toBe(true)
	})
})

describe('canManageSettings', () => {
	test('returns false for null membership', () => {
		expect(canManageSettings(null)).toBe(false)
	})

	test('returns false for non-admin roles', () => {
		expect(canManageSettings({ role: 'viewer' } as OrganizationMembership)).toBe(false)
		expect(canManageSettings({ role: 'developer' } as OrganizationMembership)).toBe(false)
		expect(canManageSettings({ role: 'billing' } as OrganizationMembership)).toBe(false)
	})

	test('returns true for admin and super_admin', () => {
		expect(canManageSettings({ role: 'admin' } as OrganizationMembership)).toBe(true)
		expect(canManageSettings({ role: 'super_admin' } as OrganizationMembership)).toBe(true)
	})
})

describe('canDeleteOrganization', () => {
	test('returns false for null membership', () => {
		expect(canDeleteOrganization(null)).toBe(false)
	})

	test('returns false for non-super_admin roles', () => {
		expect(canDeleteOrganization({ role: 'viewer' } as OrganizationMembership)).toBe(false)
		expect(canDeleteOrganization({ role: 'developer' } as OrganizationMembership)).toBe(false)
		expect(canDeleteOrganization({ role: 'admin' } as OrganizationMembership)).toBe(false)
	})

	test('returns true only for super_admin', () => {
		expect(canDeleteOrganization({ role: 'super_admin' } as OrganizationMembership)).toBe(true)
	})
})
