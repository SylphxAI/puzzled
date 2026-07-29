import { describe, expect, test } from 'bun:test'
import {
	buildAnalyticsBeaconPayload,
	enqueueAnalyticsEvent,
	resolveRedirectUrlPure,
	trimTrackedEventIds,
} from '../index'

describe('provider pure helpers', () => {
	test('resolveRedirectUrlPure resolves relative and absolute', () => {
		expect(
			resolveRedirectUrlPure('/dashboard', {
				origin: 'https://app.example',
				href: 'https://app.example/x',
			}),
		).toBe('https://app.example/dashboard')
		expect(
			resolveRedirectUrlPure('https://other.example/cb', {
				origin: 'https://app.example',
				href: 'https://app.example/x',
			}),
		).toBe('https://other.example/cb')
		expect(
			resolveRedirectUrlPure(undefined, {
				origin: 'https://app.example',
				href: 'https://app.example/x',
			}),
		).toBe('https://app.example/x')
	})

	test('enqueueAnalyticsEvent drops oldest past limit', () => {
		const q = enqueueAnalyticsEvent(
			[
				{ id: '1', name: 'a' },
				{ id: '2', name: 'b' },
			],
			{ id: '3', name: 'c' },
			2,
		)
		expect(q.map((e) => e.id)).toEqual(['2', '3'])
	})

	test('trimTrackedEventIds keeps newest', () => {
		expect(trimTrackedEventIds(['a', 'b', 'c', 'd'], 2)).toEqual(['c', 'd'])
	})

	test('buildAnalyticsBeaconPayload serializes appId+events', () => {
		const raw = buildAnalyticsBeaconPayload('app_1', [{ id: 'e1', name: 'page' }])
		expect(JSON.parse(raw)).toEqual({
			appId: 'app_1',
			events: [{ id: 'e1', name: 'page' }],
		})
	})
})

import { capAnalyticsQueue } from "../analytics-queue";

describe("capAnalyticsQueue", () => {
  test("keeps last N", () => {
    expect(capAnalyticsQueue([1, 2, 3, 4], 2)).toEqual([3, 4]);
    expect(capAnalyticsQueue([1], 5)).toEqual([1]);
  });
});
