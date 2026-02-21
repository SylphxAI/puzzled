/**
 * Billing Management Components
 *
 * Invoice history, payment method management, and usage tracking.
 */

"use client";

import { type CSSProperties, useEffect, useState } from "react";
import { useBilling } from "../platform-hooks";
import type { ThemeVariables } from "./styles";
import {
	baseStyles,
	defaultTheme,
	injectGlobalStyles,
	mergeStyles,
} from "./styles";

// ============================================
// Types
// ============================================

export interface Invoice {
	id: string;
	number: string;
	date: string;
	dueDate?: string;
	amount: number;
	currency: string;
	status: "paid" | "pending" | "overdue" | "void";
	pdfUrl?: string;
	description?: string;
}

export interface PaymentMethod {
	id: string;
	type: "card" | "bank_account" | "paypal";
	last4: string;
	brand?: string; // visa, mastercard, amex
	expiryMonth?: number;
	expiryYear?: number;
	isDefault: boolean;
}

// ============================================
// InvoiceHistory
// ============================================

export interface InvoiceHistoryProps {
	/** Theme variables */
	theme?: ThemeVariables;
	/** Custom class name */
	className?: string;
	/** Title */
	title?: string;
	/** Invoices to display (if not using hook) */
	invoices?: Invoice[];
	/** Called when download is clicked */
	onDownload?: (invoice: Invoice) => void;
	/** Show pagination */
	showPagination?: boolean;
	/** Items per page */
	pageSize?: number;
	/** Empty state message */
	emptyMessage?: string;
}

/**
 * Invoice history list with download links
 *
 * @example
 * ```tsx
 * <InvoiceHistory
 *   title="Billing History"
 *   onDownload={(invoice) => window.open(invoice.pdfUrl)}
 * />
 * ```
 */
export function InvoiceHistory({
	theme = defaultTheme,
	className,
	title = "Invoice History",
	invoices: propInvoices,
	onDownload,
	showPagination = true,
	pageSize = 10,
	emptyMessage = "No invoices yet",
}: InvoiceHistoryProps) {
	const [invoices] = useState<Invoice[]>(propInvoices ?? []);
	const [currentPage, setCurrentPage] = useState(1);
	const styles = baseStyles(theme);

	useEffect(() => {
		injectGlobalStyles();
	}, []);

	const totalPages = Math.ceil(invoices.length / pageSize);
	const paginatedInvoices = invoices.slice(
		(currentPage - 1) * pageSize,
		currentPage * pageSize,
	);

	const formatCurrency = (amount: number, currency: string) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: currency.toUpperCase(),
		}).format(amount / 100);
	};

	const formatDate = (dateStr: string) => {
		return new Date(dateStr).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	const statusColors: Record<Invoice["status"], { bg: string; text: string }> =
		{
			paid: { bg: `${theme.colorSuccess}20`, text: theme.colorSuccess },
			pending: { bg: `${theme.colorWarning}20`, text: theme.colorWarning },
			overdue: {
				bg: `${theme.colorDestructive}20`,
				text: theme.colorDestructive,
			},
			void: { bg: theme.colorMuted, text: theme.colorMutedForeground },
		};

	const containerStyle: CSSProperties = {
		fontFamily: theme.fontFamily,
	};

	const tableStyle: CSSProperties = {
		width: "100%",
		borderCollapse: "collapse",
		fontSize: theme.fontSizeSm,
	};

	const thStyle: CSSProperties = {
		padding: "0.75rem 1rem",
		textAlign: "left",
		fontWeight: 500,
		color: theme.colorMutedForeground,
		borderBottom: `1px solid ${theme.colorBorder}`,
		fontSize: theme.fontSizeXs,
		textTransform: "uppercase",
		letterSpacing: "0.05em",
	};

	const tdStyle: CSSProperties = {
		padding: "0.75rem 1rem",
		borderBottom: `1px solid ${theme.colorBorder}`,
	};

	return (
		<div style={containerStyle} className={className}>
			<h3
				style={{
					margin: "0 0 1rem",
					fontSize: theme.fontSizeLg,
					fontWeight: 600,
				}}
			>
				{title}
			</h3>

			{invoices.length === 0 ? (
				<div
					style={{
						padding: "3rem",
						textAlign: "center",
						color: theme.colorMutedForeground,
						border: `1px solid ${theme.colorBorder}`,
						borderRadius: theme.borderRadius,
					}}
				>
					<InvoiceIcon color={theme.colorMuted} size={48} />
					<p style={{ margin: "1rem 0 0" }}>{emptyMessage}</p>
				</div>
			) : (
				<>
					<div
						style={{
							overflowX: "auto",
							border: `1px solid ${theme.colorBorder}`,
							borderRadius: theme.borderRadius,
						}}
					>
						<table style={tableStyle}>
							<thead>
								<tr>
									<th style={thStyle}>Invoice</th>
									<th style={thStyle}>Date</th>
									<th style={thStyle}>Amount</th>
									<th style={thStyle}>Status</th>
									<th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
								</tr>
							</thead>
							<tbody>
								{paginatedInvoices.map((invoice) => (
									<tr key={invoice.id}>
										<td style={tdStyle}>
											<div style={{ fontWeight: 500 }}>{invoice.number}</div>
											{invoice.description && (
												<div
													style={{
														fontSize: theme.fontSizeXs,
														color: theme.colorMutedForeground,
													}}
												>
													{invoice.description}
												</div>
											)}
										</td>
										<td style={tdStyle}>{formatDate(invoice.date)}</td>
										<td style={tdStyle}>
											<span style={{ fontWeight: 500 }}>
												{formatCurrency(invoice.amount, invoice.currency)}
											</span>
										</td>
										<td style={tdStyle}>
											<span
												style={{
													display: "inline-block",
													padding: "0.25rem 0.5rem",
													fontSize: theme.fontSizeXs,
													fontWeight: 500,
													borderRadius: theme.borderRadiusSm,
													backgroundColor: statusColors[invoice.status].bg,
													color: statusColors[invoice.status].text,
													textTransform: "capitalize",
												}}
											>
												{invoice.status}
											</span>
										</td>
										<td style={{ ...tdStyle, textAlign: "right" }}>
											{invoice.pdfUrl && (
												<button
													type="button"
													onClick={() => onDownload?.(invoice)}
													style={{
														padding: "0.25rem 0.5rem",
														fontSize: theme.fontSizeXs,
														border: `1px solid ${theme.colorBorder}`,
														borderRadius: theme.borderRadiusSm,
														backgroundColor: "transparent",
														color: theme.colorForeground,
														cursor: "pointer",
														display: "inline-flex",
														alignItems: "center",
														gap: "0.25rem",
													}}
												>
													<DownloadIcon color={theme.colorForeground} />
													PDF
												</button>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					{showPagination && totalPages > 1 && (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								marginTop: "1rem",
								fontSize: theme.fontSizeXs,
								color: theme.colorMutedForeground,
							}}
						>
							<span>
								Showing {(currentPage - 1) * pageSize + 1}-
								{Math.min(currentPage * pageSize, invoices.length)} of{" "}
								{invoices.length}
							</span>
							<div style={{ display: "flex", gap: "0.5rem" }}>
								<button
									type="button"
									disabled={currentPage === 1}
									onClick={() => setCurrentPage((p) => p - 1)}
									style={mergeStyles(styles.button, styles.buttonOutline, {
										padding: "0.25rem 0.5rem",
										fontSize: theme.fontSizeXs,
										opacity: currentPage === 1 ? 0.5 : 1,
									})}
								>
									Previous
								</button>
								<button
									type="button"
									disabled={currentPage === totalPages}
									onClick={() => setCurrentPage((p) => p + 1)}
									style={mergeStyles(styles.button, styles.buttonOutline, {
										padding: "0.25rem 0.5rem",
										fontSize: theme.fontSizeXs,
										opacity: currentPage === totalPages ? 0.5 : 1,
									})}
								>
									Next
								</button>
							</div>
						</div>
					)}
				</>
			)}
		</div>
	);
}

// ============================================
// PaymentMethodManager
// ============================================

export interface PaymentMethodManagerProps {
	/** Theme variables */
	theme?: ThemeVariables;
	/** Custom class name */
	className?: string;
	/** Title */
	title?: string;
	/** Payment methods to display */
	paymentMethods?: PaymentMethod[];
	/** Called when add is clicked */
	onAdd?: () => void;
	/** Called when remove is clicked */
	onRemove?: (method: PaymentMethod) => void;
	/** Called when set default is clicked */
	onSetDefault?: (method: PaymentMethod) => void;
	/** Empty state message */
	emptyMessage?: string;
	/** Whether adding is in progress */
	isAddingPaymentMethod?: boolean;
}

/**
 * Payment method management card
 *
 * @example
 * ```tsx
 * <PaymentMethodManager
 *   onAdd={() => openStripeModal()}
 *   onRemove={(method) => removePaymentMethod(method.id)}
 * />
 * ```
 */
export function PaymentMethodManager({
	theme = defaultTheme,
	className,
	title = "Payment Methods",
	paymentMethods = [],
	onAdd,
	onRemove,
	onSetDefault,
	emptyMessage = "No payment methods added",
	isAddingPaymentMethod = false,
}: PaymentMethodManagerProps) {
	const styles = baseStyles(theme);

	useEffect(() => {
		injectGlobalStyles();
	}, []);

	const getBrandIcon = (brand?: string) => {
		switch (brand?.toLowerCase()) {
			case "visa":
				return "💳";
			case "mastercard":
				return "💳";
			case "amex":
				return "💳";
			default:
				return "💳";
		}
	};

	const containerStyle: CSSProperties = {
		fontFamily: theme.fontFamily,
	};

	const cardStyle: CSSProperties = {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: "1rem",
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadius,
		marginBottom: "0.75rem",
	};

	return (
		<div style={containerStyle} className={className}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: "1rem",
				}}
			>
				<h3 style={{ margin: 0, fontSize: theme.fontSizeLg, fontWeight: 600 }}>
					{title}
				</h3>
				<button
					type="button"
					onClick={onAdd}
					disabled={isAddingPaymentMethod}
					style={mergeStyles(styles.button, styles.buttonPrimary, {
						padding: "0.5rem 1rem",
						fontSize: theme.fontSizeSm,
					})}
				>
					{isAddingPaymentMethod ? (
						<span style={styles.spinner} />
					) : (
						<>
							<PlusIcon color={theme.colorPrimaryForeground} /> Add
						</>
					)}
				</button>
			</div>

			{paymentMethods.length === 0 ? (
				<div
					style={{
						padding: "3rem",
						textAlign: "center",
						color: theme.colorMutedForeground,
						border: `1px solid ${theme.colorBorder}`,
						borderRadius: theme.borderRadius,
					}}
				>
					<CreditCardIcon color={theme.colorMuted} size={48} />
					<p style={{ margin: "1rem 0 0" }}>{emptyMessage}</p>
				</div>
			) : (
				<div>
					{paymentMethods.map((method) => (
						<div key={method.id} style={cardStyle}>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: "0.75rem",
								}}
							>
								<span style={{ fontSize: "1.5rem" }}>
									{getBrandIcon(method.brand)}
								</span>
								<div>
									<div
										style={{
											fontWeight: 500,
											display: "flex",
											alignItems: "center",
											gap: "0.5rem",
										}}
									>
										{method.brand && (
											<span style={{ textTransform: "capitalize" }}>
												{method.brand}
											</span>
										)}
										<span>•••• {method.last4}</span>
										{method.isDefault && (
											<span
												style={{
													fontSize: theme.fontSizeXs,
													padding: "0.125rem 0.375rem",
													backgroundColor: theme.colorPrimary,
													color: theme.colorPrimaryForeground,
													borderRadius: theme.borderRadiusSm,
												}}
											>
												Default
											</span>
										)}
									</div>
									{method.expiryMonth && method.expiryYear && (
										<div
											style={{
												fontSize: theme.fontSizeXs,
												color: theme.colorMutedForeground,
											}}
										>
											Expires {method.expiryMonth.toString().padStart(2, "0")}/
											{method.expiryYear}
										</div>
									)}
								</div>
							</div>
							<div style={{ display: "flex", gap: "0.5rem" }}>
								{!method.isDefault && onSetDefault && (
									<button
										type="button"
										onClick={() => onSetDefault(method)}
										style={mergeStyles(styles.button, styles.buttonOutline, {
											padding: "0.25rem 0.5rem",
											fontSize: theme.fontSizeXs,
										})}
									>
										Set Default
									</button>
								)}
								{onRemove && (
									<button
										type="button"
										onClick={() => onRemove(method)}
										style={{
											padding: "0.25rem 0.5rem",
											fontSize: theme.fontSizeXs,
											border: `1px solid ${theme.colorDestructive}`,
											borderRadius: theme.borderRadiusSm,
											backgroundColor: "transparent",
											color: theme.colorDestructive,
											cursor: "pointer",
										}}
									>
										Remove
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// ============================================
// UsageOverview
// ============================================

export interface UsageItem {
	service: string;
	used: number;
	limit: number;
	unit: string;
	cost?: number;
}

export interface UsageOverviewProps {
	/** Theme variables */
	theme?: ThemeVariables;
	/** Custom class name */
	className?: string;
	/** Title */
	title?: string;
	/** Usage items */
	items?: UsageItem[];
	/** Current period */
	period?: string;
	/** Total cost */
	totalCost?: number;
	/** Currency */
	currency?: string;
}

/**
 * Usage overview with progress bars
 *
 * @example
 * ```tsx
 * <UsageOverview
 *   items={[
 *     { service: 'API Requests', used: 8500, limit: 10000, unit: 'requests' },
 *     { service: 'Storage', used: 2.5, limit: 5, unit: 'GB' },
 *   ]}
 *   totalCost={29.99}
 * />
 * ```
 */
export function UsageOverview({
	theme = defaultTheme,
	className,
	title = "Current Usage",
	items = [],
	period,
	totalCost,
	currency = "USD",
}: UsageOverviewProps) {
	const styles = baseStyles(theme);

	useEffect(() => {
		injectGlobalStyles();
	}, []);

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: currency.toUpperCase(),
		}).format(amount);
	};

	const containerStyle: CSSProperties = {
		fontFamily: theme.fontFamily,
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadius,
		overflow: "hidden",
	};

	return (
		<div style={containerStyle} className={className}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					padding: "1rem",
					backgroundColor: theme.colorMuted,
					borderBottom: `1px solid ${theme.colorBorder}`,
				}}
			>
				<div>
					<h3
						style={{ margin: 0, fontSize: theme.fontSizeLg, fontWeight: 600 }}
					>
						{title}
					</h3>
					{period && (
						<p
							style={{
								margin: "0.25rem 0 0",
								fontSize: theme.fontSizeXs,
								color: theme.colorMutedForeground,
							}}
						>
							{period}
						</p>
					)}
				</div>
				{totalCost !== undefined && (
					<div style={{ textAlign: "right" }}>
						<div style={{ fontSize: theme.fontSizeXl, fontWeight: 600 }}>
							{formatCurrency(totalCost)}
						</div>
						<div
							style={{
								fontSize: theme.fontSizeXs,
								color: theme.colorMutedForeground,
							}}
						>
							Current bill
						</div>
					</div>
				)}
			</div>

			<div style={{ padding: "1rem" }}>
				{items.length === 0 ? (
					<div
						style={{
							textAlign: "center",
							color: theme.colorMutedForeground,
							padding: "2rem",
						}}
					>
						No usage data available
					</div>
				) : (
					<div
						style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
					>
						{items.map((item, i) => {
							const percentage = Math.min((item.used / item.limit) * 100, 100);
							const isNearLimit = percentage >= 80;
							const isOverLimit = percentage >= 100;

							return (
								<div key={i}>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											marginBottom: "0.5rem",
										}}
									>
										<span
											style={{ fontWeight: 500, fontSize: theme.fontSizeSm }}
										>
											{item.service}
										</span>
										<span
											style={{
												fontSize: theme.fontSizeXs,
												color: theme.colorMutedForeground,
											}}
										>
											{item.used.toLocaleString()} /{" "}
											{item.limit.toLocaleString()} {item.unit}
											{item.cost !== undefined &&
												` • ${formatCurrency(item.cost)}`}
										</span>
									</div>
									<div
										style={{
											height: "8px",
											backgroundColor: theme.colorMuted,
											borderRadius: "4px",
											overflow: "hidden",
										}}
									>
										<div
											style={{
												height: "100%",
												width: `${percentage}%`,
												backgroundColor: isOverLimit
													? theme.colorDestructive
													: isNearLimit
														? theme.colorWarning
														: theme.colorPrimary,
												borderRadius: "4px",
												transition: "width 0.3s ease",
											}}
										/>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}

// ============================================
// Icons
// ============================================

function InvoiceIcon({ color, size = 24 }: { color: string; size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
			<line x1="16" y1="13" x2="8" y2="13" />
			<line x1="16" y1="17" x2="8" y2="17" />
			<polyline points="10 9 9 9 8 9" />
		</svg>
	);
}

function DownloadIcon({ color }: { color: string }) {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<polyline points="7 10 12 15 17 10" />
			<line x1="12" y1="15" x2="12" y2="3" />
		</svg>
	);
}

function CreditCardIcon({
	color,
	size = 24,
}: { color: string; size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
			<line x1="1" y1="10" x2="23" y2="10" />
		</svg>
	);
}

function PlusIcon({ color }: { color: string }) {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			style={{ marginRight: "0.25rem" }}
		>
			<line x1="12" y1="5" x2="12" y2="19" />
			<line x1="5" y1="12" x2="19" y2="12" />
		</svg>
	);
}
