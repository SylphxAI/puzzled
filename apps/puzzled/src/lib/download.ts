/**
 * Download Utilities
 *
 * Shared utilities for triggering browser downloads.
 */

/**
 * Download data as a JSON file
 *
 * @param data - The data to download (will be JSON-stringified)
 * @param filename - The filename (without .json extension)
 */
export function downloadJson(data: unknown, filename: string): void {
	const blob = new Blob([JSON.stringify(data, null, 2)], {
		type: 'application/json',
	})
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = `${filename}.json`
	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)
	URL.revokeObjectURL(url)
}

/**
 * Generate a timestamped filename for data exports
 *
 * @param prefix - The filename prefix (e.g., 'puzzled-data-export')
 * @returns Filename with ISO date suffix
 */
export function getExportFilename(prefix: string): string {
	return `${prefix}-${new Date().toISOString().split('T')[0]}`
}
