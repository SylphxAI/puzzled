import { describe, expect, test } from 'bun:test'
import { NextIntlClientProvider } from 'next-intl'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import common from '@/messages/en-US/common.json'
import { AccountId } from './account-id'

const render = (id: string) =>
	renderToStaticMarkup(
		createElement(NextIntlClientProvider, {
			locale: 'en-US',
			messages: { common },
			// biome-ignore lint/correctness/noChildrenProp: the provider requires children in its typed props.
			children: createElement(AccountId, {
				id,
				label: 'Account ID',
				hint: 'Quote this to support.',
				copyLabel: 'Copy ID',
				copiedLabel: 'Copied',
			}),
		}),
	)

describe('AccountId', () => {
	test('shows the exact subject string with its label and a copy button', () => {
		const html = render('principal-0199aa10-7b2c-7d3e-8f00-1234567890ab')
		expect(html).toContain('Account ID')
		expect(html).toContain('>principal-0199aa10-7b2c-7d3e-8f00-1234567890ab</code>')
		expect(html).toContain('Copy')
		expect(html).toContain('Quote this to support.')
	})

	test('escapes the id, so it can only ever render as text', () => {
		const html = render('<img src=x onerror=alert(1)>')
		expect(html).not.toContain('<img')
	})
})
