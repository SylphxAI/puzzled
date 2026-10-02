/** Editor form <-> Connect request mapping (kept pure so it is testable). */

import type { AnnouncementType } from '@/lib/db/schema'

export type AnnouncementFormData = {
	title: string
	content: string
	type: AnnouncementType
	isActive: boolean
	dismissible: boolean
	/** `datetime-local` value: the admin's LOCAL wall clock, no zone. */
	startsAt: string
	endsAt: string
}

/** A stored instant as the `datetime-local` value in the viewer's own zone. */
export function toLocalInput(date: Date | null | undefined): string {
	if (!date) return ''
	return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

/** The Connect contract's names (`body`, `active`); the window goes out as UTC instants. */
export function toAnnouncementRequest(form: AnnouncementFormData) {
	return {
		title: form.title,
		body: form.content,
		type: form.type,
		active: form.isActive,
		dismissible: form.dismissible,
		startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
		endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
	}
}
