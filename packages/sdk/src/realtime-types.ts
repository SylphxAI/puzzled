/**
 * Shared Realtime Types
 *
 * Single source of truth for types used by both:
 * - Server: streams.ts (createStreams)
 * - React: use-realtime.ts (useRealtime hook)
 */

/** A message from a stream */
export interface StreamMessage<T = unknown> {
	/** Stream entry ID (e.g., "1234567890-0") */
	id: string;
	/** Event type */
	event: string;
	/** Channel the message was sent to */
	channel: string;
	/** Event data */
	data: T;
	/** Unix timestamp in milliseconds */
	timestamp?: number;
}
