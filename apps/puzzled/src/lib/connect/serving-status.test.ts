import { describe, expect, test } from 'bun:test'
import { ServingStatus } from '../../gen/connect/puzzled/v1/health_pb'
import { isServingOk, servingStatusLabel } from './serving-status'

describe('puzzled Protobuf-ES ServingStatus SSOT', () => {
	test('discriminants', () => {
		expect(ServingStatus.UNSPECIFIED).toBe(0)
		expect(ServingStatus.OK).toBe(1)
		expect(ServingStatus.NOT_READY).toBe(2)
		expect(ServingStatus.UNAVAILABLE).toBe(3)
	})
	test('pure labels', () => {
		expect(servingStatusLabel(ServingStatus.OK)).toBe('OK')
		expect(isServingOk(ServingStatus.OK)).toBe(true)
		expect(isServingOk(ServingStatus.NOT_READY)).toBe(false)
	})
})
