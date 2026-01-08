'use client'

import { Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/shared/components/ui'
import { DeleteAccountModal } from './delete-account-modal'

export function DeleteAccountButton() {
	const t = useTranslations()
	const [isModalOpen, setIsModalOpen] = useState(false)

	return (
		<>
			<Button onClick={() => setIsModalOpen(true)} variant="destructive">
				<Trash2 className="mr-2 h-4 w-4" />
				{t('settings.privacy.deleteAccount.deleteButton')}
			</Button>

			<DeleteAccountModal open={isModalOpen} onClose={() => setIsModalOpen(false)} />
		</>
	)
}
