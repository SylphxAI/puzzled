/**
 * Tango Icon
 *
 * Balance of suns and moons (Binary/Takuzu)
 * Represents balancing two symbols
 */

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
	size?: number
}

export function TangoIcon({ size = 24, className, ...props }: IconProps) {
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
			<path d="M9 3v18M15 3v18" strokeWidth="0.75" />
			<path d="M3 9h18M3 15h18" strokeWidth="0.75" />
			{/* Sun (circle with rays) */}
			<circle cx="6" cy="6" r="2" fill="currentColor" />
			<circle cx="18" cy="12" r="2" fill="currentColor" />
			<circle cx="6" cy="18" r="2" fill="currentColor" />
			{/* Moon (crescent) */}
			<path d="M12 4a2.5 2.5 0 0 1 0 4 2 2 0 0 0 0-4z" fill="currentColor" />
			<path d="M6 10a2.5 2.5 0 0 1 0 4 2 2 0 0 0 0-4z" fill="currentColor" />
			<path d="M18 16a2.5 2.5 0 0 1 0 4 2 2 0 0 0 0-4z" fill="currentColor" />
		</svg>
	)
}

