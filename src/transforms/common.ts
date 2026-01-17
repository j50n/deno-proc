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

/**
 * Static buffer for writing 32-bit integers (reused to avoid allocations).
 */
const uint32Buffer = new Uint8Array(4);
const uint32View = new Uint32Array(uint32Buffer.buffer);

/**
 * Write a 32-bit unsigned integer to a static buffer in little-endian format.
 * Returns a slice (copy) of the static buffer containing the 4-byte integer.
 *
 * Note: The returned slice is a copy. The static buffer is reused on next call.
 *
 * @param value The integer value to write (0 to 4294967295)
 * @returns Uint8Array containing the 4-byte little-endian representation
 */
export function writeUint32LE(value: number): Uint8Array {
  uint32View[0] = value;
  return uint32Buffer.slice();
}

/**
 * Convert a single row to record format string.
 * @param row Array of field values
 * @returns Record format string: fields joined by \x1F, terminated by \x1E
 */
export function rowToRecord(row: string[]): string {
  return row.join(FIELD_SEPARATOR) + RECORD_SEPARATOR;
}

/**
 * Convert multiple rows to record format string.
 * @param rows Array of rows (each row is an array of field values)
 * @returns Record format string: all rows concatenated
 */
export function rowsToRecord(rows: string[][]): string {
  return rows.map((row) => row.join(FIELD_SEPARATOR) + RECORD_SEPARATOR).join(
    "",
  );
}
