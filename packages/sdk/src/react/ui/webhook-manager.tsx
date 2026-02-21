/**
 * Webhook Manager Components
 *
 * Create, manage, and test webhooks.
 */

"use client";

import { type CSSProperties, type FormEvent, useEffect, useState } from "react";
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

export interface Webhook {
	id: string;
	url: string;
	events: string[];
	secret?: string;
	enabled: boolean;
	createdAt: string;
	lastTriggeredAt?: string;
	failureCount?: number;
}

export interface WebhookDelivery {
	id: string;
	webhookId: string;
	event: string;
	status: "success" | "failed" | "pending";
	statusCode?: number;
	timestamp: string;
	payload?: Record<string, unknown>;
	response?: string;
	duration?: number;
}

// ============================================
// WebhookManager
// ============================================

export interface WebhookManagerProps {
	/** Theme variables */
	theme?: ThemeVariables;
	/** Custom class name */
	className?: string;
	/** Webhooks to display */
	webhooks?: Webhook[];
	/** Available events */
	availableEvents?: string[];
	/** Called when webhook is created */
	onCreate?: (data: { url: string; events: string[] }) => Promise<Webhook>;
	/** Called when webhook is deleted */
	onDelete?: (webhookId: string) => Promise<void>;
	/** Called when webhook is toggled */
	onToggle?: (webhookId: string, enabled: boolean) => Promise<void>;
	/** Called when webhook is tested */
	onTest?: (webhookId: string) => Promise<void>;
	/** Whether loading */
	isLoading?: boolean;
	/** Empty state message */
	emptyMessage?: string;
}

const DEFAULT_EVENTS = [
	"user.created",
	"user.updated",
	"user.deleted",
	"subscription.created",
	"subscription.updated",
	"subscription.cancelled",
	"payment.succeeded",
	"payment.failed",
	"invoice.created",
	"invoice.paid",
];

/**
 * Webhook management UI
 *
 * @example
 * ```tsx
 * <WebhookManager
 *   webhooks={webhooks}
 *   onCreate={async (data) => createWebhook(data)}
 *   onDelete={async (id) => deleteWebhook(id)}
 *   onTest={async (id) => testWebhook(id)}
 * />
 * ```
 */
export function WebhookManager({
	theme = defaultTheme,
	className,
	webhooks = [],
	availableEvents = DEFAULT_EVENTS,
	onCreate,
	onDelete,
	onToggle,
	onTest,
	isLoading = false,
	emptyMessage = "No webhooks configured",
}: WebhookManagerProps) {
	const [showCreate, setShowCreate] = useState(false);
	const [url, setUrl] = useState("");
	const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
	const [isCreating, setIsCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [testingId, setTestingId] = useState<string | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const styles = baseStyles(theme);

	useEffect(() => {
		injectGlobalStyles();
	}, []);

	const handleCreate = async (e: FormEvent) => {
		e.preventDefault();
		if (!onCreate || !url || selectedEvents.length === 0) return;

		setIsCreating(true);
		setError(null);

		try {
			await onCreate({ url, events: selectedEvents });
			setShowCreate(false);
			setUrl("");
			setSelectedEvents([]);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create webhook");
		} finally {
			setIsCreating(false);
		}
	};

	const handleDelete = async (webhookId: string) => {
		if (!onDelete) return;
		setDeletingId(webhookId);
		try {
			await onDelete(webhookId);
		} finally {
			setDeletingId(null);
		}
	};

	const handleTest = async (webhookId: string) => {
		if (!onTest) return;
		setTestingId(webhookId);
		try {
			await onTest(webhookId);
		} finally {
			setTestingId(null);
		}
	};

	const toggleEvent = (event: string) => {
		setSelectedEvents((prev) =>
			prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
		);
	};

	const containerStyle: CSSProperties = {
		fontFamily: theme.fontFamily,
	};

	const webhookCardStyle: CSSProperties = {
		padding: "1rem",
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadius,
		marginBottom: "0.75rem",
	};

	const inputStyle: CSSProperties = {
		width: "100%",
		padding: "0.75rem",
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadius,
		backgroundColor: theme.colorBackground,
		color: theme.colorForeground,
		fontSize: theme.fontSizeSm,
		fontFamily: theme.fontFamily,
	};

	return (
		<div style={containerStyle} className={className}>
			{/* Header */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: "1.5rem",
				}}
			>
				<div>
					<h3
						style={{ margin: 0, fontSize: theme.fontSizeLg, fontWeight: 600 }}
					>
						Webhooks
					</h3>
					<p
						style={{
							margin: "0.25rem 0 0",
							fontSize: theme.fontSizeXs,
							color: theme.colorMutedForeground,
						}}
					>
						Receive HTTP callbacks when events occur
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					style={mergeStyles(styles.button, styles.buttonPrimary)}
				>
					<PlusIcon color={theme.colorPrimaryForeground} /> Add Webhook
				</button>
			</div>

			{/* Create Form */}
			{showCreate && (
				<div
					style={{
						...webhookCardStyle,
						backgroundColor: theme.colorMuted,
						marginBottom: "1.5rem",
					}}
				>
					<h4
						style={{
							margin: "0 0 1rem",
							fontSize: theme.fontSizeSm,
							fontWeight: 600,
						}}
					>
						New Webhook
					</h4>

					{error && (
						<div
							style={mergeStyles(styles.alert, styles.alertError, {
								marginBottom: "1rem",
							})}
						>
							{error}
						</div>
					)}

					<form onSubmit={handleCreate}>
						<div style={{ marginBottom: "1rem" }}>
							<label
								style={{
									display: "block",
									marginBottom: "0.5rem",
									fontWeight: 500,
									fontSize: theme.fontSizeSm,
								}}
							>
								Endpoint URL *
							</label>
							<input
								type="url"
								value={url}
								onChange={(e) => setUrl(e.target.value)}
								style={inputStyle}
								placeholder="https://api.example.com/webhooks"
								required
							/>
						</div>

						<div style={{ marginBottom: "1.5rem" }}>
							<label
								style={{
									display: "block",
									marginBottom: "0.5rem",
									fontWeight: 500,
									fontSize: theme.fontSizeSm,
								}}
							>
								Events to listen for *
							</label>
							<div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
								{availableEvents.map((event) => (
									<button
										key={event}
										type="button"
										onClick={() => toggleEvent(event)}
										style={{
											padding: "0.375rem 0.75rem",
											fontSize: theme.fontSizeXs,
											border: `1px solid ${selectedEvents.includes(event) ? theme.colorPrimary : theme.colorBorder}`,
											borderRadius: theme.borderRadiusSm,
											backgroundColor: selectedEvents.includes(event)
												? `${theme.colorPrimary}10`
												: "transparent",
											color: selectedEvents.includes(event)
												? theme.colorPrimary
												: theme.colorForeground,
											cursor: "pointer",
										}}
									>
										{event}
									</button>
								))}
							</div>
						</div>

						<div style={{ display: "flex", gap: "0.75rem" }}>
							<button
								type="button"
								onClick={() => {
									setShowCreate(false);
									setUrl("");
									setSelectedEvents([]);
									setError(null);
								}}
								style={mergeStyles(styles.button, styles.buttonOutline)}
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={isCreating || !url || selectedEvents.length === 0}
								style={mergeStyles(styles.button, styles.buttonPrimary)}
							>
								{isCreating ? (
									<span style={styles.spinner} />
								) : (
									"Create Webhook"
								)}
							</button>
						</div>
					</form>
				</div>
			)}

			{/* Webhook List */}
			{isLoading ? (
				<div style={{ padding: "2rem", textAlign: "center" }}>
					<span style={styles.spinner} />
				</div>
			) : webhooks.length === 0 ? (
				<div
					style={{
						padding: "3rem",
						textAlign: "center",
						color: theme.colorMutedForeground,
						border: `1px solid ${theme.colorBorder}`,
						borderRadius: theme.borderRadius,
					}}
				>
					<WebhookIcon color={theme.colorMuted} size={48} />
					<p style={{ margin: "1rem 0 0" }}>{emptyMessage}</p>
				</div>
			) : (
				webhooks.map((webhook) => (
					<div key={webhook.id} style={webhookCardStyle}>
						<div
							style={{
								display: "flex",
								alignItems: "flex-start",
								justifyContent: "space-between",
							}}
						>
							<div style={{ flex: 1, minWidth: 0 }}>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: "0.5rem",
										marginBottom: "0.5rem",
									}}
								>
									<span
										style={{
											width: 8,
											height: 8,
											borderRadius: "50%",
											backgroundColor: webhook.enabled
												? theme.colorSuccess
												: theme.colorMutedForeground,
										}}
									/>
									<span
										style={{
											fontFamily: "monospace",
											fontSize: theme.fontSizeSm,
											fontWeight: 500,
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
										}}
									>
										{webhook.url}
									</span>
								</div>
								<div
									style={{
										display: "flex",
										flexWrap: "wrap",
										gap: "0.25rem",
										marginBottom: "0.5rem",
									}}
								>
									{webhook.events.map((event) => (
										<span
											key={event}
											style={{
												padding: "0.125rem 0.375rem",
												fontSize: "0.625rem",
												backgroundColor: theme.colorMuted,
												borderRadius: theme.borderRadiusSm,
												color: theme.colorMutedForeground,
											}}
										>
											{event}
										</span>
									))}
								</div>
								<div
									style={{
										fontSize: theme.fontSizeXs,
										color: theme.colorMutedForeground,
									}}
								>
									Created {new Date(webhook.createdAt).toLocaleDateString()}
									{webhook.lastTriggeredAt &&
										` • Last triggered ${new Date(webhook.lastTriggeredAt).toLocaleString()}`}
									{webhook.failureCount !== undefined &&
										webhook.failureCount > 0 && (
											<span style={{ color: theme.colorDestructive }}>
												{" "}
												• {webhook.failureCount} failures
											</span>
										)}
								</div>
							</div>
							<div
								style={{ display: "flex", gap: "0.5rem", marginLeft: "1rem" }}
							>
								{onToggle && (
									<button
										type="button"
										onClick={() => onToggle(webhook.id, !webhook.enabled)}
										style={mergeStyles(styles.button, styles.buttonOutline, {
											padding: "0.25rem 0.5rem",
											fontSize: theme.fontSizeXs,
										})}
									>
										{webhook.enabled ? "Disable" : "Enable"}
									</button>
								)}
								{onTest && (
									<button
										type="button"
										onClick={() => handleTest(webhook.id)}
										disabled={testingId === webhook.id}
										style={mergeStyles(styles.button, styles.buttonOutline, {
											padding: "0.25rem 0.5rem",
											fontSize: theme.fontSizeXs,
										})}
									>
										{testingId === webhook.id ? (
											<span style={styles.spinner} />
										) : (
											"Test"
										)}
									</button>
								)}
								{onDelete && (
									<button
										type="button"
										onClick={() => handleDelete(webhook.id)}
										disabled={deletingId === webhook.id}
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
										{deletingId === webhook.id ? (
											<span style={styles.spinner} />
										) : (
											"Delete"
										)}
									</button>
								)}
							</div>
						</div>
					</div>
				))
			)}
		</div>
	);
}

// ============================================
// WebhookDeliveryLog
// ============================================

export interface WebhookDeliveryLogProps {
	/** Theme variables */
	theme?: ThemeVariables;
	/** Custom class name */
	className?: string;
	/** Deliveries to display */
	deliveries?: WebhookDelivery[];
	/** Whether loading */
	isLoading?: boolean;
	/** Title */
	title?: string;
	/** Empty state message */
	emptyMessage?: string;
	/** Max deliveries to show */
	maxDeliveries?: number;
}

/**
 * Webhook delivery history log
 *
 * @example
 * ```tsx
 * <WebhookDeliveryLog
 *   deliveries={deliveries}
 *   title="Recent Deliveries"
 * />
 * ```
 */
export function WebhookDeliveryLog({
	theme = defaultTheme,
	className,
	deliveries = [],
	isLoading = false,
	title = "Delivery Log",
	emptyMessage = "No deliveries yet",
	maxDeliveries = 50,
}: WebhookDeliveryLogProps) {
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const styles = baseStyles(theme);

	useEffect(() => {
		injectGlobalStyles();
	}, []);

	const displayedDeliveries = deliveries.slice(0, maxDeliveries);

	const statusColors: Record<
		WebhookDelivery["status"],
		{ bg: string; text: string }
	> = {
		success: { bg: `${theme.colorSuccess}20`, text: theme.colorSuccess },
		failed: { bg: `${theme.colorDestructive}20`, text: theme.colorDestructive },
		pending: { bg: `${theme.colorWarning}20`, text: theme.colorWarning },
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
					padding: "1rem",
					backgroundColor: theme.colorMuted,
					borderBottom: `1px solid ${theme.colorBorder}`,
				}}
			>
				<h3 style={{ margin: 0, fontSize: theme.fontSizeLg, fontWeight: 600 }}>
					{title}
				</h3>
			</div>

			<div style={{ maxHeight: "400px", overflowY: "auto" }}>
				{isLoading ? (
					<div style={{ padding: "2rem", textAlign: "center" }}>
						<span style={styles.spinner} />
					</div>
				) : displayedDeliveries.length === 0 ? (
					<div
						style={{
							padding: "3rem",
							textAlign: "center",
							color: theme.colorMutedForeground,
						}}
					>
						{emptyMessage}
					</div>
				) : (
					displayedDeliveries.map((delivery, i) => (
						<div
							key={delivery.id}
							style={{
								padding: "0.75rem 1rem",
								borderBottom:
									i === displayedDeliveries.length - 1
										? "none"
										: `1px solid ${theme.colorBorder}`,
								cursor: "pointer",
							}}
							onClick={() =>
								setExpandedId(expandedId === delivery.id ? null : delivery.id)
							}
						>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
								}}
							>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: "0.75rem",
									}}
								>
									<span
										style={{
											padding: "0.125rem 0.375rem",
											fontSize: theme.fontSizeXs,
											borderRadius: theme.borderRadiusSm,
											backgroundColor: statusColors[delivery.status].bg,
											color: statusColors[delivery.status].text,
											textTransform: "capitalize",
										}}
									>
										{delivery.status}
									</span>
									<span style={{ fontWeight: 500, fontSize: theme.fontSizeSm }}>
										{delivery.event}
									</span>
									{delivery.statusCode && (
										<span
											style={{
												fontSize: theme.fontSizeXs,
												color: theme.colorMutedForeground,
											}}
										>
											HTTP {delivery.statusCode}
										</span>
									)}
								</div>
								<div
									style={{
										fontSize: theme.fontSizeXs,
										color: theme.colorMutedForeground,
									}}
								>
									{new Date(delivery.timestamp).toLocaleString()}
									{delivery.duration && ` • ${delivery.duration}ms`}
								</div>
							</div>

							{expandedId === delivery.id && (
								<div
									style={{
										marginTop: "0.75rem",
										padding: "0.75rem",
										backgroundColor: theme.colorMuted,
										borderRadius: theme.borderRadiusSm,
									}}
								>
									{delivery.payload && (
										<div style={{ marginBottom: "0.75rem" }}>
											<div
												style={{
													fontSize: theme.fontSizeXs,
													fontWeight: 500,
													marginBottom: "0.25rem",
												}}
											>
												Payload
											</div>
											<pre
												style={{
													margin: 0,
													fontSize: "0.625rem",
													fontFamily: "monospace",
													whiteSpace: "pre-wrap",
												}}
											>
												{JSON.stringify(delivery.payload, null, 2)}
											</pre>
										</div>
									)}
									{delivery.response && (
										<div>
											<div
												style={{
													fontSize: theme.fontSizeXs,
													fontWeight: 500,
													marginBottom: "0.25rem",
												}}
											>
												Response
											</div>
											<pre
												style={{
													margin: 0,
													fontSize: "0.625rem",
													fontFamily: "monospace",
													whiteSpace: "pre-wrap",
												}}
											>
												{delivery.response}
											</pre>
										</div>
									)}
								</div>
							)}
						</div>
					))
				)}
			</div>
		</div>
	);
}

// ============================================
// Icons
// ============================================

function WebhookIcon({ color, size = 24 }: { color: string; size?: number }) {
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
			<path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2" />
			<path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06" />
			<path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8" />
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
