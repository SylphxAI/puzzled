import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { useGameAnalytics } from './sdk-analytics'

describe('useGameAnalytics analytics hook', () => {
	test('renders without an SDK provider for dynamic game chunks', () => {
		function Probe() {
			const analytics = useGameAnalytics()
			return React.createElement('output', null, String(Boolean(analytics.trackGameStart)))
		}

		expect(() => renderToString(React.createElement(Probe))).not.toThrow()
	})
})
