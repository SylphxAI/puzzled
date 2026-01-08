/**
 * Word Groups Icon
 *
 * 4 grouped squares in arrangement showing categorization
 * Represents finding connections between words
 */

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
	size?: number
}

export function WordGroupsIcon({ size = 24, className, ...props }: IconProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			width={size}
			height={size}
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			{...props}
		>
			{/* Top left group */}
			<rect x="2" y="2" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.3" />
			<rect x="6.5" y="2" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.3" />
			{/* Top right group */}
			<rect x="13.5" y="2" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.5" />
			<rect x="18" y="2" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.5" />
			{/* Bottom left group */}
			<rect x="2" y="9" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.7" />
			<rect x="6.5" y="9" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.7" />
			{/* Bottom right group */}
			<rect x="13.5" y="9" width="4" height="4" rx="0.5" fill="currentColor" />
			<rect x="18" y="9" width="4" height="4" rx="0.5" fill="currentColor" />
			{/* Bottom row - ungrouped */}
			<rect x="2" y="16" width="4" height="4" rx="0.5" />
			<rect x="6.5" y="16" width="4" height="4" rx="0.5" />
			<rect x="13.5" y="16" width="4" height="4" rx="0.5" />
			<rect x="18" y="16" width="4" height="4" rx="0.5" />
		</svg>
	)
}

export default WordGroupsIcon
