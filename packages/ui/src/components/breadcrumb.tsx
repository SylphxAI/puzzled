/**
 * @sylphx/ui - Breadcrumb Component
 *
 * Navigation breadcrumb for showing page hierarchy.
 *
 * @example
 * ```tsx
 * import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage } from '@sylphx/ui'
 *
 * <Breadcrumb>
 *   <BreadcrumbItem>
 *     <BreadcrumbLink href="/console/apps">Apps</BreadcrumbLink>
 *   </BreadcrumbItem>
 *   <BreadcrumbItem>
 *     <BreadcrumbLink href="/console/apps/my-app">My App</BreadcrumbLink>
 *   </BreadcrumbItem>
 *   <BreadcrumbItem>
 *     <BreadcrumbPage>Services</BreadcrumbPage>
 *   </BreadcrumbItem>
 * </Breadcrumb>
 * ```
 *
 * @module @sylphx/ui/breadcrumb
 */

import { Slot } from '@radix-ui/react-slot'
import { ChevronRight } from 'lucide-react'
import { forwardRef } from 'react'
import { cn } from '../utils'

/**
 * Breadcrumb root container.
 * Provides semantic navigation structure with aria-label.
 */
const Breadcrumb = forwardRef<
	HTMLElement,
	React.ComponentPropsWithoutRef<'nav'> & { separator?: React.ReactNode }
>(({ className, ...props }, ref) => (
	<nav
		ref={ref}
		aria-label="Breadcrumb"
		className={cn('', className)}
		{...props}
	/>
))
Breadcrumb.displayName = 'Breadcrumb'

/**
 * Breadcrumb list container.
 * Renders as an ordered list for proper semantics.
 */
const BreadcrumbList = forwardRef<HTMLOListElement, React.ComponentPropsWithoutRef<'ol'>>(
	({ className, ...props }, ref) => (
		<ol
			ref={ref}
			className={cn(
				'flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5',
				className,
			)}
			{...props}
		/>
	),
)
BreadcrumbList.displayName = 'BreadcrumbList'

/**
 * Breadcrumb item wrapper.
 * Each item in the breadcrumb trail.
 */
const BreadcrumbItem = forwardRef<HTMLLIElement, React.ComponentPropsWithoutRef<'li'>>(
	({ className, ...props }, ref) => (
		<li
			ref={ref}
			className={cn('inline-flex items-center gap-1.5', className)}
			{...props}
		/>
	),
)
BreadcrumbItem.displayName = 'BreadcrumbItem'

/**
 * Breadcrumb link for navigation items.
 * Use for intermediate items that link to parent pages.
 * Supports asChild for composition with Next.js Link or other components.
 */
const BreadcrumbLink = forwardRef<
	HTMLAnchorElement,
	React.ComponentPropsWithoutRef<'a'> & { asChild?: boolean }
>(({ className, asChild, ...props }, ref) => {
	const Comp = asChild ? Slot : 'a'
	return (
		<Comp
			ref={ref}
			className={cn('transition-colors hover:text-foreground', className)}
			{...props}
		/>
	)
})
BreadcrumbLink.displayName = 'BreadcrumbLink'

/**
 * Breadcrumb page for the current page.
 * Use for the final item representing the current page.
 */
const BreadcrumbPage = forwardRef<HTMLSpanElement, React.ComponentPropsWithoutRef<'span'>>(
	({ className, ...props }, ref) => (
		<span
			ref={ref}
			role="link"
			aria-disabled="true"
			aria-current="page"
			className={cn('font-medium text-foreground', className)}
			{...props}
		/>
	),
)
BreadcrumbPage.displayName = 'BreadcrumbPage'

/**
 * Breadcrumb separator between items.
 * Renders a chevron by default but can be customized.
 */
const BreadcrumbSeparator = ({ children, className, ...props }: React.ComponentProps<'li'>) => (
	<li
		role="presentation"
		aria-hidden="true"
		className={cn('[&>svg]:h-3.5 [&>svg]:w-3.5', className)}
		{...props}
	>
		{children ?? <ChevronRight />}
	</li>
)
BreadcrumbSeparator.displayName = 'BreadcrumbSeparator'

/**
 * Breadcrumb ellipsis for collapsed items.
 * Use when truncating long breadcrumb trails.
 */
const BreadcrumbEllipsis = ({ className, ...props }: React.ComponentProps<'span'>) => (
	<span
		role="presentation"
		aria-hidden="true"
		className={cn('flex h-9 w-9 items-center justify-center', className)}
		{...props}
	>
		<span className="h-4 w-4">...</span>
		<span className="sr-only">More</span>
	</span>
)
BreadcrumbEllipsis.displayName = 'BreadcrumbEllipsis'

export {
	Breadcrumb,
	BreadcrumbEllipsis,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
}
