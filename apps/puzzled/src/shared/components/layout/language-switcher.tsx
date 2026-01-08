'use client'

import { Check, Globe } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { forwardRef } from 'react'
import { type Locale, localeCountryCodes, localeNames } from '@/lib/i18n/config'
import { usePathname, useRouter } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import {
	Icon,
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/shared/components/ui'

const locales = Object.keys(localeNames) as Locale[]

export function LanguageSwitcher() {
	const t = useTranslations('common')
	const locale = useLocale() as Locale
	const router = useRouter()
	const pathname = usePathname()

	const handleLocaleChange = (newLocale: string) => {
		router.replace(pathname, { locale: newLocale as Locale })
	}

	return (
		<Select value={locale} onValueChange={handleLocaleChange}>
			<SelectTrigger
				className="h-11 w-11 rounded-full border-0 bg-transparent p-0 text-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 [&>svg:last-child]:hidden"
				aria-label={t('changeLanguage')}
			>
				<SelectValue asChild>
					<Globe className="h-5 w-5" />
				</SelectValue>
			</SelectTrigger>
			<SelectContent
				align="end"
				className="w-52 rounded-xl border-border/50 p-1 shadow-lg shadow-black/5"
			>
				<SelectGroup>
					{locales.map((loc) => (
						<LanguageSelectItem key={loc} locale={loc} isSelected={locale === loc} />
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	)
}

interface LanguageSelectItemProps {
	locale: Locale
	isSelected: boolean
}

const LanguageSelectItem = forwardRef<HTMLDivElement, LanguageSelectItemProps>(
	({ locale, isSelected }, ref) => {
		return (
			<SelectItem
				ref={ref}
				value={locale}
				className={cn(
					'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors',
					'focus:bg-muted data-[highlighted]:bg-muted',
					isSelected && 'font-medium text-primary',
				)}
			>
				<Icon
					icon={`circle-flags:${localeCountryCodes[locale]}`}
					aria-hidden="true"
					className="h-5 w-5 shrink-0"
				/>
				<span className="flex-1 truncate">{localeNames[locale]}</span>
				{isSelected && <Check className="h-4 w-4 text-primary" />}
			</SelectItem>
		)
	},
)
LanguageSelectItem.displayName = 'LanguageSelectItem'
