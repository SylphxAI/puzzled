/**
 * Word Hive Icon
 *
 * Honeycomb hexagon pattern with center highlighted
 * Represents the spelling bee mechanic with 7 letters
 */

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
	size?: number
}

export function WordHiveIcon({ size = 24, className, ...props }: IconProps) {
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
			{/* Center hexagon - filled */}
			<path
				d="M12 6l4 2.3v4.6l-4 2.3-4-2.3V8.3L12 6z"
				fill="currentColor"
			/>
			{/* Surrounding hexagons */}
			<path d="M12 1l3 1.7v3.4L12 7.8 9 6.1V2.7L12 1z" />
			<path d="M18.5 4.5l3 1.7v3.4l-3 1.7-3-1.7V6.2l3-1.7z" />
			<path d="M18.5 12.3l3 1.7v3.4l-3 1.7-3-1.7V14l3-1.7z" />
			<path d="M12 16l3 1.7v3.4L12 22.8l-3-1.7v-3.4L12 16z" />
			<path d="M5.5 12.3l3 1.7v3.4l-3 1.7-3-1.7V14l3-1.7z" />
			<path d="M5.5 4.5l3 1.7v3.4l-3 1.7-3-1.7V6.2l3-1.7z" />
		</svg>
	)
}

