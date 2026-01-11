import { BATCH_SIZE_BYTES, RECORD_SEPARATOR, FIELD_SEPARATOR } from "./common.ts";
import { BinaryRow } from "./binary_row.ts";

type RowData = Record<string, string>;

const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();

export async function* fromRecordBytes(bytes: AsyncIterable<Uint8Array>): AsyncIterable<RowData[]> {
  let buffer = "";
  let currentBatch: RowData[] = [];
  let currentBatchSize = 0;
  let headers: string[] | null = null;

  for await (const chunk of bytes) {
    buffer += decoder.decode(chunk, { stream: true });
    
    const records = buffer.split(RECORD_SEPARATOR);
    buffer = records.pop() || "";
    
    for (const record of records) {
      if (!record) continue;
      
      const fields = record.split(FIELD_SEPARATOR);
      
      if (headers === null) {
        headers = fields;
        continue;
      }
      
      const row: RowData = {};
      for (let i = 0; i < headers.length; i++) {
        row[headers[i]] = fields[i] || "";
      }
      
      currentBatch.push(row);
      currentBatchSize += record.length;
      
      if (currentBatchSize >= BATCH_SIZE_BYTES) {
        yield currentBatch;
        currentBatch = [];
        currentBatchSize = 0;
      }
    }
  }

  buffer += decoder.decode();
  if (buffer) {
    const fields = buffer.split(FIELD_SEPARATOR);
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

export async function* fromRecordBytesToBinaryRow(bytes: AsyncIterable<Uint8Array>): AsyncIterable<BinaryRow[]> {
  let buffer = "";
  let currentBatch: BinaryRow[] = [];
  let currentBatchSize = 0;

  for await (const chunk of bytes) {
    buffer += decoder.decode(chunk, { stream: true });
    
    const records = buffer.split(RECORD_SEPARATOR);
    buffer = records.pop() || "";
    
    for (const record of records) {
      if (!record) continue;
      
      const fields = record.split(FIELD_SEPARATOR);
      const row = BinaryRow.fromStringArray(fields);
      
      currentBatch.push(row);
      currentBatchSize += record.length;
      
      if (currentBatchSize >= BATCH_SIZE_BYTES) {
        yield currentBatch;
        currentBatch = [];
        currentBatchSize = 0;
      }
    }
  }

  buffer += decoder.decode();
  if (buffer) {
    const fields = buffer.split(FIELD_SEPARATOR);
    const row = BinaryRow.fromStringArray(fields);
    currentBatch.push(row);
  }

  if (currentBatch.length > 0) {
    yield currentBatch;
  }
}

export async function* toRecordBytes(data: AsyncIterable<RowData[] | BinaryRow[]>): AsyncIterable<Uint8Array> {
  for await (const batch of data) {
    if (batch.length === 0) continue;
    
    let records: string[];
    
    if (batch[0] instanceof BinaryRow) {
      const binaryRows = batch as BinaryRow[];
      records = binaryRows.map(row => row.toStringArray().join(FIELD_SEPARATOR));
    } else {
      const rowData = batch as RowData[];
      records = rowData.map(row => Object.values(row).join(FIELD_SEPARATOR));
    }
    
    const recordData = records.join(RECORD_SEPARATOR) + RECORD_SEPARATOR;
    yield encoder.encode(recordData);
  }
}
