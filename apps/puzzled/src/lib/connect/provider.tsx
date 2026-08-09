'use client'

import { TransportProvider } from '@connectrpc/connect-query'
import type { ReactNode } from 'react'
import { getConnectTransport } from './transport'

export function ConnectTransportProvider({
	children,
	baseUrl,
}: {
	children: ReactNode
	baseUrl?: string
}) {
	return <TransportProvider transport={getConnectTransport(baseUrl)}>{children}</TransportProvider>
}
