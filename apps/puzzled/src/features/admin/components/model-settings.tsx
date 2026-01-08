'use client'

import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger, ScrollArea } from '@/shared/components/ui'
import { trpc } from '@/trpc/client'

type Model = {
	id: string
	name: string
	description?: string
	contextLength: number
	pricing: {
		prompt: number
		completion: number
	}
	maxCompletionTokens?: number
}

export function ModelSettings() {
	const [isOpen, setIsOpen] = useState(false)
	const [search, setSearch] = useState('')
	const [models, setModels] = useState<Model[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [selectedModel, setSelectedModel] = useState<string | null>(null)
	const [isSaving, setIsSaving] = useState(false)
	const [saveMessage, setSaveMessage] = useState<string | null>(null)

	// Fetch current setting
	const { data: currentModel, refetch } = trpc.admin.getSetting.useQuery(
		{ key: 'puzzle_generator_model' },
		{ refetchOnWindowFocus: false },
	)

	const updateSetting = trpc.admin.updateSetting.useMutation()

	useEffect(() => {
		if (currentModel && typeof currentModel === 'string') {
			setSelectedModel(currentModel)
		}
	}, [currentModel])

	// Fetch models with debounce
	useEffect(() => {
		const fetchModels = async () => {
			setIsLoading(true)
			try {
				const params = new URLSearchParams()
				if (search) params.set('search', search)
				const response = await fetch(`/api/admin/models?${params}`)
				const data = await response.json()
				setModels(data.models || [])
			} catch {
				// Fetch failed - UI shows empty model list
			} finally {
				setIsLoading(false)
			}
		}

		const timer = setTimeout(fetchModels, 300)
		return () => clearTimeout(timer)
	}, [search])

	const handleSelect = useCallback((modelId: string) => {
		setSelectedModel(modelId)
		setIsOpen(false)
		setSearch('')
	}, [])

	const handleSave = useCallback(async () => {
		if (!selectedModel) return

		setIsSaving(true)
		setSaveMessage(null)

		try {
			await updateSetting.mutateAsync({
				key: 'puzzle_generator_model',
				value: selectedModel,
				description: 'AI model used for puzzle generation',
			})
			await refetch()
			setSaveMessage('Saved successfully!')
			setTimeout(() => setSaveMessage(null), 3000)
		} catch {
			setSaveMessage('Failed to save')
		} finally {
			setIsSaving(false)
		}
	}, [selectedModel, updateSetting, refetch])

	const formatPrice = (price: number) => {
		if (price === 0) return 'Free'
		if (price < 1) return `$${price.toFixed(4)}/1M`
		return `$${price.toFixed(2)}/1M`
	}

	const selectedModelData = models.find((m) => m.id === selectedModel)

	return (
		<div className="admin-section">
			<div className="admin-section-header">
				<h2 className="text-lg font-semibold text-[var(--admin-text-primary)]">
					Puzzle Generator Model
				</h2>
			</div>
			<div className="admin-section-content">
				<p className="mb-6 text-sm text-[var(--admin-text-secondary)]">
					Select the AI model used for generating daily puzzles. Changes take effect for the next
					puzzle generation.
				</p>

				<div className="space-y-4">
					{/* Model Selector */}
					<Popover open={isOpen} onOpenChange={setIsOpen}>
						<PopoverTrigger asChild>
							<button
								type="button"
								role="combobox"
								aria-expanded={isOpen}
								className="admin-input flex w-full items-center justify-between"
							>
								<span className="truncate">{selectedModel || 'Select a model...'}</span>
								<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
							</button>
						</PopoverTrigger>
						<PopoverContent
							className="w-[var(--radix-popover-trigger-width)] border-[var(--admin-border)] bg-[var(--admin-bg-elevated)] p-0"
							align="start"
							sideOffset={4}
						>
							{/* Search Input */}
							<div className="flex items-center border-b border-[var(--admin-border)] px-3">
								<Search className="h-4 w-4 text-[var(--admin-text-muted)]" />
								<input
									type="text"
									placeholder="Search models..."
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									className="flex-1 bg-transparent px-2 py-3 text-sm text-[var(--admin-text-primary)] outline-none placeholder:text-[var(--admin-text-muted)]"
								/>
								{isLoading && (
									<Loader2 className="h-4 w-4 animate-spin text-[var(--admin-text-muted)]" />
								)}
							</div>

							{/* Model List */}
							<ScrollArea className="max-h-64">
								<div className="p-1">
									{models.length === 0 ? (
										<div className="px-3 py-6 text-center text-sm text-[var(--admin-text-muted)]">
											{isLoading ? 'Loading models...' : 'No models found'}
										</div>
									) : (
										models.map((model) => (
											<button
												type="button"
												key={model.id}
												onClick={() => handleSelect(model.id)}
												className={cn(
													'flex w-full items-start gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--admin-bg-surface)]',
													selectedModel === model.id && 'bg-[var(--admin-accent-subtle)]',
												)}
											>
												<div className="flex h-5 w-5 shrink-0 items-center justify-center">
													{selectedModel === model.id && (
														<Check className="h-4 w-4 text-[var(--admin-accent)]" />
													)}
												</div>
												<div className="flex-1 overflow-hidden">
													<div className="font-medium text-[var(--admin-text-primary)]">
														{model.name}
													</div>
													<div className="truncate text-xs text-[var(--admin-text-muted)]">
														{model.id}
													</div>
													<div className="mt-1 flex gap-3 text-xs text-[var(--admin-text-muted)]">
														<span>In: {formatPrice(model.pricing.prompt)}</span>
														<span>Out: {formatPrice(model.pricing.completion)}</span>
														<span>{(model.contextLength / 1000).toFixed(0)}K ctx</span>
													</div>
												</div>
											</button>
										))
									)}
								</div>
							</ScrollArea>
						</PopoverContent>
					</Popover>

					{/* Selected Model Info */}
					{selectedModelData && (
						<div className="rounded-lg bg-[var(--admin-bg-surface)] p-4 text-sm">
							<div className="font-medium text-[var(--admin-text-primary)]">
								{selectedModelData.name}
							</div>
							<div className="mt-1 text-[var(--admin-text-muted)]">{selectedModelData.id}</div>
							{selectedModelData.description && (
								<div className="mt-2 line-clamp-2 text-[var(--admin-text-secondary)]">
									{selectedModelData.description}
								</div>
							)}
							<div className="mt-2 flex gap-4 text-xs text-[var(--admin-text-muted)]">
								<span>Input: {formatPrice(selectedModelData.pricing.prompt)}</span>
								<span>Output: {formatPrice(selectedModelData.pricing.completion)}</span>
								<span>Context: {(selectedModelData.contextLength / 1000).toFixed(0)}K tokens</span>
							</div>
						</div>
					)}

					{/* Save Button */}
					<div className="flex items-center gap-3">
						<button
							type="button"
							className="admin-btn admin-btn-primary"
							onClick={handleSave}
							disabled={isSaving || !selectedModel || selectedModel === currentModel}
						>
							{isSaving ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									Saving...
								</>
							) : (
								'Save Changes'
							)}
						</button>
						{saveMessage && (
							<span
								className={cn(
									'text-sm',
									saveMessage.includes('success')
										? 'text-[var(--admin-success)]'
										: 'text-[var(--admin-error)]',
								)}
							>
								{saveMessage}
							</span>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
