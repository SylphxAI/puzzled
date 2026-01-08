/**
 * User Agent Parser Utility
 *
 * Parses user agent strings to extract device, browser, and OS information.
 */

export interface ParsedUserAgent {
	device: DeviceType
	browser: BrowserInfo
	os: OSInfo
}

export interface DeviceType {
	type: 'desktop' | 'mobile' | 'tablet' | 'unknown'
	name: string
}

export interface BrowserInfo {
	name: string
	version: string
}

export interface OSInfo {
	name: string
	version: string
}

/**
 * Parse a user agent string to extract device, browser, and OS information
 */
export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
	if (!ua) {
		return {
			device: { type: 'unknown', name: 'Unknown Device' },
			browser: { name: 'Unknown', version: '' },
			os: { name: 'Unknown', version: '' },
		}
	}

	return {
		device: parseDevice(ua),
		browser: parseBrowser(ua),
		os: parseOS(ua),
	}
}

/**
 * Detect device type from user agent
 */
function parseDevice(ua: string): DeviceType {
	// Check for tablets first (they often contain Mobile in UA)
	if (/iPad|tablet|playbook|silk/i.test(ua)) {
		return { type: 'tablet', name: 'Tablet' }
	}

	// Check for mobile devices
	if (/Mobile|Android|iPhone|iPod|Windows Phone|BlackBerry|Opera Mini|IEMobile/i.test(ua)) {
		// Specific device detection
		if (/iPhone/i.test(ua)) {
			return { type: 'mobile', name: 'iPhone' }
		}
		if (/Android/i.test(ua)) {
			return { type: 'mobile', name: 'Android' }
		}
		return { type: 'mobile', name: 'Mobile' }
	}

	// Default to desktop
	return { type: 'desktop', name: 'Desktop' }
}

/**
 * Detect browser name and version from user agent
 */
function parseBrowser(ua: string): BrowserInfo {
	// Order matters - check more specific browsers first
	const browsers: Array<{ pattern: RegExp; name: string; versionPattern?: RegExp }> = [
		// Check Edge before Chrome (Edge contains Chrome in UA)
		{ pattern: /Edg(?:e|A|iOS)?\/(\d+(?:\.\d+)?)/i, name: 'Edge' },
		// Check Opera before Chrome (Opera contains Chrome in UA)
		{ pattern: /OPR\/(\d+(?:\.\d+)?)/i, name: 'Opera' },
		{ pattern: /Opera\/(\d+(?:\.\d+)?)/i, name: 'Opera' },
		// Check Chrome (but not Chromium-based browsers we already matched)
		{
			pattern: /Chrome\/(\d+(?:\.\d+)?)/i,
			name: 'Chrome',
		},
		// Safari (but not Chrome-based)
		{
			pattern: /Safari\/(\d+(?:\.\d+)?)/i,
			name: 'Safari',
			versionPattern: /Version\/(\d+(?:\.\d+)?)/i,
		},
		// Firefox
		{ pattern: /Firefox\/(\d+(?:\.\d+)?)/i, name: 'Firefox' },
		// Samsung Browser
		{ pattern: /SamsungBrowser\/(\d+(?:\.\d+)?)/i, name: 'Samsung Browser' },
		// UC Browser
		{ pattern: /UCBrowser\/(\d+(?:\.\d+)?)/i, name: 'UC Browser' },
		// Brave (contains Chrome, but we can't reliably detect it from UA alone)
	]

	for (const browser of browsers) {
		const match = ua.match(browser.pattern)
		if (match) {
			// For Safari, use Version/ for version number
			if (browser.versionPattern) {
				const versionMatch = ua.match(browser.versionPattern)
				return {
					name: browser.name,
					version: versionMatch?.[1] || match[1] || '',
				}
			}
			return {
				name: browser.name,
				version: match[1] || '',
			}
		}
	}

	return { name: 'Unknown', version: '' }
}

/**
 * Detect operating system from user agent
 */
function parseOS(ua: string): OSInfo {
	const osPatterns: Array<{ pattern: RegExp; name: string; versionPattern?: RegExp }> = [
		// iOS (check before Mac)
		{
			pattern: /iPhone|iPad|iPod/i,
			name: 'iOS',
			versionPattern: /OS (\d+[._]\d+(?:[._]\d+)?)/i,
		},
		// macOS
		{
			pattern: /Mac OS X|macOS/i,
			name: 'macOS',
			versionPattern: /Mac OS X (\d+[._]\d+(?:[._]\d+)?)/i,
		},
		// Windows
		{
			pattern: /Windows/i,
			name: 'Windows',
			versionPattern: /Windows NT (\d+\.\d+)/i,
		},
		// Android
		{
			pattern: /Android/i,
			name: 'Android',
			versionPattern: /Android (\d+(?:\.\d+)?)/i,
		},
		// Linux
		{
			pattern: /Linux/i,
			name: 'Linux',
		},
		// Chrome OS
		{
			pattern: /CrOS/i,
			name: 'Chrome OS',
		},
	]

	for (const os of osPatterns) {
		if (os.pattern.test(ua)) {
			let version = ''
			if (os.versionPattern) {
				const match = ua.match(os.versionPattern)
				if (match) {
					// Normalize version separators
					version = match[1].replace(/_/g, '.')
				}
			}

			// Map Windows NT versions to friendly names
			if (os.name === 'Windows' && version) {
				version = mapWindowsVersion(version)
			}

			return { name: os.name, version }
		}
	}

	return { name: 'Unknown', version: '' }
}

/**
 * Map Windows NT version numbers to friendly names
 */
function mapWindowsVersion(ntVersion: string): string {
	const versionMap: Record<string, string> = {
		'10.0': '10/11', // Can't distinguish 10 from 11 reliably
		'6.3': '8.1',
		'6.2': '8',
		'6.1': '7',
		'6.0': 'Vista',
		'5.1': 'XP',
		'5.0': '2000',
	}
	return versionMap[ntVersion] || ntVersion
}

/**
 * Get a human-readable device description
 */
export function getDeviceDescription(parsed: ParsedUserAgent): string {
	const { browser, os, device } = parsed

	const parts: string[] = []

	if (browser.name !== 'Unknown') {
		parts.push(browser.version ? `${browser.name} ${browser.version}` : browser.name)
	}

	if (os.name !== 'Unknown') {
		parts.push(os.version ? `${os.name} ${os.version}` : os.name)
	}

	if (parts.length === 0) {
		return device.name || 'Unknown Device'
	}

	return parts.join(' on ')
}

/**
 * Mask an IP address for privacy
 * IPv4: Shows first two octets (e.g., "192.168.*.*")
 * IPv6: Shows first two groups (e.g., "2001:db8:*:*")
 */
export function maskIpAddress(ip: string | null | undefined): string {
	if (!ip) return 'Unknown'

	// Handle IPv4
	if (ip.includes('.')) {
		const parts = ip.split('.')
		if (parts.length === 4) {
			return `${parts[0]}.${parts[1]}.*.*`
		}
	}

	// Handle IPv6
	if (ip.includes(':')) {
		const parts = ip.split(':')
		if (parts.length >= 4) {
			return `${parts[0]}:${parts[1]}:****:****`
		}
	}

	// Return as-is for localhost or other formats
	if (ip === '::1' || ip === '127.0.0.1') {
		return 'localhost'
	}

	return ip
}

/**
 * Extract client IP address from request headers
 *
 * Handles common proxy headers (x-forwarded-for, x-real-ip).
 * Returns null if no IP found rather than a fallback value.
 */
export function getClientIpAddress(headers: Headers): string | null {
	// x-forwarded-for may contain multiple IPs, take the first (client IP)
	const forwarded = headers.get('x-forwarded-for')
	if (forwarded) {
		const firstIp = forwarded.split(',')[0]?.trim()
		if (firstIp) return firstIp
	}

	// Fallback to x-real-ip
	const realIp = headers.get('x-real-ip')
	if (realIp) return realIp

	return null
}
