/**
 * No-op shim for the `server-only` marker when running the content tool under
 * Bun. The app build (Next.js) keeps its native server-only handling; this
 * mapping applies only to this scripts-local tsconfig.
 */
export {}
