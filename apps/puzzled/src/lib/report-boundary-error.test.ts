import { describe, expect, test } from 'bun:test'
import { reportBoundaryError } from './report-boundary-error'

describe('reportBoundaryError', () => {
	test('does not throw without a Sylphx provider', () => {
		const err = console.error
		console.error = () => {}
		try {
			expect(() => reportBoundaryError('locale', new Error('crossword first throw'))).not.toThrow()
		} finally {
			console.error = err
		}
	})
})
