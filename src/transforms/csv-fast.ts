/**
 * High-performance CSV transforms using WebAssembly.
 * RFC 4180 compliant parser with streaming support.
 * 
 * This module provides transform functions that wrap the FlatdataProcessor
 * for convenient use in data pipelines.
 * 
 * @module
 */

import { LazyRow } from "./lazy-row.ts";
import { FlatdataProcessor } from "../wasm/flatdata-processor.ts";

// Re-export types for API compatibility
export type { CsvParseOptions, CsvStringifyOptions } from "./csv.ts";
import type { CsvParseOptions, CsvStringifyOptions } from "./csv.ts";

/** CSV parse error with position information */
export class CsvParseError extends Error {
  constructor(
    public kind: string,
    public row: number,
    public col: number,
    message?: string,
  ) {
    super(message ?? `CSV parse error: ${kind} at row ${row}, col ${col}`);
    this.name = kind;
  }
}

/**
 * High-performance CSV parsing to string arrays using WASM.
 * RFC 4180 compliant with streaming support.
 */
export function fromCsvToRowsFast(parseOptions?: CsvParseOptions) {
  return async function* (
    bytes: AsyncIterable<Uint8Array>,
  ): AsyncIterable<string[][]> {
    const processor = await FlatdataProcessor.create();
    yield* processor.csvToRowsStreaming(bytes, parseOptions);
  };
}

/**
 * High-performance CSV parsing to LazyRow objects using WASM.
 * RFC 4180 compliant with streaming support.
 */
export function fromCsvToLazyRowsFast(parseOptions?: CsvParseOptions) {
  return async function* (
    bytes: AsyncIterable<Uint8Array>,
  ): AsyncIterable<LazyRow[]> {
    const processor = await FlatdataProcessor.create();
    yield* processor.csvToLazyRowsStreaming(bytes);
  };
}

/**
 * High-performance CSV generation using WASM.
 * RFC 4180 compliant output.
 */
export function toCsvFast(stringifyOptions?: CsvStringifyOptions) {
  return async function* (
    data: AsyncIterable<string[] | string[][] | LazyRow | LazyRow[]>,
  ): AsyncIterable<Uint8Array> {
    const processor = await FlatdataProcessor.create();
    
    async function* toRecordFormat() {
      for await (const item of data) {
        const rows = normalizeRows(item);
        const parts: string[] = [];
        for (const row of rows) {
          parts.push(row.join(String.fromCharCode(0x1F)));
          parts.push(String.fromCharCode(0x1E));
        }
        yield new TextEncoder().encode(parts.join(""));
      }
    }
    
    const separator = stringifyOptions?.separator?.charCodeAt(0) ?? 44;
    yield* processor.recordToCsvStreaming(toRecordFormat(), separator, false);
  };
}

function normalizeRows(
  item: string[] | string[][] | LazyRow | LazyRow[],
): string[][] {
  if (item instanceof LazyRow) {
    return [item.toStringArray()];
  }
  if (Array.isArray(item) && item.length > 0) {
    if (item[0] instanceof LazyRow) {
      return (item as LazyRow[]).map((r) => r.toStringArray());
    }
    if (Array.isArray(item[0])) {
      return item as string[][];
    }
    return [item as string[]];
  }
  return [];
}
