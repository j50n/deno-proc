/**
 * Type definitions for flatdata WASM module.
 * @module
 */

/** Field separator byte for record format (\x1F - Unit Separator) */
export const FIELD_SEP = 0x1F;

/** Record separator byte for record format (\x1E - Record Separator) */
export const RECORD_SEP = 0x1E;

/**
 * Writer function type for streaming output.
 * @param data - Chunk of data to write
 * @returns Promise resolving to number of bytes written
 */
export type Writer = (data: Uint8Array) => Promise<number>;

/**
 * WebAssembly exports from the flatdata module.
 * Provides low-level operations for CSV/TSV/record format conversions.
 */
export interface WasmExports {
  memory: WebAssembly.Memory;

  /** Allocate input buffer */
  alloc_input_buffer: (size: number) => number;

  /** Allocate output buffer */
  alloc_output_buffer: (size: number) => number;

  /** Free a buffer */
  free_buffer: (ptr: number) => void;

  /** Get input buffer pointer */
  get_input_ptr: () => number;

  /** Get output buffer pointer */
  get_output_ptr: () => number;

  /** Create a direct parser (CSV/TSV → record format) */
  create_direct_parser: (
    inSep: number,
    outFieldSep: number,
    outRecordSep: number,
    strict: number,
    expectedFields: number,
  ) => number;

  /** Destroy a direct parser */
  destroy_direct_parser: (id: number) => void;

  /** Parse chunk with direct parser */
  parse_direct: (id: number, len: number) => bigint;

  /** Finish parsing and flush remaining data */
  finish_direct: (id: number) => bigint;

  /** Get direct parser output length */
  get_direct_output: (id: number) => number;

  /** Clear direct parser output buffer */
  clear_direct_output: (id: number) => void;

  /** Get parse error info (row and column) */
  get_direct_error: (id: number) => bigint;

  /** Create a lazyrow parser (CSV/TSV → binary lazyrow) */
  create_lazyrow_parser: (
    fieldSep: number,
    recordSep: number,
    strict: number,
    expectedFields: number,
  ) => number;

  /** Destroy a lazyrow parser */
  destroy_lazyrow_parser: (id: number) => void;

  /** Parse chunk with lazyrow parser */
  parse_lazyrow: (id: number, len: number) => bigint;

  /** Finish lazyrow parsing and flush remaining data */
  finish_lazyrow: (id: number) => bigint;

  /** Get lazyrow parser output length */
  get_lazyrow_output: (id: number) => number;

  /** Clear lazyrow parser output buffer */
  clear_lazyrow_output: (id: number) => void;

  /** Get lazyrow parse error info */
  get_lazyrow_error: (id: number) => bigint;

  /** Create a direct lazyrow parser (CSV/TSV → binary lazyrow, single pass) */
  create_lazyrow_direct: (
    fieldSep: number,
    recordSep: number,
  ) => number;

  /** Destroy a direct lazyrow parser */
  destroy_lazyrow_direct: (id: number) => void;

  /** Parse chunk with direct lazyrow parser */
  parse_lazyrow_direct: (id: number, len: number) => number;

  /** Finish direct lazyrow parsing */
  finish_lazyrow_direct: (id: number) => number;

  /** Get direct lazyrow output length */
  get_lazyrow_direct_output: (id: number) => number;

  /** Clear direct lazyrow output buffer */
  clear_lazyrow_direct_output: (id: number) => void;

  /** Create a delimited stringifier (record → CSV/TSV) */
  create_delimited_stringifier: (
    sep: number,
    crlf: number,
    alwaysQuote: number,
    expectedFields: number,
  ) => number;

  /** Destroy a delimited stringifier instance */
  destroy_delimited_stringifier: (id: number) => void;

  /** Stringify record format to CSV */
  stringify_delimited: (id: number, len: number) => void;

  /** Get stringifier output length */
  get_stringify_output: (id: number) => number;

  /** Clear stringifier output buffer */
  clear_stringify_output: (id: number) => void;

  /** Create a delimited parser instance (for streaming) */
  create_delimited_parser: (
    sep: number,
    strict: number,
    expectedFields: number,
  ) => number;

  /** Destroy a delimited parser instance */
  destroy_delimited_parser: (id: number) => void;

  /** Parse a chunk with delimited parser */
  parse_delimited: (id: number, len: number) => bigint;

  /** Finish parsing and flush remaining data */
  finish_delimited: (id: number) => bigint;

  /** Get delimited parser output length */
  get_delimited_output: (id: number) => number;

  /** Clear delimited parser output buffer */
  clear_delimited_output: (id: number) => void;

  /** Get delimited parse error info */
  get_delimited_error: (id: number) => bigint;

  /** Parse lazyrow binary directly (no CSV parsing) */
  parse_lazyrow_binary: (len: number) => number;

  /** Finish parsing and flush remaining lazyrow data */
  finish_lazyrow_direct: (id: number) => number;

  /** Encode record format directly to lazyrow binary */
  record_to_lazyrow: (len: number) => number;

  /** Check if last operation was truncated due to buffer size */
  was_truncated: () => number;

  /** Create a streaming lazyrow decoder */
  create_streaming_lazyrow_decoder: (
    fieldSep: number,
    recordSep: number,
  ) => number;

  /** Destroy a streaming lazyrow decoder */
  destroy_streaming_lazyrow_decoder: (id: number) => void;

  /** Decode chunk of lazyrow data. Returns 1 if output ready, 0 otherwise */
  streaming_lazyrow_decode: (id: number, len: number) => number;

  /** Get streaming decoder output */
  get_streaming_lazyrow_output: (id: number) => number;

  /** Clear streaming decoder output buffer */
  clear_streaming_lazyrow_output: (id: number) => void;

  /** Finish streaming decode and flush remaining data */
  finish_streaming_lazyrow: (id: number) => number;

  /** Create a streaming record stringifier */
  create_streaming_record_stringifier: (
    outSep: number,
    fieldSep: number,
    recordSep: number,
    crlf: number,
    alwaysQuote: number,
  ) => number;

  /** Destroy a streaming record stringifier */
  destroy_streaming_record_stringifier: (id: number) => void;

  /** Stringify chunk of record data. Returns 1 if output ready, 0 otherwise */
  streaming_record_stringify: (id: number, len: number) => number;

  /** Get streaming stringifier output */
  get_streaming_record_output: (id: number) => number;

  /** Clear streaming stringifier output buffer */
  clear_streaming_record_output: (id: number) => void;
}
