/**
 * Word Search Icon
 *
 * Grid with diagonal highlight showing found word
 * Represents finding hidden words
 */

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
	size?: number
}

export function WordSearchIcon({ size = 24, className, ...props }: IconProps) {
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
			aria-hidden="true"
			{...props}
		>
			{/* Grid */}
			<rect x="3" y="3" width="18" height="18" rx="1" />
			{/* Grid lines */}
			<path d="M7.2 3v18M11.4 3v18M15.6 3v18" strokeWidth="0.75" opacity="0.3" />
			<path d="M3 7.2h18M3 11.4h18M3 15.6h18" strokeWidth="0.75" opacity="0.3" />
			{/* Diagonal highlight - found word */}
			<rect
				x="4"
				y="4"
				width="12"
				height="3"
				rx="1.5"
				fill="currentColor"
				opacity="0.4"
				transform="rotate(45 4 4)"
			/>
			{/* Letters hint */}
			<circle cx="5.1" cy="5.1" r="1" fill="currentColor" />
			<circle cx="9.3" cy="9.3" r="1" fill="currentColor" />
			<circle cx="13.5" cy="13.5" r="1" fill="currentColor" />
		</svg>
	)
}
