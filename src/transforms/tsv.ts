import { BATCH_SIZE_BYTES } from "./common.ts";
import { BinaryRow } from "./binary_row.ts";

type RowData = Record<string, string>;

const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();

export async function* fromTsvBytes(bytes: AsyncIterable<Uint8Array>): AsyncIterable<RowData[]> {
  let buffer = "";
  let currentBatch: RowData[] = [];
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
      
      const row: RowData = {};
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
      const row: RowData = {};
      for (let i = 0; i < headers.length; i++) {
        row[headers[i]] = fields[i] || "";
      }
      currentBatch.push(row);
    }
  }

  if (currentBatch.length > 0) {
    yield currentBatch;
  }
}

export async function* fromTsvBytesToBinaryRow(bytes: AsyncIterable<Uint8Array>): AsyncIterable<BinaryRow[]> {
  let buffer = "";
  let currentBatch: BinaryRow[] = [];
  let currentBatchSize = 0;

  for await (const chunk of bytes) {
    buffer += decoder.decode(chunk, { stream: true });
    
    const lines = buffer.split('\n');
    buffer = lines.pop() || "";
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const fields = line.split('\t');
      const row = BinaryRow.fromStringArray(fields);
      
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
    const row = BinaryRow.fromStringArray(fields);
    currentBatch.push(row);
  }

  if (currentBatch.length > 0) {
    yield currentBatch;
  }
}

export async function* toTsvBytes(data: AsyncIterable<RowData[] | BinaryRow[]>): AsyncIterable<Uint8Array> {
  for await (const batch of data) {
    if (batch.length === 0) continue;
    
    let lines: string[];
    
    if (batch[0] instanceof BinaryRow) {
      const binaryRows = batch as BinaryRow[];
      lines = binaryRows.map(row => row.toStringArray().join('\t'));
    } else {
      const rowData = batch as RowData[];
      lines = rowData.map(row => Object.values(row).join('\t'));
    }
    
    const tsv = lines.join('\n') + '\n';
    yield encoder.encode(tsv);
  }
}
