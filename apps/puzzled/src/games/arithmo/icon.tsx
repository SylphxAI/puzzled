/**
 * Arithmo Icon
 *
 * Math equation tiles (Nerdle-like)
 * Represents guessing equations
 */

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
	size?: number
}

export function ArithmoIcon({ size = 24, className, ...props }: IconProps) {
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
			{/* Equation tiles */}
			<rect x="1" y="9" width="4" height="6" rx="0.5" />
			<text x="3" y="14" textAnchor="middle" fontSize="5" fill="currentColor" stroke="none">7</text>

			<rect x="5.5" y="9" width="4" height="6" rx="0.5" fill="currentColor" opacity="0.3" />
			<text x="7.5" y="14" textAnchor="middle" fontSize="5" fill="currentColor" stroke="none">+</text>

			<rect x="10" y="9" width="4" height="6" rx="0.5" />
			<text x="12" y="14" textAnchor="middle" fontSize="5" fill="currentColor" stroke="none">5</text>

			<rect x="14.5" y="9" width="4" height="6" rx="0.5" fill="currentColor" opacity="0.3" />
			<text x="16.5" y="14" textAnchor="middle" fontSize="5" fill="currentColor" stroke="none">=</text>

			<rect x="19" y="9" width="4" height="6" rx="0.5" fill="currentColor" />
			<text x="21" y="14" textAnchor="middle" fontSize="5" fill="white" stroke="none">?</text>
		</svg>
	)
}

