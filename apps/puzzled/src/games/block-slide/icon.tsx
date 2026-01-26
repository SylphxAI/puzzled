/**
 * Block Slide Icon
 *
 * Sliding block puzzle (Rush Hour)
 * Represents moving blocks to free the target
 */

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
	size?: number
}

export function BlockSlideIcon({ size = 24, className, ...props }: IconProps) {
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
			{/* Frame */}
			<rect x="2" y="2" width="20" height="20" rx="1" />
			{/* Exit */}
			<path d="M22 10v4" strokeWidth="3" />
			{/* Horizontal blocks */}
			<rect x="4" y="10" width="8" height="4" rx="0.5" fill="currentColor" /> {/* Target block */}
			<rect x="4" y="4" width="6" height="3" rx="0.5" fill="currentColor" opacity="0.4" />
			<rect x="14" y="17" width="6" height="3" rx="0.5" fill="currentColor" opacity="0.4" />
			{/* Vertical blocks */}
			<rect x="14" y="4" width="3" height="6" rx="0.5" fill="currentColor" opacity="0.4" />
			<rect x="17" y="8" width="3" height="6" rx="0.5" fill="currentColor" opacity="0.4" />
			{/* Arrow indicating movement */}
			<path d="M13 12h3" strokeWidth="1" opacity="0.6" />
			<path d="M14.5 10.5l1.5 1.5-1.5 1.5" fill="none" strokeWidth="1" opacity="0.6" />
		</svg>
	)
}

