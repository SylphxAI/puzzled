/**
 * Pattern Match Icon
 *
 * Three cards with shapes (Set game)
 * Represents finding matching patterns
 */

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
	size?: number
}

export function PatternMatchIcon({ size = 24, className, ...props }: IconProps) {
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
			{/* Card 1 */}
			<rect x="1" y="4" width="6" height="16" rx="1" />
			<circle cx="4" cy="9" r="1.5" fill="currentColor" />
			<circle cx="4" cy="15" r="1.5" fill="currentColor" />
			{/* Card 2 */}
			<rect x="9" y="4" width="6" height="16" rx="1" />
			<rect x="10.5" y="7.5" width="3" height="3" fill="currentColor" />
			<rect x="10.5" y="13.5" width="3" height="3" fill="currentColor" />
			{/* Card 3 */}
			<rect x="17" y="4" width="6" height="16" rx="1" />
			<path d="M20 7l2 3h-4z" fill="currentColor" />
			<path d="M20 13l2 3h-4z" fill="currentColor" />
		</svg>
	)
}
