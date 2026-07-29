/**
 * Pure projection of puzzled.v1.ServingStatus (Protobuf SSOT).
 */
import { ServingStatus } from '../../gen/connect/puzzled/v1/health_pb'

export type ServingStatusLabel = 'UNSPECIFIED' | 'OK' | 'NOT_READY' | 'UNAVAILABLE' | 'UNKNOWN'

export function servingStatusLabel(status: ServingStatus | number): ServingStatusLabel {
	switch (status) {
		case ServingStatus.UNSPECIFIED:
			return 'UNSPECIFIED'
		case ServingStatus.OK:
			return 'OK'
		case ServingStatus.NOT_READY:
			return 'NOT_READY'
		case ServingStatus.UNAVAILABLE:
			return 'UNAVAILABLE'
		default:
			return 'UNKNOWN'
	}
}

export function isServingOk(status: ServingStatus | number): boolean {
	return status === ServingStatus.OK
}
