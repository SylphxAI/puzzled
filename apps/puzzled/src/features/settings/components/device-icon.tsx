/**
 * Device Icon Component
 *
 * Shared component for displaying device type icons across settings.
 */

import { Laptop, Monitor, Smartphone, Tablet } from 'lucide-react'

export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown'

type DeviceIconProps = {
	type: DeviceType
	className?: string
}

export function DeviceIcon({ type, className = 'h-5 w-5' }: DeviceIconProps) {
	switch (type) {
		case 'mobile':
			return <Smartphone className={className} />
		case 'tablet':
			return <Tablet className={className} />
		case 'desktop':
			return <Monitor className={className} />
		default:
			return <Laptop className={className} />
	}
}
