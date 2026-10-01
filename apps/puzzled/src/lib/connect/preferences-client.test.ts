import { expect, test } from 'bun:test'
import { create, fromBinary, toBinary } from '@bufbuild/protobuf'
import { DeleteAccountDataResponseSchema } from '@/gen/connect/puzzled/v1/preferences_pb'
import { deleteAccountData, type PreferencesServiceClient } from './preferences-client'

function client(state: string, requestId: string): PreferencesServiceClient {
	return {
		deleteAccountData: async () => create(DeleteAccountDataResponseSchema, { state, requestId }),
	} as unknown as PreferencesServiceClient
}

test('pending acceptance preserves the operation reference and does not assert completion', async () => {
	const result = await deleteAccountData(client('pending', 'operation-fixture'))
	expect(result).toEqual({
		requestId: 'operation-fixture',
		state: 'pending',
		rowsDeleted: BigInt(0),
	})
})

test('missing or unknown operation receipts are not treated as successful erasure', async () => {
	await expect(deleteAccountData(client('', ''))).rejects.toThrow('invalid_erasure_receipt')
	await expect(deleteAccountData(client('accepted', 'operation-fixture'))).rejects.toThrow(
		'invalid_erasure_receipt',
	)
})

test('additive operation state and ID survive protobuf serialization', () => {
	const message = create(DeleteAccountDataResponseSchema, {
		state: 'completed',
		requestId: 'operation-fixture',
		rowsDeleted: BigInt(17),
	})
	const response = fromBinary(
		DeleteAccountDataResponseSchema,
		toBinary(DeleteAccountDataResponseSchema, message),
	)
	expect(response.state).toBe('completed')
	expect(response.requestId).toBe('operation-fixture')
	expect(response.rowsDeleted).toBe(BigInt(17))
})
