/**
 * Common constants and utilities for transform functions.
 */

/**
 * Target batch size in bytes for optimal async iteration performance.
 * Balances memory usage with async iteration overhead.
 */
export const BATCH_SIZE_BYTES = 128 * 1024; // 128KB

/**
 * ASCII control characters for Record format.
 */
export const RECORD_SEPARATOR = "\x1E"; // ASCII 30 - separates records
export const FIELD_SEPARATOR = "\x1F"; // ASCII 31 - separates fields
