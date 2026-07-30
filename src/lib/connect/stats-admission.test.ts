import { describe, expect, test } from 'bun:test'
import { shouldUseSdkLeaderboardResidual } from './stats-product-authority'

describe('shouldUseSdkLeaderboardResidual', () => {
  test('allows SDK when admit is null', () => {
    expect(shouldUseSdkLeaderboardResidual(null)).toBe(true)
  })

  test('allows SDK for rest skip', () => {
    expect(
      shouldUseSdkLeaderboardResidual({ mode: 'rest', skipped: true, failClosed: false }),
    ).toBe(true)
  })

  test('blocks SDK when Connect returns entries (sole Connect)', () => {
    expect(
      shouldUseSdkLeaderboardResidual({
        mode: 'connect',
        ok: true,
        failClosed: false,
        response: { entries: [{ rank: 1 }] },
      }),
    ).toBe(false)
  })

  test('allows SDK when Connect empty (admit residual)', () => {
    expect(
      shouldUseSdkLeaderboardResidual({
        mode: 'connect',
        ok: true,
        failClosed: false,
        response: { entries: [] },
      }),
    ).toBe(true)
  })

  test('allows SDK when Connect fails under admit', () => {
    expect(
      shouldUseSdkLeaderboardResidual({
        mode: 'connect',
        ok: false,
        failClosed: false,
      }),
    ).toBe(true)
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