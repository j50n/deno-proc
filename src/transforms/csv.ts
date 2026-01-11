import { parse, stringify } from "jsr:@std/csv";
import { BATCH_SIZE_BYTES } from "./common.ts";
import { LazyRow } from "./lazy_row.ts";

export interface CsvParseOptions {
  separator?: string;
  comment?: string;
  trimLeadingSpace?: boolean;
  lazyQuotes?: boolean;
  fieldsPerRecord?: number;
}

export interface CsvStringifyOptions {
  separator?: string;
  crlf?: boolean;
  quote?: string;
  quotedFields?: boolean;
}

const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();

export function fromCsvToRows(parseOptions?: CsvParseOptions) {
  return async function* (bytes: AsyncIterable<Uint8Array>): AsyncIterable<string[][]> {
    let buffer = "";
    let currentBatch: string[][] = [];
    let currentBatchSize = 0;

    for await (const chunk of bytes) {
      buffer += decoder.decode(chunk, { stream: true });
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";
      
      if (lines.length > 0) {
        const text = lines.join('\n') + '\n';
        const records = parse(text, { skipFirstRow: false, ...parseOptions });
        
        for (const record of records) {
          currentBatch.push(record);
          currentBatchSize += record.join(',').length;
          
          if (currentBatchSize >= BATCH_SIZE_BYTES) {
            yield currentBatch;
            currentBatch = [];
            currentBatchSize = 0;
          }
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      const records = parse(buffer, { skipFirstRow: false, ...parseOptions });
      currentBatch.push(...records);
    }

    if (currentBatch.length > 0) {
      yield currentBatch;
    }
  };
}

export function fromCsvToLazyRows(parseOptions?: CsvParseOptions) {
  return async function* (bytes: AsyncIterable<Uint8Array>): AsyncIterable<LazyRow[]> {
    let buffer = "";
    let currentBatch: LazyRow[] = [];
    let currentBatchSize = 0;

    for await (const chunk of bytes) {
      buffer += decoder.decode(chunk, { stream: true });
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";
      
      if (lines.length > 0) {
        const text = lines.join('\n') + '\n';
        const records = parse(text, { skipFirstRow: false, ...parseOptions });
        
        for (const record of records) {
          const row = LazyRow.fromStringArray(record);
          currentBatch.push(row);
          currentBatchSize += record.join(',').length;
          
          if (currentBatchSize >= BATCH_SIZE_BYTES) {
            yield currentBatch;
            currentBatch = [];
            currentBatchSize = 0;
          }
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      const records = parse(buffer, { skipFirstRow: false, ...parseOptions });
      for (const record of records) {
        currentBatch.push(LazyRow.fromStringArray(record));
      }
    }

    if (currentBatch.length > 0) {
      yield currentBatch;
    }
  };
}

export function toCsv(stringifyOptions?: CsvStringifyOptions) {
  return async function* (data: AsyncIterable<string[] | string[][] | LazyRow | LazyRow[]>): AsyncIterable<Uint8Array> {
    for await (const item of data) {
      let batch: string[][];
      
      if (Array.isArray(item)) {
        if (item.length > 0 && Array.isArray(item[0])) {
          // string[][]
          batch = item as string[][];
        } else if (item.length > 0 && item[0] instanceof LazyRow) {
          // LazyRow[]
          batch = (item as LazyRow[]).map(row => row.toStringArray());
        } else {
          // string[]
          batch = [item as string[]];
        }
      } else if (item instanceof LazyRow) {
        // Single LazyRow
        batch = [item.toStringArray()];
      } else {
        // Single string[] (shouldn't happen with current types, but safe fallback)
        batch = [item as string[]];
      }
      
      if (batch.length > 0) {
        const csv = stringify(batch, stringifyOptions);
        yield encoder.encode(csv);
      }
    }
  };
}
