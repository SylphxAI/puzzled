import { describe, expect, test } from 'bun:test'
import { shouldUseSdkLeaderboardResidual } from './stats-product-authority'

describe('shouldUseSdkLeaderboardResidual', () => {
  test('blocks SDK when admit is null (connect default fail-closed)', () => {
    expect(shouldUseSdkLeaderboardResidual(null)).toBe(false)
  })

  test('allows SDK for rest skip only', () => {
    expect(
      shouldUseSdkLeaderboardResidual({ mode: 'rest', skipped: true, failClosed: false }),
    ).toBe(true)
  })

  test('blocks SDK when Connect returns entries (sole Connect)', () => {
    expect(
      shouldUseSdkLeaderboardResidual({
        mode: 'connect',
        ok: true,
        failClosed: true,
        response: { entries: [{ rank: 1 }] },
      }),
    ).toBe(false)
  })

  test('blocks SDK when Connect empty under connect (fail-closed)', () => {
    expect(
      shouldUseSdkLeaderboardResidual({
        mode: 'connect',
        ok: true,
        failClosed: true,
        response: { entries: [] },
      }),
    ).toBe(false)
  })

  test('blocks SDK when Connect fails under connect (fail-closed)', () => {
    expect(
      shouldUseSdkLeaderboardResidual({
        mode: 'connect',
        ok: false,
        failClosed: true,
      }),
    ).toBe(false)
  })

  test('blocks SDK under connect_required fail-closed', () => {
    expect(
      shouldUseSdkLeaderboardResidual({
        mode: 'connect_required',
        ok: false,
        failClosed: true,
      }),
    ).toBe(false)
    expect(
      shouldUseSdkLeaderboardResidual({
        mode: 'connect_required',
        ok: true,
        failClosed: true,
        response: { entries: [] },
      }),
    ).toBe(false)
  })
})
