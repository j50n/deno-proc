import { BATCH_SIZE_BYTES } from "./common.ts";
import { LazyRow } from "./lazy_row.ts";

type Row = Record<string, string>;

const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();

export function fromTsvToRows() {
  return async function* (bytes: AsyncIterable<Uint8Array>): AsyncIterable<Row[]> {
    let buffer = "";
    let currentBatch: Row[] = [];
    let currentBatchSize = 0;
    let headers: string[] | null = null;

    for await (const chunk of bytes) {
      buffer += decoder.decode(chunk, { stream: true });
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        const fields = line.split('\t');
        
        if (headers === null) {
          headers = fields;
          continue;
        }
        
        const row: Row = {};
        for (let i = 0; i < headers.length; i++) {
          row[headers[i]] = fields[i] || "";
        }
        
        currentBatch.push(row);
        currentBatchSize += line.length;
        
        if (currentBatchSize >= BATCH_SIZE_BYTES) {
          yield currentBatch;
          currentBatch = [];
          currentBatchSize = 0;
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      const fields = buffer.split('\t');
      if (headers === null) {
        headers = fields;
      } else {
        const row: Row = {};
        for (let i = 0; i < headers.length; i++) {
          row[headers[i]] = fields[i] || "";
        }
        currentBatch.push(row);
      }
    }

    if (currentBatch.length > 0) {
      yield currentBatch;
    }
  };
}

export function fromTsvToLazyRows() {
  return async function* (bytes: AsyncIterable<Uint8Array>): AsyncIterable<LazyRow[]> {
    let buffer = "";
    let currentBatch: LazyRow[] = [];
    let currentBatchSize = 0;

    for await (const chunk of bytes) {
      buffer += decoder.decode(chunk, { stream: true });
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        const fields = line.split('\t');
        const row = LazyRow.fromStringArray(fields);
        
        currentBatch.push(row);
        currentBatchSize += line.length;
        
        if (currentBatchSize >= BATCH_SIZE_BYTES) {
          yield currentBatch;
          currentBatch = [];
          currentBatchSize = 0;
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      const fields = buffer.split('\t');
      const row = LazyRow.fromStringArray(fields);
      currentBatch.push(row);
    }

    if (currentBatch.length > 0) {
      yield currentBatch;
    }
  };
}

export function toTsv() {
  return async function* (data: AsyncIterable<Row[] | LazyRow[]>): AsyncIterable<Uint8Array> {
    for await (const batch of data) {
      if (batch.length === 0) continue;
      
      let lines: string[];
      
      if (batch[0] instanceof LazyRow) {
        const lazyRows = batch as LazyRow[];
        lines = lazyRows.map(row => row.toStringArray().join('\t'));
      } else {
        const rows = batch as Row[];
        lines = rows.map(row => Object.values(row).join('\t'));
      }
      
      const tsv = lines.join('\n') + '\n';
      yield encoder.encode(tsv);
    }
  };
}
