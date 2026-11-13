/**
 * Game Icons
 *
 * Provides base icon components for game-related branding.
 */

import { Gamepad2 } from 'lucide-react'

type GameIconProps = {
	className?: string
	size?: number
	'aria-hidden'?: boolean | 'true' | 'false'
}

/**
 * Branding icon used in auth and notification pages.
 */
export function GamepadIcon({ className, size = 24, ...props }: GameIconProps) {
	return <Gamepad2 className={className} size={size} {...props} />
}
