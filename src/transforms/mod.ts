/**
 * Data transform functions for format conversion.
 *
 * @experimental This module is under active development (v0.24.0+).
 * API may change as we improve correctness and streaming performance.
 * Test thoroughly with your data patterns before production use.
 *
 * @module
 */

// Core types
export type { Row } from "./types.ts";

// Transform functions for data format conversion
export { LazyRow } from "./lazy-row.ts";
export {
  BATCH_SIZE_BYTES,
  FIELD_SEPARATOR,
  RECORD_SEPARATOR,
} from "./common.ts";

// CSV transformers
export {
  type CsvParseOptions,
  type CsvStringifyOptions,
  fromCsvToLazyRows,
  fromCsvToRows,
  toCsv,
} from "./csv.ts";

// TSV transformers
export { fromTsvToLazyRows, fromTsvToRows, toTsv } from "./tsv.ts";

// Record transformers
export { fromRecordToLazyRows, fromRecordToRows, toRecord } from "./record.ts";

// Binary LazyRow transformers
export { fromLazyRowBinary, toLazyRowBinary } from "./lazyrow-binary.ts";

// JSON transformers
export { fromJsonToRows, type JsonOptions, toJson } from "./json.ts";
