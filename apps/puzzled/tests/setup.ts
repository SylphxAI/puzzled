/**
 * Test Setup
 *
 * Preloaded before running tests to mock server-only module.
 * This allows testing server components/functions that import 'server-only'.
 */

import { mock } from "bun:test";

// Mock server-only to allow testing server code
mock.module("server-only", () => ({}));
