/**
 * Email Module Tests
 *
 * Tests for transactional email functions.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { SylphxConfig } from '../src/config'
import {
	cancelScheduledEmail,
	getScheduledEmail,
	getScheduledEmailStats,
	isEmailConfigured,
	listScheduledEmails,
	rescheduleEmail,
	scheduleEmail,
	sendEmail,
	sendEmailToUser,
	sendTemplatedEmail,
} from '../src/email'

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
// isEmailConfigured Tests
// ============================================================================

describe('isEmailConfigured', () => {
	test('returns true when email is configured', async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(true))
		}) as typeof fetch

		const result = await isEmailConfigured(mockConfig)

		expect(result).toBe(true)
		expect(getLastCall()?.url).toContain('/email/configured')
		expect(getLastCall()?.options.method).toBe('GET')
	})

	test('returns false when email is not configured', async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(false))
		}) as typeof fetch

		const result = await isEmailConfigured(mockConfig)

		expect(result).toBe(false)
	})
})

// ============================================================================
// sendEmail Tests
// ============================================================================

describe('sendEmail', () => {
	test('sends a custom email', async () => {
		const mockResponse = { id: 'email-123', success: true }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await sendEmail(mockConfig, {
			to: 'user@example.com',
			subject: 'Hello!',
			html: '<p>Welcome to our app!</p>',
		})

		expect(result.success).toBe(true)
		expect(result.id).toBe('email-123')
		expect(getLastCall()?.url).toContain('/email/send')
		expect(getLastCall()?.options.method).toBe('POST')
	})

	test('includes all email options', async () => {
		const mockResponse = { id: 'email-123', success: true }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await sendEmail(mockConfig, {
			to: 'user@example.com',
			subject: 'Test Subject',
			html: '<p>HTML content</p>',
			text: 'Plain text content',
			replyTo: 'support@example.com',
		})

		const body = getRequestBody()
		expect(body?.to).toBe('user@example.com')
		expect(body?.subject).toBe('Test Subject')
		expect(body?.html).toBe('<p>HTML content</p>')
		expect(body?.text).toBe('Plain text content')
		expect(body?.replyTo).toBe('support@example.com')
	})
})

// ============================================================================
// sendTemplatedEmail Tests
// ============================================================================

describe('sendTemplatedEmail', () => {
	test('sends a welcome email', async () => {
		const mockResponse = { id: 'email-456', success: true }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await sendTemplatedEmail(mockConfig, {
			template: 'welcome',
			to: 'newuser@example.com',
			data: { name: 'John' },
		})

		expect(result.success).toBe(true)
		expect(getLastCall()?.url).toContain('/email/send-templated')
		const body = getRequestBody()
		expect(body?.template).toBe('welcome')
		expect(body?.data).toEqual({ name: 'John' })
	})

	test('sends a verification email', async () => {
		const mockResponse = { id: 'email-789', success: true }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await sendTemplatedEmail(mockConfig, {
			template: 'verification',
			to: 'user@example.com',
			data: { verificationLink: 'https://example.com/verify?token=abc' },
		})

		const body = getRequestBody()
		expect(body?.template).toBe('verification')
	})

	test('sends a password reset email', async () => {
		const mockResponse = { id: 'email-101', success: true }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await sendTemplatedEmail(mockConfig, {
			template: 'password_reset',
			to: 'user@example.com',
			data: { resetLink: 'https://example.com/reset?token=xyz' },
		})

		const body = getRequestBody()
		expect(body?.template).toBe('password_reset')
	})

	test('sends a security alert email', async () => {
		const mockResponse = { id: 'email-202', success: true }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await sendTemplatedEmail(mockConfig, {
			template: 'security_alert',
			to: 'user@example.com',
			data: { alertType: 'new_login', location: 'New York, US' },
		})

		const body = getRequestBody()
		expect(body?.template).toBe('security_alert')
	})
})

// ============================================================================
// sendEmailToUser Tests
// ============================================================================

describe('sendEmailToUser', () => {
	test('sends email to user by ID', async () => {
		const mockResponse = { id: 'email-user', success: true }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await sendEmailToUser(mockConfig, {
			userId: 'user-123',
			subject: 'Account Update',
			html: '<p>Your account has been updated.</p>',
		})

		expect(result.success).toBe(true)
		expect(getLastCall()?.url).toContain('/email/send-to-user')
		const body = getRequestBody()
		expect(body?.userId).toBe('user-123')
	})

	test('includes text fallback', async () => {
		const mockResponse = { id: 'email-user', success: true }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await sendEmailToUser(mockConfig, {
			userId: 'user-456',
			subject: 'Plain Text Test',
			html: '<p>HTML version</p>',
			text: 'Plain text version',
		})

		const body = getRequestBody()
		expect(body?.text).toBe('Plain text version')
	})
})

// ============================================================================
// scheduleEmail Tests
// ============================================================================

describe('scheduleEmail', () => {
	test('schedules an email for future delivery', async () => {
		const mockResponse = {
			id: 'scheduled-123',
			to: 'user@example.com',
			toName: null,
			subject: 'Reminder',
			status: 'pending',
			scheduledFor: '2025-01-20T09:00:00Z',
			sentAt: null,
			createdAt: '2025-01-15T10:00:00Z',
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await scheduleEmail(mockConfig, {
			to: 'user@example.com',
			subject: 'Reminder',
			html: "<p>Don't forget!</p>",
			scheduledFor: '2025-01-20T09:00:00Z',
		})

		expect(result.status).toBe('pending')
		expect(result.scheduledFor).toBe('2025-01-20T09:00:00Z')
		expect(getLastCall()?.url).toContain('/email/schedule')
	})

	test('includes all scheduling options', async () => {
		const mockResponse = {
			id: 'scheduled-456',
			to: 'user@example.com',
			toName: 'John Doe',
			subject: 'Full Options Test',
			status: 'pending',
			scheduledFor: '2025-01-25T14:00:00Z',
			sentAt: null,
			createdAt: '2025-01-15T10:00:00Z',
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await scheduleEmail(mockConfig, {
			to: 'user@example.com',
			toName: 'John Doe',
			subject: 'Full Options Test',
			html: '<p>HTML content</p>',
			text: 'Text content',
			replyTo: 'reply@example.com',
			fromEmail: 'noreply@example.com',
			fromName: 'Example App',
			scheduledFor: '2025-01-25T14:00:00Z',
			templateKey: 'custom-template',
			templateData: { key: 'value' },
			idempotencyKey: 'unique-key-123',
			metadata: { campaign: 'winter-sale' },
		})

		const body = getRequestBody()
		expect(body?.toName).toBe('John Doe')
		expect(body?.replyTo).toBe('reply@example.com')
		expect(body?.fromEmail).toBe('noreply@example.com')
		expect(body?.idempotencyKey).toBe('unique-key-123')
	})
})

// ============================================================================
// listScheduledEmails Tests
// ============================================================================

describe('listScheduledEmails', () => {
	test('lists all scheduled emails', async () => {
		const mockResponse = {
			emails: [
				{
					id: 'scheduled-1',
					to: 'user1@example.com',
					subject: 'Email 1',
					status: 'pending',
					scheduledFor: '2025-01-20T09:00:00Z',
				},
				{
					id: 'scheduled-2',
					to: 'user2@example.com',
					subject: 'Email 2',
					status: 'sent',
					scheduledFor: '2025-01-15T09:00:00Z',
				},
			],
			total: 2,
			hasMore: false,
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await listScheduledEmails(mockConfig)

		expect(result.emails).toHaveLength(2)
		expect(result.total).toBe(2)
		expect(getLastCall()?.url).toContain('/email/scheduled')
	})

	test('filters by status', async () => {
		const mockResponse = { emails: [], total: 0, hasMore: false }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await listScheduledEmails(mockConfig, { status: 'pending' })

		expect(getLastCall()?.url).toContain('status=pending')
	})

	test('paginates results', async () => {
		const mockResponse = { emails: [], total: 100, hasMore: true }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await listScheduledEmails(mockConfig, { limit: 20, offset: 40 })

		expect(getLastCall()?.url).toContain('limit=20')
		expect(getLastCall()?.url).toContain('offset=40')
	})
})

// ============================================================================
// getScheduledEmail Tests
// ============================================================================

describe('getScheduledEmail', () => {
	test('gets a scheduled email by ID', async () => {
		const mockResponse = {
			id: 'scheduled-123',
			to: 'user@example.com',
			toName: 'John',
			subject: 'Test Email',
			status: 'pending',
			scheduledFor: '2025-01-20T09:00:00Z',
			sentAt: null,
			createdAt: '2025-01-15T10:00:00Z',
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await getScheduledEmail(mockConfig, 'scheduled-123')

		expect(result.id).toBe('scheduled-123')
		expect(result.status).toBe('pending')
		expect(getLastCall()?.url).toContain('/email/scheduled/scheduled-123')
	})
})

// ============================================================================
// cancelScheduledEmail Tests
// ============================================================================

describe('cancelScheduledEmail', () => {
	test('cancels a scheduled email', async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({}))
		}) as typeof fetch

		await cancelScheduledEmail(mockConfig, 'scheduled-123')

		expect(getLastCall()?.url).toContain('/email/scheduled/scheduled-123/cancel')
		expect(getLastCall()?.options.method).toBe('POST')
	})
})

// ============================================================================
// rescheduleEmail Tests
// ============================================================================

describe('rescheduleEmail', () => {
	test('reschedules an email', async () => {
		const mockResponse = {
			id: 'scheduled-123',
			to: 'user@example.com',
			toName: null,
			subject: 'Rescheduled Email',
			status: 'pending',
			scheduledFor: '2025-01-25T15:00:00Z',
			sentAt: null,
			createdAt: '2025-01-15T10:00:00Z',
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await rescheduleEmail(mockConfig, 'scheduled-123', '2025-01-25T15:00:00Z')

		expect(result.scheduledFor).toBe('2025-01-25T15:00:00Z')
		expect(getLastCall()?.url).toContain('/email/scheduled/scheduled-123/reschedule')
		const body = getRequestBody()
		expect(body?.scheduledFor).toBe('2025-01-25T15:00:00Z')
	})
})

// ============================================================================
// getScheduledEmailStats Tests
// ============================================================================

describe('getScheduledEmailStats', () => {
	test('returns email statistics', async () => {
		const mockResponse = {
			total: 100,
			pending: 25,
			queued: 5,
			sent: 60,
			cancelled: 8,
			failed: 2,
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await getScheduledEmailStats(mockConfig)

		expect(result.total).toBe(100)
		expect(result.pending).toBe(25)
		expect(result.sent).toBe(60)
		expect(getLastCall()?.url).toContain('/email/scheduled/stats')
	})
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
	test('handles HTML with special characters', async () => {
		const mockResponse = { id: 'email-special', success: true }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const html = '<p>Price: $100 &amp; <strong>50% off</strong></p>'

		await sendEmail(mockConfig, {
			to: 'user@example.com',
			subject: 'Special <Offer>',
			html,
		})

		const body = getRequestBody()
		expect(body?.html).toBe(html)
	})

	test('handles multiple recipients conceptually (to is single email)', async () => {
		const mockResponse = { id: 'email-123', success: true }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await sendEmail(mockConfig, {
			to: 'user@example.com',
			subject: 'Test',
			html: '<p>Test</p>',
		})

		const body = getRequestBody()
		expect(body?.to).toBe('user@example.com')
	})

	test('handles long subject lines', async () => {
		const mockResponse = { id: 'email-long', success: true }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const longSubject = 'A'.repeat(200)

		await sendEmail(mockConfig, {
			to: 'user@example.com',
			subject: longSubject,
			html: '<p>Content</p>',
		})

		const body = getRequestBody()
		expect(body?.subject).toBe(longSubject)
	})

	test('handles empty template data', async () => {
		const mockResponse = { id: 'email-nodata', success: true }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await sendTemplatedEmail(mockConfig, {
			template: 'welcome',
			to: 'user@example.com',
		})

		const body = getRequestBody()
		expect(body?.data).toBeUndefined()
	})
})
