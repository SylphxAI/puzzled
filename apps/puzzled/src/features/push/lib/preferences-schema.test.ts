import { describe, expect, test } from 'bun:test'
import { create, fromBinary, toBinary, toJson } from '@bufbuild/protobuf'
import {
	GetWebPushConfigRequestSchema,
	GetWebPushConfigResponseSchema,
	PreferencesService,
	RecordSignupAttributionRequestSchema,
	RecordSignupAttributionResponseSchema,
	SaveWebPushSubscriptionRequestSchema,
	SaveWebPushSubscriptionResponseSchema,
	UnsubscribeEmailRequestSchema,
	UnsubscribeEmailResponseSchema,
} from '@/gen/connect/puzzled/v1/preferences_pb'

describe('merged preferences descriptors', () => {
	test('Web Push and existing attribution/unsubscribe schemas keep their message names', () => {
		for (const [schema, name] of [
			[GetWebPushConfigRequestSchema, 'GetWebPushConfigRequest'],
			[GetWebPushConfigResponseSchema, 'GetWebPushConfigResponse'],
			[SaveWebPushSubscriptionRequestSchema, 'SaveWebPushSubscriptionRequest'],
			[SaveWebPushSubscriptionResponseSchema, 'SaveWebPushSubscriptionResponse'],
			[RecordSignupAttributionRequestSchema, 'RecordSignupAttributionRequest'],
			[RecordSignupAttributionResponseSchema, 'RecordSignupAttributionResponse'],
			[UnsubscribeEmailRequestSchema, 'UnsubscribeEmailRequest'],
			[UnsubscribeEmailResponseSchema, 'UnsubscribeEmailResponse'],
		] as const) {
			expect(schema.typeName).toBe(`puzzled.v1.${name}`)
		}
		expect(PreferencesService.method.getWebPushConfig.input).toBe(GetWebPushConfigRequestSchema)
		expect(PreferencesService.method.saveWebPushSubscription.input).toBe(
			SaveWebPushSubscriptionRequestSchema,
		)
	})

	test('populated subscription survives Connect JSON and protobuf binary serialization', () => {
		const payload = {
			endpoint: 'https://fcm.googleapis.com/fcm/send/test-browser',
			p256dh: 'test-public-key',
			auth: 'test-auth-key',
			remove: true,
			locale: 'zh-HK',
		}
		const message = create(SaveWebPushSubscriptionRequestSchema, payload)
		expect(toJson(SaveWebPushSubscriptionRequestSchema, message)).toEqual(payload)
		const roundtrip = fromBinary(
			SaveWebPushSubscriptionRequestSchema,
			toBinary(SaveWebPushSubscriptionRequestSchema, message),
		)
		expect(toJson(SaveWebPushSubscriptionRequestSchema, roundtrip)).toEqual(payload)
	})
})
