import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const pagePath = new URL('../app/[locale]/admin/announcements/page.tsx', import.meta.url)
const editorPath = new URL('../features/admin/components/announcement-editor.tsx', import.meta.url)
const listPath = new URL('../features/admin/components/announcements-list.tsx', import.meta.url)

describe('admin announcements authority boundary', () => {
	test('uses the Connect contract without a Next-side database writer', () => {
		const pageSource = readFileSync(pagePath, 'utf8')
		const editorSource = readFileSync(editorPath, 'utf8')
		const listSource = readFileSync(listPath, 'utf8')

		expect(pageSource).not.toContain("from '@/lib/db'")
		expect(pageSource).not.toContain('db.')
		expect(pageSource).toContain('<AnnouncementsList />')
		expect(editorSource).toContain('type AnnouncementFormData')
		expect(editorSource).toContain('body: string')
		expect(editorSource).toContain('createMutation.mutate(formData')
		expect(editorSource).not.toContain("from '@/lib/db'")
		expect(editorSource).not.toContain('startsAt')
		expect(editorSource).not.toContain('targetPremiumOnly')
		expect(listSource).toContain('useAnnouncements')
		expect(listSource).toContain('error && !data')
	})
})
