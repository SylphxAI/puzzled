/**
 * Word Ladder Icon
 *
 * Vertical word transformation with arrows
 * Represents changing one letter at a time
 */

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
	size?: number
}

export function WordLadderIcon({ size = 24, className, ...props }: IconProps) {
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
			{/* Top word */}
			<rect x="5" y="2" width="14" height="4" rx="1" />
			{/* Arrow down */}
			<path d="M12 6.5v3" />
			<path d="M10 8l2 2 2-2" fill="none" />
			{/* Middle word - highlighted */}
			<rect x="5" y="10" width="14" height="4" rx="1" fill="currentColor" opacity="0.3" />
			{/* Arrow down */}
			<path d="M12 14.5v3" />
			<path d="M10 16l2 2 2-2" fill="none" />
			{/* Bottom word */}
			<rect x="5" y="18" width="14" height="4" rx="1" />
		</svg>
	)
}
