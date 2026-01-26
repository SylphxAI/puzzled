/**
 * Nonogram Icon
 *
 * Grid with number hints on edges (Picross)
 * Represents revealing hidden pictures
 */

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
	size?: number
}

export function NonogramIcon({ size = 24, className, ...props }: IconProps) {
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
			{/* Main grid */}
			<rect x="7" y="7" width="15" height="15" rx="0.5" />
			{/* Grid lines */}
			<path d="M12 7v15M17 7v15" strokeWidth="0.75" />
			<path d="M7 12h15M7 17h15" strokeWidth="0.75" />
			{/* Row hints area */}
			<rect x="2" y="7" width="4" height="15" rx="0.5" opacity="0.3" />
			{/* Column hints area */}
			<rect x="7" y="2" width="15" height="4" rx="0.5" opacity="0.3" />
			{/* Sample hints */}
			<text x="4" y="11" textAnchor="middle" fontSize="3" fill="currentColor" stroke="none">2</text>
			<text x="4" y="16" textAnchor="middle" fontSize="3" fill="currentColor" stroke="none">1</text>
			<text x="9.5" y="5" textAnchor="middle" fontSize="3" fill="currentColor" stroke="none">3</text>
			{/* Filled cells */}
			<rect x="7" y="7" width="5" height="5" fill="currentColor" />
			<rect x="12" y="12" width="5" height="5" fill="currentColor" />
		</svg>
	)
}

export default NonogramIcon
