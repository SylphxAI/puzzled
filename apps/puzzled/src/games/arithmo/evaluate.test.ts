import { describe, expect, test } from 'bun:test'
import { evaluateExpression, isValidEquation } from './types'

describe('arithmo equation check without eval', () => {
	test('accepts true equations', () => {
		for (const eq of ['12+13=25', '45-12=33', '2*3*4=24', '10+20=30', '12+34=46', '80-40=40']) {
			expect(isValidEquation(eq)).toBe(true)
		}
	})

	test('rejects false, malformed and wrong-length equations', () => {
		for (const eq of ['12+34=99', '1+2=3', 'notanequ', 'abc=xyzz', '12+13+25', '1+2=3=3=']) {
			expect(isValidEquation(eq)).toBe(false)
		}
	})

	test('precedence and real division', () => {
		expect(evaluateExpression('2+3*4')).toBe(14)
		expect(evaluateExpression('20-6/3')).toBe(18)
		expect(evaluateExpression('7/2')).toBe(3.5)
		expect(evaluateExpression('8-3-2')).toBe(3)
		expect(evaluateExpression('8/4/2')).toBe(1)
		expect(isValidEquation('3*5=30/2')).toBe(true)
		expect(isValidEquation('1/4=5/20')).toBe(true)
	})

	test('rejects division by zero, leading zeros and dangling operators', () => {
		for (const e of [
			'5/0',
			'5/00',
			'5/0+1',
			'05+1',
			'1+',
			'+1',
			'1++1',
			'1+-1',
			'2**3',
			'4//2',
			'',
		]) {
			expect(evaluateExpression(e)).toBeNull()
		}
	})

	test('rejects characters outside digits and operators', () => {
		for (const e of ['1+(2)', '1 +2', 'a+1', '1e3']) {
			expect(evaluateExpression(e)).toBeNull()
		}
	})
})
