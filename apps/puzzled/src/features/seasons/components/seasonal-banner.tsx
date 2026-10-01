import { getTranslations } from 'next-intl/server'
import { getGameColors } from '@/games/theme-colors'
import { cn } from '@/lib/utils'
import { seasonForInstant } from '../lib/seasons'

/**
 * A small themed strip on home on a seasonal day; nothing on every other day.
 * Static by design: no countdown, no urgency, no motion to reduce.
 */
export async function SeasonalBanner({ now }: { now?: Date }) {
	const season = seasonForInstant(now)
	if (!season) return null
	const t = await getTranslations('home')
	const colors = getGameColors(season.accent)

	return (
		<aside
			data-season={season.id}
			className={cn('border-b border-foreground/10', colors.bg, colors.onField)}
		>
			<p className="page-shell-wide flex items-center justify-center gap-2 py-2 text-center text-sm font-medium">
				<span aria-hidden="true">{season.glyph}</span>
				<span>{t(`seasons.${season.id}`)}</span>
			</p>
		</aside>
	)
}
