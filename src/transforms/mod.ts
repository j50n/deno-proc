/**
 * Data transform functions for format conversion.
 * 
 * @experimental This module is under active development (v0.24.0+).
 * API may change as we improve correctness and streaming performance.
 * Test thoroughly with your data patterns before production use.
 * 
 * @module
 */

// Transform functions for data format conversion
export { LazyRow } from "./lazy-row.ts";
export { BATCH_SIZE_BYTES, RECORD_SEPARATOR, FIELD_SEPARATOR } from "./common.ts";

// CSV transformers
export { 
  fromCsvToRows,
  fromCsvToLazyRows,
  toCsv,
  type CsvParseOptions,
  type CsvStringifyOptions 
} from "./csv.ts";

// High-performance WASM CSV transformers
export {
  fromCsvToRowsFast,
  fromCsvToLazyRowsFast,
  toCsvFast,
  CsvParseError
} from "./csv-fast.ts";

// TSV transformers
export { 
  fromTsvToRows,
  fromTsvToLazyRows,
  toTsv
} from "./tsv.ts";

// Record transformers
export { 
  fromRecordToRows,
  fromRecordToLazyRows,
  toRecord
} from "./record.ts";

// Binary LazyRow transformers
export {
  fromLazyRowBinary,
  toLazyRowBinary
} from "./lazyrow-binary.ts";

// JSON transformers
export { 
  fromJsonToRows,
  toJson,
  type JsonOptions 
} from "./json.ts";
