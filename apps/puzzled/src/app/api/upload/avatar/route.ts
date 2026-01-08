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
import { getServerSession } from '@/features/auth/server'
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
		const session = await getServerSession()
		if (!session?.user) {
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
		const [currentUser] = await db
			.select({ image: users.image })
			.from(users)
			.where(eq(users.id, session.user.id))
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
		const filename = `avatars/${session.user.id}/${timestamp}.webp`

		// Upload to Vercel Blob
		const blob = await put(filename, optimizedImage, {
			access: 'public',
			contentType: 'image/webp',
			addRandomSuffix: false,
		})

		// Update user.image in database
		await db.update(users).set({ image: blob.url }).where(eq(users.id, session.user.id))

		// Delete old avatar if it was stored in Vercel Blob
		if (currentUser?.image?.includes('blob.vercel-storage.com')) {
			try {
				await del(currentUser.image)
			} catch {
				// Ignore deletion errors - old file may already be deleted
				console.warn('[Avatar Upload] Failed to delete old avatar:', currentUser.image)
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
		const session = await getServerSession()
		if (!session?.user) {
			return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
		}

		// Get current user avatar
		const [currentUser] = await db
			.select({ image: users.image })
			.from(users)
			.where(eq(users.id, session.user.id))
			.limit(1)

		// Delete from Vercel Blob if it's a blob URL
		if (currentUser?.image?.includes('blob.vercel-storage.com')) {
			try {
				await del(currentUser.image)
			} catch {
				console.warn('[Avatar Upload] Failed to delete avatar:', currentUser.image)
			}
		}

		// Clear user.image in database
		await db.update(users).set({ image: null }).where(eq(users.id, session.user.id))

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
