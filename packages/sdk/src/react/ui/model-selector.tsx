/**
 * AI Model Selector Component
 *
 * Browse and select from available AI models.
 * Supports filtering by capability and search.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import type { AIModelInfo } from "../../types";
import { useModels } from "../ai-hooks";
import type { ThemeVariables } from "./styles";
import {
	baseStyles,
	defaultTheme,
	injectGlobalStyles,
	mergeStyles,
} from "./styles";

export interface ModelSelectorProps {
	/** Theme variables */
	theme?: ThemeVariables;
	/** Called when a model is selected */
	onSelect: (model: AIModelInfo) => void;
	/** Currently selected model ID */
	value?: string;
	/** Filter by capability */
	capability?: "chat" | "vision" | "tool" | "embedding";
	/** Placeholder text */
	placeholder?: string;
	/** Whether the selector is disabled */
	disabled?: boolean;
	/** Custom class name */
	className?: string;
	/** Show pricing info */
	showPricing?: boolean;
	/** Show context window */
	showContextWindow?: boolean;
	/** Compact mode (for inline use) */
	compact?: boolean;
}

/**
 * AI Model Selector
 *
 * @example
 * ```tsx
 * function ChatConfig() {
 *   const [model, setModel] = useState<AIModelInfo | null>(null)
 *
 *   return (
 *     <ModelSelector
 *       capability="chat"
 *       onSelect={setModel}
 *       value={model?.id}
 *       showPricing
 *       showContextWindow
 *     />
 *   )
 * }
 * ```
 */
export function ModelSelector({
	theme = defaultTheme,
	onSelect,
	value,
	capability,
	placeholder = "Select a model...",
	disabled = false,
	className,
	showPricing = true,
	showContextWindow = true,
	compact = false,
}: ModelSelectorProps) {
	const styles = baseStyles(theme);
	const [isOpen, setIsOpen] = useState(false);
	const [searchValue, setSearchValue] = useState("");
	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const { models, isLoading, error, setSearch, hasMore, loadMore } = useModels({
		capability,
		fetchOnMount: true,
		pageSize: 50,
	});

	// Find selected model
	const selectedModel = models.find((m) => m.id === value);

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles();
	}, []);

	// Close on outside click
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// Handle search input
	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setSearchValue(value);
		setSearch(value);
	};

	// Handle model selection
	const handleSelect = (model: AIModelInfo) => {
		onSelect(model);
		setIsOpen(false);
		setSearchValue("");
		setSearch("");
	};

	// Handle scroll for infinite loading
	const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const target = e.target as HTMLDivElement;
		const bottom =
			target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
		if (bottom && hasMore && !isLoading) {
			loadMore();
		}
	};

	// Format context window
	const formatContext = (tokens: number) => {
		if (tokens >= 1000000) {
			return `${(tokens / 1000000).toFixed(1)}M`;
		}
		if (tokens >= 1000) {
			return `${(tokens / 1000).toFixed(0)}K`;
		}
		return tokens.toString();
	};

	// Format price
	const formatPrice = (pricePerMillion: number) => {
		if (pricePerMillion === 0) return "Free";
		if (pricePerMillion < 0.01) return `$${pricePerMillion.toFixed(4)}`;
		if (pricePerMillion < 1) return `$${pricePerMillion.toFixed(2)}`;
		return `$${pricePerMillion.toFixed(1)}`;
	};

	// Get capability badge color
	const getCapabilityColor = (cap: string) => {
		switch (cap) {
			case "chat":
				return theme.colorPrimary;
			case "vision":
				return "#9333ea"; // purple
			case "tool":
				return "#059669"; // green
			case "embedding":
				return "#d97706"; // amber
			default:
				return theme.colorMuted;
		}
	};

	const containerStyles: React.CSSProperties = {
		position: "relative",
		width: "100%",
	};

	const triggerStyles: React.CSSProperties = mergeStyles(styles.input, {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		cursor: disabled ? "not-allowed" : "pointer",
		opacity: disabled ? 0.5 : 1,
		padding: compact ? "0.5rem 0.75rem" : "0.75rem 1rem",
	});

	const dropdownStyles: React.CSSProperties = {
		position: "absolute",
		top: "100%",
		left: 0,
		right: 0,
		marginTop: "0.25rem",
		backgroundColor: theme.colorBackground,
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadius,
		boxShadow:
			"0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
		zIndex: 50,
		maxHeight: "400px",
		overflow: "hidden",
		display: "flex",
		flexDirection: "column",
	};

	const searchInputStyles: React.CSSProperties = mergeStyles(styles.input, {
		margin: "0.5rem",
		marginBottom: 0,
		width: "calc(100% - 1rem)",
	});

	const listStyles: React.CSSProperties = {
		overflowY: "auto",
		maxHeight: "340px",
		padding: "0.5rem",
	};

	const itemStyles = (isSelected: boolean): React.CSSProperties => ({
		display: "flex",
		flexDirection: "column",
		padding: "0.75rem",
		borderRadius: theme.borderRadius,
		cursor: "pointer",
		backgroundColor: isSelected ? `${theme.colorPrimary}10` : "transparent",
		border: isSelected
			? `1px solid ${theme.colorPrimary}30`
			: "1px solid transparent",
		marginBottom: "0.25rem",
		transition: "background-color 0.15s",
	});

	const badgeStyles = (color: string): React.CSSProperties => ({
		display: "inline-flex",
		alignItems: "center",
		padding: "0.125rem 0.375rem",
		borderRadius: "9999px",
		fontSize: "0.625rem",
		fontWeight: 500,
		backgroundColor: `${color}15`,
		color,
		textTransform: "uppercase",
		letterSpacing: "0.05em",
	});

	return (
		<div ref={containerRef} style={containerStyles} className={className}>
			{/* Trigger */}
			<div
				style={triggerStyles}
				onClick={() => !disabled && setIsOpen(!isOpen)}
				role="button"
				tabIndex={disabled ? -1 : 0}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						if (!disabled) setIsOpen(!isOpen);
					}
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
						flex: 1,
						minWidth: 0,
					}}
				>
					{selectedModel ? (
						<>
							<span
								style={{
									fontWeight: 500,
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
								}}
							>
								{selectedModel.name}
							</span>
							{!compact && showContextWindow && (
								<span style={mergeStyles(styles.textXs, styles.textMuted)}>
									{formatContext(selectedModel.contextWindow)} tokens
								</span>
							)}
						</>
					) : (
						<span style={styles.textMuted}>{placeholder}</span>
					)}
				</div>
				<ChevronIcon direction={isOpen ? "up" : "down"} />
			</div>

			{/* Dropdown */}
			{isOpen && (
				<div style={dropdownStyles}>
					{/* Search input */}
					<input
						ref={inputRef}
						type="text"
						value={searchValue}
						onChange={handleSearchChange}
						placeholder="Search models..."
						style={searchInputStyles}
						autoFocus
					/>

					{/* Model list */}
					<div style={listStyles} onScroll={handleScroll}>
						{error && (
							<div
								style={mergeStyles(styles.alert, styles.alertError, {
									margin: "0.5rem",
								})}
							>
								{error.message}
							</div>
						)}

						{models.length === 0 && !isLoading && (
							<div
								style={mergeStyles(styles.textCenter, styles.textMuted, {
									padding: "2rem",
								})}
							>
								No models found
							</div>
						)}

						{models.map((model) => (
							<div
								key={model.id}
								style={itemStyles(model.id === value)}
								onClick={() => handleSelect(model)}
								onMouseEnter={(e) => {
									if (model.id !== value) {
										e.currentTarget.style.backgroundColor = theme.colorMuted;
									}
								}}
								onMouseLeave={(e) => {
									if (model.id !== value) {
										e.currentTarget.style.backgroundColor = "transparent";
									}
								}}
							>
								{/* Model name and ID */}
								<div
									style={{
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										marginBottom: "0.25rem",
									}}
								>
									<span style={{ fontWeight: 500 }}>{model.name}</span>
									{showContextWindow && (
										<span style={mergeStyles(styles.textXs, styles.textMuted)}>
											{formatContext(model.contextWindow)} tokens
										</span>
									)}
								</div>

								{/* Model ID */}
								<div
									style={mergeStyles(styles.textXs, styles.textMuted, {
										marginBottom: "0.5rem",
										fontFamily: "monospace",
									})}
								>
									{model.id}
								</div>

								{/* Capabilities and pricing */}
								<div
									style={{
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										gap: "0.5rem",
									}}
								>
									{/* Capabilities */}
									<div
										style={{
											display: "flex",
											gap: "0.25rem",
											flexWrap: "wrap",
										}}
									>
										{model.capabilities.map((cap) => (
											<span
												key={cap}
												style={badgeStyles(getCapabilityColor(cap))}
											>
												{cap}
											</span>
										))}
									</div>

									{/* Pricing */}
									{showPricing && (
										<div style={mergeStyles(styles.textXs, styles.textMuted)}>
											{formatPrice(model.inputCostPer1M ?? 0)}/
											{formatPrice(model.outputCostPer1M ?? 0)} per 1M
										</div>
									)}
								</div>

								{/* Description */}
								{model.description && (
									<div
										style={mergeStyles(styles.textXs, styles.textMuted, {
											marginTop: "0.5rem",
											overflow: "hidden",
											textOverflow: "ellipsis",
											display: "-webkit-box",
											WebkitLineClamp: 2,
											WebkitBoxOrient: "vertical",
										})}
									>
										{model.description}
									</div>
								)}
							</div>
						))}

						{/* Loading indicator */}
						{isLoading && (
							<div style={mergeStyles(styles.flexCenter, { padding: "1rem" })}>
								<span style={styles.spinner} />
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

// Icons
function ChevronIcon({ direction }: { direction: "up" | "down" }) {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			style={{ transform: direction === "up" ? "rotate(180deg)" : undefined }}
		>
			<polyline points="6 9 12 15 18 9" />
		</svg>
	);
}

/**
 * Model Card Component
 *
 * Display a single model in a card format.
 */
export interface ModelCardProps {
	model: AIModelInfo;
	theme?: ThemeVariables;
	onSelect?: () => void;
	selected?: boolean;
	showPricing?: boolean;
	className?: string;
}

export function ModelCard({
	model,
	theme = defaultTheme,
	onSelect,
	selected = false,
	showPricing = true,
	className,
}: ModelCardProps) {
	const styles = baseStyles(theme);

	// Format context window
	const formatContext = (tokens: number) => {
		if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
		if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
		return tokens.toString();
	};

	// Format price
	const formatPrice = (pricePerMillion: number) => {
		if (pricePerMillion === 0) return "Free";
		if (pricePerMillion < 0.01) return `$${pricePerMillion.toFixed(4)}`;
		if (pricePerMillion < 1) return `$${pricePerMillion.toFixed(2)}`;
		return `$${pricePerMillion.toFixed(1)}`;
	};

	// Get capability badge color
	const getCapabilityColor = (cap: string) => {
		switch (cap) {
			case "chat":
				return theme.colorPrimary;
			case "vision":
				return "#9333ea";
			case "tool":
				return "#059669";
			case "embedding":
				return "#d97706";
			default:
				return theme.colorMuted;
		}
	};

	const cardStyles: React.CSSProperties = mergeStyles(styles.card, {
		padding: "1rem",
		cursor: onSelect ? "pointer" : "default",
		border: selected
			? `2px solid ${theme.colorPrimary}`
			: `1px solid ${theme.colorBorder}`,
		transition: "border-color 0.15s, box-shadow 0.15s",
	});

	const badgeStyles = (color: string): React.CSSProperties => ({
		display: "inline-flex",
		alignItems: "center",
		padding: "0.125rem 0.375rem",
		borderRadius: "9999px",
		fontSize: "0.625rem",
		fontWeight: 500,
		backgroundColor: `${color}15`,
		color,
		textTransform: "uppercase",
		letterSpacing: "0.05em",
	});

	return (
		<div
			style={cardStyles}
			className={className}
			onClick={onSelect}
			onMouseEnter={(e) => {
				if (onSelect && !selected) {
					e.currentTarget.style.borderColor = theme.colorPrimary;
				}
			}}
			onMouseLeave={(e) => {
				if (!selected) {
					e.currentTarget.style.borderColor = theme.colorBorder;
				}
			}}
		>
			{/* Header */}
			<div
				style={{
					display: "flex",
					alignItems: "flex-start",
					justifyContent: "space-between",
					marginBottom: "0.5rem",
				}}
			>
				<div>
					<h4
						style={{ margin: 0, fontSize: theme.fontSizeBase, fontWeight: 600 }}
					>
						{model.name}
					</h4>
					<p
						style={mergeStyles(styles.textXs, styles.textMuted, {
							margin: "0.25rem 0 0",
							fontFamily: "monospace",
						})}
					>
						{model.id}
					</p>
				</div>
				<span style={mergeStyles(styles.textSm, styles.textMuted)}>
					{formatContext(model.contextWindow)} tokens
				</span>
			</div>

			{/* Capabilities */}
			<div
				style={{
					display: "flex",
					gap: "0.25rem",
					marginBottom: "0.75rem",
					flexWrap: "wrap",
				}}
			>
				{model.capabilities.map((cap) => (
					<span key={cap} style={badgeStyles(getCapabilityColor(cap))}>
						{cap}
					</span>
				))}
			</div>

			{/* Description */}
			{model.description && (
				<p
					style={mergeStyles(styles.textSm, styles.textMuted, {
						margin: "0 0 0.75rem",
						overflow: "hidden",
						textOverflow: "ellipsis",
						display: "-webkit-box",
						WebkitLineClamp: 2,
						WebkitBoxOrient: "vertical",
					})}
				>
					{model.description}
				</p>
			)}

			{/* Pricing */}
			{showPricing && (
				<div style={{ display: "flex", gap: "1rem" }}>
					<div>
						<span style={mergeStyles(styles.textXs, styles.textMuted)}>
							Input
						</span>
						<p
							style={{
								margin: "0.125rem 0 0",
								fontSize: theme.fontSizeSm,
								fontWeight: 500,
							}}
						>
							{formatPrice(model.inputCostPer1M ?? 0)}/1M
						</p>
					</div>
					<div>
						<span style={mergeStyles(styles.textXs, styles.textMuted)}>
							Output
						</span>
						<p
							style={{
								margin: "0.125rem 0 0",
								fontSize: theme.fontSizeSm,
								fontWeight: 500,
							}}
						>
							{formatPrice(model.outputCostPer1M ?? 0)}/1M
						</p>
					</div>
				</div>
			)}
		</div>
	);
}

/**
 * Model Grid Component
 *
 * Display models in a grid layout with filtering.
 */
export interface ModelGridProps {
	theme?: ThemeVariables;
	onSelect: (model: AIModelInfo) => void;
	value?: string;
	capability?: "chat" | "vision" | "tool" | "embedding";
	showPricing?: boolean;
	columns?: 1 | 2 | 3 | 4;
	className?: string;
}

export function ModelGrid({
	theme = defaultTheme,
	onSelect,
	value,
	capability,
	showPricing = true,
	columns = 3,
	className,
}: ModelGridProps) {
	const styles = baseStyles(theme);
	const {
		models,
		isLoading,
		error,
		setSearch,
		setCapability,
		hasMore,
		loadMore,
		total,
	} = useModels({
		capability,
		fetchOnMount: true,
		pageSize: 24,
	});

	const [searchValue, setSearchValue] = useState("");
	const [filterCapability, setFilterCapability] = useState(capability);

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles();
	}, []);

	// Handle search
	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setSearchValue(value);
		setSearch(value);
	};

	// Handle capability filter
	const handleCapabilityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const value = e.target.value as
			| "chat"
			| "vision"
			| "tool"
			| "embedding"
			| "";
		setFilterCapability(value || undefined);
		setCapability(value || undefined);
	};

	const gridStyles: React.CSSProperties = {
		display: "grid",
		gridTemplateColumns: `repeat(${columns}, 1fr)`,
		gap: "1rem",
	};

	return (
		<div className={className}>
			{/* Filters */}
			<div
				style={mergeStyles(styles.flexRow, {
					gap: "1rem",
					marginBottom: "1.5rem",
					flexWrap: "wrap",
				})}
			>
				<div style={{ flex: 1, minWidth: "200px" }}>
					<input
						type="text"
						value={searchValue}
						onChange={handleSearchChange}
						placeholder="Search models..."
						style={mergeStyles(styles.input, { width: "100%" })}
					/>
				</div>
				<select
					value={filterCapability || ""}
					onChange={handleCapabilityChange}
					style={mergeStyles(styles.input, { minWidth: "150px" })}
				>
					<option value="">All capabilities</option>
					<option value="chat">Chat</option>
					<option value="vision">Vision</option>
					<option value="tool">Tool Use</option>
					<option value="embedding">Embedding</option>
				</select>
				<span
					style={mergeStyles(styles.textSm, styles.textMuted, {
						alignSelf: "center",
					})}
				>
					{total} models
				</span>
			</div>

			{/* Error */}
			{error && (
				<div style={mergeStyles(styles.alert, styles.alertError, styles.mb4)}>
					{error.message}
				</div>
			)}

			{/* Grid */}
			<div style={gridStyles}>
				{models.map((model) => (
					<ModelCard
						key={model.id}
						model={model}
						theme={theme}
						onSelect={() => onSelect(model)}
						selected={model.id === value}
						showPricing={showPricing}
					/>
				))}
			</div>

			{/* Loading / Load more */}
			{isLoading ? (
				<div style={mergeStyles(styles.flexCenter, { padding: "2rem" })}>
					<span style={styles.spinner} />
				</div>
			) : hasMore ? (
				<div style={mergeStyles(styles.flexCenter, { padding: "1.5rem" })}>
					<button
						type="button"
						onClick={loadMore}
						style={mergeStyles(styles.button, styles.buttonOutline)}
					>
						Load more models
					</button>
				</div>
			) : null}

			{/* Empty state */}
			{!isLoading && models.length === 0 && (
				<div
					style={mergeStyles(styles.textCenter, styles.textMuted, {
						padding: "3rem",
					})}
				>
					No models found matching your criteria
				</div>
			)}
		</div>
	);
}
