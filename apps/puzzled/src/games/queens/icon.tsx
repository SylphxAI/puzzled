/**
 * Queens Icon
 *
 * Chess board with queen placement
 * Represents N-Queens puzzle
 */

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
	size?: number
}

export function QueensIcon({ size = 24, className, ...props }: IconProps) {
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
			{/* Board */}
			<rect x="2" y="2" width="20" height="20" rx="1" />
			{/* Grid */}
			<path d="M7 2v20M12 2v20M17 2v20" strokeWidth="0.75" />
			<path d="M2 7h20M2 12h20M2 17h20" strokeWidth="0.75" />
			{/* Checkerboard pattern hint */}
			<rect x="7" y="2" width="5" height="5" fill="currentColor" opacity="0.1" />
			<rect x="17" y="2" width="5" height="5" fill="currentColor" opacity="0.1" />
			<rect x="2" y="7" width="5" height="5" fill="currentColor" opacity="0.1" />
			<rect x="12" y="7" width="5" height="5" fill="currentColor" opacity="0.1" />
			<rect x="7" y="12" width="5" height="5" fill="currentColor" opacity="0.1" />
			<rect x="17" y="12" width="5" height="5" fill="currentColor" opacity="0.1" />
			<rect x="2" y="17" width="5" height="5" fill="currentColor" opacity="0.1" />
			<rect x="12" y="17" width="5" height="5" fill="currentColor" opacity="0.1" />
			{/* Queen - crown shape */}
			<path d="M9.5 9.5l-1.5-2 2 1 2-2 2 2 2-1-1.5 2v2h-5v-2z" fill="currentColor" stroke="none" />
		</svg>
	)
}
