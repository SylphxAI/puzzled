/**
 * Test setup file - mocks packages that throw in test environments
 */
import { mock } from 'bun:test'

// Mock server-only package which throws when imported outside Next.js server context
mock.module('server-only', () => ({}))
