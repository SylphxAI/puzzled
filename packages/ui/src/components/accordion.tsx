'use client'

import { Accordion as BaseAccordion } from '@base-ui/react/accordion'
import { ChevronDown } from 'lucide-react'
import { forwardRef } from 'react'
import { cn } from '../utils'

// ==================
// Accordion Root
// ==================

interface AccordionProps {
	/** Allow multiple items to be open at once */
	type?: 'single' | 'multiple'
	/** Controlled value */
	value?: string[]
	/** Default value (uncontrolled) */
	defaultValue?: string[]
	/** Handler fired when value changes */
	onValueChange?: (value: string[]) => void
	/** Whether the accordion is disabled */
	disabled?: boolean
	/** Orientation */
	orientation?: 'horizontal' | 'vertical'
	/** Additional CSS classes */
	className?: string
	/** Children */
	children?: React.ReactNode
}

const Accordion = forwardRef<HTMLDivElement, AccordionProps>(
	({ className, type = 'single', value, defaultValue, onValueChange, disabled, orientation = 'vertical', children }, ref) => (
		<BaseAccordion.Root
			ref={ref}
			value={value}
			defaultValue={defaultValue}
			onValueChange={onValueChange}
			disabled={disabled}
			className={className}
		>
			{children}
		</BaseAccordion.Root>
	),
)
Accordion.displayName = 'Accordion'

// ==================
// Accordion Item
// ==================

interface AccordionItemProps {
	/** Value of the item */
	value: string
	/** Whether the item is disabled */
	disabled?: boolean
	/** Additional CSS classes */
	className?: string
	/** Children */
	children?: React.ReactNode
}

const AccordionItem = forwardRef<HTMLDivElement, AccordionItemProps>(
	({ className, value, disabled, children }, ref) => (
		<BaseAccordion.Item
			ref={ref}
			value={value}
			disabled={disabled}
			className={cn('border-b', className)}
		>
			{children}
		</BaseAccordion.Item>
	),
)
AccordionItem.displayName = 'AccordionItem'

// ==================
// Accordion Trigger
// ==================

interface AccordionTriggerProps {
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
}

const AccordionTrigger = forwardRef<HTMLButtonElement, AccordionTriggerProps>(
	({ className, children }, ref) => (
		<BaseAccordion.Header className="flex">
			<BaseAccordion.Trigger
				ref={ref}
				className={cn(
					// min-h-11 = 44px minimum touch target (WCAG 2.1 AA)
					'flex flex-1 items-center justify-between min-h-11 py-4 text-sm font-medium transition-all hover:underline text-left',
					'rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
					'[&[data-panel-open]>svg]:rotate-180',
					className,
				)}
			>
				{children}
				<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
			</BaseAccordion.Trigger>
		</BaseAccordion.Header>
	),
)
AccordionTrigger.displayName = 'AccordionTrigger'

// ==================
// Accordion Content
// ==================

interface AccordionContentProps {
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
}

const AccordionContent = forwardRef<HTMLDivElement, AccordionContentProps>(
	({ className, children }, ref) => (
		<BaseAccordion.Panel
			ref={ref}
			className="overflow-hidden text-sm data-[ending-style]:animate-accordion-up data-[starting-style]:animate-accordion-down"
		>
			<div className={cn('pb-4 pt-0', className)}>{children}</div>
		</BaseAccordion.Panel>
	),
)
AccordionContent.displayName = 'AccordionContent'

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }

export type {
	AccordionProps,
	AccordionItemProps,
	AccordionTriggerProps,
	AccordionContentProps,
}
