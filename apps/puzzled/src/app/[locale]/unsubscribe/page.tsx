import { Button, GamepadIcon } from '@sylphx/ui'
import { Mail } from 'lucide-react'
import { Link } from '@/lib/i18n/routing'

/**
 * Email preference landing page.
 *
 * Marketing unsubscribe writes are owned by the Platform delivery plane. The
 * Puzzled presentation does not accept tokens or expose a local API writer.
 */
export default function UnsubscribePage() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center px-4">
			<div className="w-full max-w-sm space-y-6 text-center">
				<div>
					<h1 className="mb-2 flex items-center justify-center gap-2 text-2xl font-bold">
						<GamepadIcon size={28} className="text-primary" />
						Puzzled
					</h1>
				</div>

				<div className="space-y-4">
					<Mail className="mx-auto h-12 w-12 text-primary" />
					<div>
						<h2 className="text-xl font-semibold">Email Preferences</h2>
						<p className="text-muted-foreground">
							Marketing email opt-outs are handled by the Platform email service. To change your
							Puzzled preferences, open your account settings.
						</p>
					</div>
					<div className="space-y-2">
						<Button asChild className="w-full">
							<Link href="/settings">Manage Email Preferences</Link>
						</Button>
						<Button asChild variant="outline" className="w-full">
							<Link href="/">Return to Puzzled</Link>
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}
