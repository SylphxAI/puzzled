'use client'

import { formatDistanceToNow } from 'date-fns'
import { AlertCircle, CheckCircle, Globe, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { maskIpAddress, parseUserAgent } from '@/lib/user-agent'
import { Button } from '@sylphx/ui'
import { trpc } from '@/trpc/client'
import { DeviceIcon } from './device-icon'

const PAGE_SIZE = 10

export function LoginHistory() {
	const t = useTranslations('settings.loginHistory')
	const tPagination = useTranslations('pagination')
	const [offset, setOffset] = useState(0)

	const { data, isLoading, isFetching } = trpc.security.getLoginHistory.useQuery({
		limit: PAGE_SIZE,
		offset,
	})

	const handleLoadMore = () => {
		if (data?.hasMore) {
			setOffset((prev) => prev + PAGE_SIZE)
		}
	}

	const handleLoadPrevious = () => {
		setOffset((prev) => Math.max(0, prev - PAGE_SIZE))
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-8">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		)
	}

	if (!data || data.history.length === 0) {
		return (
			<div className="py-8 text-center">
				<p className="text-sm text-muted-foreground">{t('noHistory')}</p>
			</div>
		)
	}

	const showingStart = offset + 1
	const showingEnd = Math.min(offset + data.history.length, data.total)

	return (
		<div className="space-y-4">
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

			{/* History list */}
			<div className="space-y-3">
				{data.history.map((entry) => {
					const parsed = parseUserAgent(entry.userAgent || entry.device)
					const location =
						entry.city && entry.country ? `${entry.city}, ${entry.country}` : entry.country || null
					const deviceDescription =
						entry.device || `${parsed.browser.name} on ${parsed.device.name}`

					return (
						<div key={entry.id} className="flex items-start justify-between rounded-lg border p-4">
							<div className="flex items-start gap-4">
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
									<DeviceIcon type={parsed.device.type} />
								</div>
								<div className="flex-1">
									<div className="flex items-center gap-2">
										<p className="font-medium">{deviceDescription}</p>
										{entry.success ? (
											<CheckCircle className="h-4 w-4 text-green-500" />
										) : (
											<AlertCircle className="h-4 w-4 text-destructive" />
										)}
									</div>
									<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
										{location && (
											<span className="flex items-center gap-1">
												<Globe className="h-3 w-3" />
												{location}
											</span>
										)}
										<span>{maskIpAddress(entry.ipAddress)}</span>
										<span>
											{formatDistanceToNow(new Date(entry.createdAt), {
												addSuffix: true,
											})}
										</span>
									</div>
									{!entry.success && entry.failureReason && (
										<p className="mt-1 text-sm text-destructive">
											{t('failureReason')}: {entry.failureReason}
										</p>
									)}
								</div>
							</div>
						</div>
					)
				})}
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
