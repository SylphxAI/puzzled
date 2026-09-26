'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

type ThemeProviderProps = {
	children: React.ReactNode
	attribute?: 'class' | 'data-theme'
	defaultTheme?: string
	enableSystem?: boolean
	disableTransitionOnChange?: boolean
	/** The request's CSP nonce, for next-themes' inline script and style. */
	nonce?: string
}

export function ThemeProvider({
	children,
	attribute = 'class',
	defaultTheme = 'system',
	enableSystem = true,
	disableTransitionOnChange = true,
	...props
}: ThemeProviderProps) {
	return (
		<NextThemesProvider
			attribute={attribute}
			defaultTheme={defaultTheme}
			enableSystem={enableSystem}
			disableTransitionOnChange={disableTransitionOnChange}
			{...props}
		>
			{children}
		</NextThemesProvider>
	)
}
