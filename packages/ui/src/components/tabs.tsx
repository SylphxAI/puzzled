'use client'

import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import { forwardRef } from 'react'
import { cn } from '../utils'

// ==================
// Tabs Root
// ==================

interface TabsProps {
	/** Controlled value */
	value?: string | number
	/** Default value (uncontrolled) */
	defaultValue?: string | number
	/** Handler fired when tab changes */
	onValueChange?: (value: string | number) => void
	/** Orientation */
	orientation?: 'horizontal' | 'vertical'
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
}

const Tabs = forwardRef<HTMLDivElement, TabsProps>(
	({ className, value, defaultValue, onValueChange, orientation = 'horizontal', children }, ref) => (
		<BaseTabs.Root
			ref={ref}
			value={value}
			defaultValue={defaultValue}
			onValueChange={onValueChange}
			orientation={orientation}
			className={className}
		>
			{children}
		</BaseTabs.Root>
	),
)
Tabs.displayName = 'Tabs'

// ==================
// Tabs List
// ==================

interface TabsListProps {
	/** Children (TabsTrigger components) */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
}

const TabsList = forwardRef<HTMLDivElement, TabsListProps>(({ className, children }, ref) => (
	<BaseTabs.List
		ref={ref}
		className={cn(
			'inline-flex h-11 items-center justify-center rounded-xl bg-muted p-1 text-muted-foreground',
			className,
		)}
	>
		{children}
	</BaseTabs.List>
))
TabsList.displayName = 'TabsList'

// ==================
// Tabs Trigger (Tab)
// ==================

interface TabsTriggerProps {
	/** Value that associates this trigger with its panel */
	value: string | number
	/** Whether the tab is disabled */
	disabled?: boolean
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
	/** Whether to render as child element */
	asChild?: boolean
}

const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
	({ className, value, disabled, children, asChild }, ref) => (
		<BaseTabs.Tab
			ref={ref}
			value={value}
			disabled={disabled}
			render={asChild ? (children as React.ReactElement) : undefined}
			className={cn(
				// min-h-9 within h-11 TabsList = adequate touch target
				'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 min-h-9 text-sm font-medium ring-offset-background transition-all',
				'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
				'disabled:pointer-events-none disabled:opacity-50',
				// Base UI uses data-selected instead of data-[state=active]
				'data-[selected]:bg-background data-[selected]:text-foreground data-[selected]:shadow-sm',
				className,
			)}
		>
			{asChild ? undefined : children}
		</BaseTabs.Tab>
	),
)
TabsTrigger.displayName = 'TabsTrigger'

// ==================
// Tabs Content (Panel)
// ==================

interface TabsContentProps {
	/** Value that associates this content with its trigger */
	value: string | number
	/** Whether to keep the content mounted when not active */
	keepMounted?: boolean
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
}

const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
	({ className, value, keepMounted, children }, ref) => (
		<BaseTabs.Panel
			ref={ref}
			value={value}
			keepMounted={keepMounted}
			className={cn(
				'tab-content mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
				className,
			)}
		>
			{children}
		</BaseTabs.Panel>
	),
)
TabsContent.displayName = 'TabsContent'

export { Tabs, TabsList, TabsTrigger, TabsContent }
export type { TabsProps, TabsListProps, TabsTriggerProps, TabsContentProps }
