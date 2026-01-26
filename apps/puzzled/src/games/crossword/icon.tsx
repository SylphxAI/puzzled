/**
 * Crossword Icon
 *
 * Mini crossword grid pattern with black squares
 * Represents the classic crossword puzzle format
 */

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
	size?: number
}

export function CrosswordIcon({ size = 24, className, ...props }: IconProps) {
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
			{/* Grid */}
			<rect x="3" y="3" width="18" height="18" rx="1" />
			{/* Vertical dividers */}
			<path d="M7.5 3v18M12 3v18M16.5 3v18" />
			{/* Horizontal dividers */}
			<path d="M3 7.5h18M3 12h18M3 16.5h18" />
			{/* Black squares */}
			<rect x="3" y="3" width="4.5" height="4.5" fill="currentColor" />
			<rect x="16.5" y="12" width="4.5" height="4.5" fill="currentColor" />
			<rect x="7.5" y="16.5" width="4.5" height="4.5" fill="currentColor" />
		</svg>
	)
}
