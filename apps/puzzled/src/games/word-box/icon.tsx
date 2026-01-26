/**
 * Word Box Icon
 *
 * Square with letters around edges and connection line
 * Represents the Letter Boxed mechanic
 */

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
	size?: number
}

export function WordBoxIcon({ size = 24, className, ...props }: IconProps) {
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
			{/* Outer square */}
			<rect x="4" y="4" width="16" height="16" rx="1" />
			{/* Dots representing letters on each side */}
			{/* Top */}
			<circle cx="8" cy="4" r="1.5" fill="currentColor" />
			<circle cx="12" cy="4" r="1.5" fill="currentColor" />
			<circle cx="16" cy="4" r="1.5" fill="currentColor" />
			{/* Bottom */}
			<circle cx="8" cy="20" r="1.5" fill="currentColor" />
			<circle cx="12" cy="20" r="1.5" fill="currentColor" />
			<circle cx="16" cy="20" r="1.5" fill="currentColor" />
			{/* Left */}
			<circle cx="4" cy="8" r="1.5" fill="currentColor" />
			<circle cx="4" cy="12" r="1.5" fill="currentColor" />
			<circle cx="4" cy="16" r="1.5" fill="currentColor" />
			{/* Right */}
			<circle cx="20" cy="8" r="1.5" fill="currentColor" />
			<circle cx="20" cy="12" r="1.5" fill="currentColor" />
			<circle cx="20" cy="16" r="1.5" fill="currentColor" />
			{/* Connection line */}
			<path d="M8 4L16 20" strokeWidth="1" opacity="0.5" />
		</svg>
	)
}

