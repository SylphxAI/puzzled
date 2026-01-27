/**
 * Quad Words Icon
 *
 * 4 mini word grids (Quordle-style)
 * Represents solving 4 puzzles at once
 */

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
	size?: number
}

export function QuadWordsIcon({ size = 24, className, ...props }: IconProps) {
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
			{/* Top left grid */}
			<rect x="2" y="2" width="9" height="9" rx="1" />
			<path d="M5.5 2v9M2 5.5h9" strokeWidth="0.75" />
			{/* Top right grid */}
			<rect x="13" y="2" width="9" height="9" rx="1" />
			<path d="M16.5 2v9M13 5.5h9" strokeWidth="0.75" />
			{/* Bottom left grid */}
			<rect x="2" y="13" width="9" height="9" rx="1" />
			<path d="M5.5 13v9M2 16.5h9" strokeWidth="0.75" />
			{/* Bottom right grid - completed */}
			<rect x="13" y="13" width="9" height="9" rx="1" fill="currentColor" opacity="0.2" />
			<path d="M16.5 13v9M13 16.5h9" strokeWidth="0.75" />
			{/* Checkmark on completed */}
			<path d="M15 17.5l2 2 4-4" strokeWidth="2" />
		</svg>
	)
}
