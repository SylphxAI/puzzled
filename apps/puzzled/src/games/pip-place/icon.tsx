/**
 * Spots Icon
 *
 * Domino on a small grid — not a third-party product mark.
 */

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
	size?: number
}

export function PipPlaceIcon({ size = 24, className, ...props }: IconProps) {
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
			<rect x="5.5" y="9.5" width="13" height="5" rx="0.8" />
			<circle cx="8" cy="12" r="0.9" fill="currentColor" stroke="none" />
			<circle cx="16" cy="10.8" r="0.7" fill="currentColor" stroke="none" />
			<circle cx="16" cy="13.2" r="0.7" fill="currentColor" stroke="none" />
		</svg>
	)
}
