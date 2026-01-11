import { parse, stringify } from "jsr:@std/csv";
import { BATCH_SIZE_BYTES } from "./common.ts";

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

export function createCsvTransformers(
  parseOptions?: CsvParseOptions,
  stringifyOptions?: CsvStringifyOptions
) {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const encoder = new TextEncoder();

  async function* fromCsvBytes(bytes: AsyncIterable<Uint8Array>): AsyncIterable<string[][]> {
    let buffer = "";
    let currentBatch: string[][] = [];
    let currentBatchSize = 0;

    for await (const chunk of bytes) {
      buffer += decoder.decode(chunk, { stream: true });
      
      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ""; // Keep incomplete line
      
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

    // Process remaining buffer
    buffer += decoder.decode(); // Final decode
    if (buffer.trim()) {
      const records = parse(buffer, { skipFirstRow: false, ...parseOptions });
      currentBatch.push(...records);
    }

    if (currentBatch.length > 0) {
      yield currentBatch;
    }
  }

  async function* toCsvBytes(data: AsyncIterable<string[][]>): AsyncIterable<Uint8Array> {
    for await (const batch of data) {
      if (batch.length > 0) {
        const csv = stringify(batch, stringifyOptions);
        yield encoder.encode(csv);
      }
    }
  }

  return { fromCsvBytes, toCsvBytes };
}
