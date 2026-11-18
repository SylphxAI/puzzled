import { installBrowserErrorCapture, noteRouterTransition } from './lib/observability/browser'

installBrowserErrorCapture()

export const onRouterTransitionStart = noteRouterTransition
