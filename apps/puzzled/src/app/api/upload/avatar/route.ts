/**
 * Avatar Upload Endpoint
 *
 * Handles user avatar image uploads with Vercel Blob storage.
 * - Validates file type and size
 * - Processes image with sharp (resize to 256x256, WebP)
 * - Uploads optimized image to Vercel Blob
 * - Updates user.image in database
 */

import { del, put } from '@vercel/blob'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { auth } from '@sylphx/platform-sdk/nextjs'
import { FILE_LIMITS } from '@/lib/config/validation'
import { db, users } from '@/lib/db'

export const runtime = 'nodejs'

const AVATAR_SIZE = 256

/**
 * POST /api/upload/avatar
 *
 * Upload and process user avatar image.
 * Requires authentication.
 */
export async function POST(request: Request) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
		}

		const formData = await request.formData()
		const file = formData.get('file') as File | null

		if (!file) {
			return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
		}

		// Validate file type (use centralized config)
		if (
			!FILE_LIMITS.AVATAR_ALLOWED_TYPES.includes(
				file.type as (typeof FILE_LIMITS.AVATAR_ALLOWED_TYPES)[number],
			)
		) {
			return NextResponse.json(
				{
					success: false,
					error: 'Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.',
				},
				{ status: 400 },
			)
		}

		// Validate file size (use centralized config)
		if (file.size > FILE_LIMITS.AVATAR_MAX_SIZE) {
			return NextResponse.json(
				{
					success: false,
					error: 'File too large. Maximum size is 5MB.',
				},
				{ status: 400 },
			)
		}

		// Get current user to check for existing avatar
		const [currentUserRecord] = await db
			.select({ image: users.image })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1)

		// Process image with sharp
		const arrayBuffer = await file.arrayBuffer()
		const buffer = Buffer.from(arrayBuffer)

		const optimizedImage = await sharp(buffer)
			.resize(AVATAR_SIZE, AVATAR_SIZE, {
				fit: 'cover',
				position: 'center',
			})
			.webp({ quality: 85 })
			.toBuffer()

		// Generate unique filename with user ID prefix
		const timestamp = Date.now()
		const filename = `avatars/${userId}/${timestamp}.webp`

		// Upload to Vercel Blob
		const blob = await put(filename, optimizedImage, {
			access: 'public',
			contentType: 'image/webp',
			addRandomSuffix: false,
		})

		// Update user.image in database
		await db.update(users).set({ image: blob.url }).where(eq(users.id, userId))

		// Delete old avatar if it was stored in Vercel Blob
		if (currentUserRecord?.image?.includes('blob.vercel-storage.com')) {
			try {
				await del(currentUserRecord.image)
			} catch {
				// Ignore deletion errors - old file may already be deleted
				console.warn('[Avatar Upload] Failed to delete old avatar:', currentUserRecord.image)
			}
		}

		return NextResponse.json({
			success: true,
			imageUrl: blob.url,
		})
	} catch (error) {
		console.error('[Avatar Upload] Error:', error)
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Upload failed. Please try again.',
			},
			{ status: 500 },
		)
	}
}

/**
 * DELETE /api/upload/avatar
 *
 * Remove user avatar and reset to default.
 * Requires authentication.
 */
export async function DELETE() {
	try {
		const { userId } = await auth()
		if (!userId) {
			return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
		}

		// Get current user avatar
		const [currentUserRecord] = await db
			.select({ image: users.image })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1)

		// Delete from Vercel Blob if it's a blob URL
		if (currentUserRecord?.image?.includes('blob.vercel-storage.com')) {
			try {
				await del(currentUserRecord.image)
			} catch {
				console.warn('[Avatar Upload] Failed to delete avatar:', currentUserRecord.image)
			}
		}

		// Clear user.image in database
		await db.update(users).set({ image: null }).where(eq(users.id, userId))

		return NextResponse.json({
			success: true,
			imageUrl: null,
		})
	} catch (error) {
		console.error('[Avatar Delete] Error:', error)
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Delete failed. Please try again.',
			},
			{ status: 500 },
		)
	}
}
