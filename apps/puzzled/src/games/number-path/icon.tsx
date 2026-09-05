/**
 * Path Icon
 *
 * Numbered grid with a single visiting path
 */

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
	size?: number
}

export function NumberPathIcon({ size = 24, className, ...props }: IconProps) {
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
			<rect x="3" y="3" width="18" height="18" rx="1" />
			<path d="M9 3v18M15 3v18" strokeWidth="0.75" opacity="0.35" />
			<path d="M3 9h18M3 15h18" strokeWidth="0.75" opacity="0.35" />
			<path d="M6 6h6v6h6v6" strokeWidth="1.75" />
			<circle cx="6" cy="6" r="1.2" fill="currentColor" />
			<circle cx="18" cy="18" r="1.2" fill="currentColor" />
		</svg>
	)
}
