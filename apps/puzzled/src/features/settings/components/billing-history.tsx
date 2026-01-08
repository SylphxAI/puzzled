'use client'

import { Download, FileText, Loader2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { cn, formatCurrency } from '@/lib/utils'
import { Badge, Button } from '@/shared/components/ui'
import { trpc } from '@/trpc/client'

const PAGE_SIZE = 10

type StatusFilter = 'all' | 'succeeded' | 'pending' | 'failed' | 'refunded' | 'disputed'

const statusFilters: StatusFilter[] = [
	'all',
	'succeeded',
	'pending',
	'failed',
	'refunded',
	'disputed',
]

function getStatusVariant(status: string): 'success' | 'warning' | 'error' | 'secondary' {
	switch (status) {
		case 'succeeded':
			return 'success'
		case 'pending':
			return 'warning'
		case 'failed':
		case 'disputed':
			return 'error'
		case 'refunded':
			return 'warning'
		default:
			return 'secondary'
	}
}

export function BillingHistory() {
	const t = useTranslations('settings.subscription')
	const tPagination = useTranslations('pagination')
	const locale = useLocale()
	const [offset, setOffset] = useState(0)
	const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

	const statusParam = statusFilter === 'all' ? undefined : [statusFilter]

	const { data, isLoading, isFetching } = trpc.billing.getBillingHistory.useQuery({
		limit: PAGE_SIZE,
		offset,
		status: statusParam,
	})

	const handleLoadMore = () => {
		if (data?.hasMore) {
			setOffset((prev) => prev + PAGE_SIZE)
		}
	}

	const handleLoadPrevious = () => {
		setOffset((prev) => Math.max(0, prev - PAGE_SIZE))
	}

	const handleFilterChange = (filter: StatusFilter) => {
		setStatusFilter(filter)
		setOffset(0) // Reset pagination when filter changes
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-8">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		)
	}

	if (!data || data.transactions.length === 0) {
		return (
			<div className="py-8 text-center">
				<FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
				<p className="mt-2 text-sm text-muted-foreground">{t('noHistory')}</p>
			</div>
		)
	}

	const showingStart = offset + 1
	const showingEnd = Math.min(offset + data.transactions.length, data.total)

	return (
		<div className="space-y-4">
			{/* Status filter */}
			<div className="flex flex-wrap gap-2">
				{statusFilters.map((filter) => (
					<Button
						key={filter}
						variant={statusFilter === filter ? 'default' : 'outline'}
						size="sm"
						onClick={() => handleFilterChange(filter)}
					>
						{filter === 'all' ? tPagination('all') : t(`status.${filter}`)}
					</Button>
				))}
			</div>

			{/* Showing count */}
			<div className="flex items-center justify-between text-sm text-muted-foreground">
				<span>
					{tPagination('showing', {
						start: showingStart,
						end: showingEnd,
						total: data.total,
					})}
				</span>
			</div>

			{/* Transactions list */}
			<div className="space-y-3">
				{data.transactions.map((transaction) => (
					<div
						key={transaction.id}
						className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"
					>
						<div className="flex-1">
							<div className="flex items-center gap-2">
								<p className="text-sm font-medium">{transaction.description || t('payment')}</p>
								<Badge variant={getStatusVariant(transaction.status)} size="sm">
									{t(`status.${transaction.status}`)}
								</Badge>
							</div>
							<p className="text-xs text-muted-foreground">
								{new Date(transaction.stripeCreatedAt).toLocaleDateString(locale, {
									year: 'numeric',
									month: 'long',
									day: 'numeric',
								})}
							</p>
						</div>
						<div className="flex items-center gap-3">
							<p
								className={cn(
									'text-sm font-semibold',
									transaction.type === 'refund' && 'text-warning',
								)}
							>
								{transaction.type === 'refund' && '-'}
								{formatCurrency(transaction.amountCents, transaction.currency, locale)}
							</p>
							{transaction.hostedInvoiceUrl && (
								<a
									href={transaction.hostedInvoiceUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
									title={t('downloadInvoice')}
								>
									<Download className="h-4 w-4" />
								</a>
							)}
						</div>
					</div>
				))}
			</div>

			{/* Pagination controls */}
			<div className="flex items-center justify-center gap-2 pt-2">
				{offset > 0 && (
					<Button variant="outline" size="sm" onClick={handleLoadPrevious} disabled={isFetching}>
						{tPagination('previous')}
					</Button>
				)}
				{data.hasMore && (
					<Button variant="outline" size="sm" onClick={handleLoadMore} disabled={isFetching}>
						{isFetching ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								{tPagination('loading')}
							</>
						) : (
							tPagination('loadMore')
						)}
					</Button>
				)}
			</div>
		</div>
	)
}
