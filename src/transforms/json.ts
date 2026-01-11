import { BATCH_SIZE_BYTES } from "./common.ts";
import { BinaryRow } from "./binary_row.ts";

type RowData = Record<string, string>;
type ZodSchema = any; // We'll import this when needed

export interface JsonOptions {
  schema?: ZodSchema;     // Optional Zod validation schema
  sampleSize?: number;    // Validate only first N rows (default: all rows)
}

const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();

export async function* fromJsonBytes(
  bytes: AsyncIterable<Uint8Array>, 
  options?: JsonOptions
): AsyncIterable<RowData[]> {
  let buffer = "";
  let currentBatch: RowData[] = [];
  let currentBatchSize = 0;
  let processedCount = 0;
  let shouldValidate = options?.schema && (options.sampleSize === undefined || options.sampleSize > 0);

  for await (const chunk of bytes) {
    buffer += decoder.decode(chunk, { stream: true });
    
    const lines = buffer.split('\n');
    buffer = lines.pop() || "";
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const obj = JSON.parse(line);
      
      // Validate if needed
      if (shouldValidate && options?.schema) {
        if (options.sampleSize === undefined || processedCount < options.sampleSize) {
          options.schema.parse(obj); // Will throw if invalid
        }
      }
      
      // Convert to RowData (string values only)
      const row: RowData = {};
      for (const [key, value] of Object.entries(obj)) {
        row[key] = String(value);
      }
      
      currentBatch.push(row);
      currentBatchSize += line.length;
      processedCount++;
      
      if (currentBatchSize >= BATCH_SIZE_BYTES) {
        yield currentBatch;
        currentBatch = [];
        currentBatchSize = 0;
      }
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    const obj = JSON.parse(buffer);
    
    if (shouldValidate && options?.schema) {
      if (options.sampleSize === undefined || processedCount < options.sampleSize) {
        options.schema.parse(obj);
      }
    }
    
    const row: RowData = {};
    for (const [key, value] of Object.entries(obj)) {
      row[key] = String(value);
    }
    currentBatch.push(row);
  }

  if (currentBatch.length > 0) {
    yield currentBatch;
  }
}

export async function* fromJsonBytesToBinaryRow(
  bytes: AsyncIterable<Uint8Array>, 
  options?: JsonOptions
): AsyncIterable<BinaryRow[]> {
  let buffer = "";
  let currentBatch: BinaryRow[] = [];
  let currentBatchSize = 0;
  let processedCount = 0;
  let shouldValidate = options?.schema && (options.sampleSize === undefined || options.sampleSize > 0);

  for await (const chunk of bytes) {
    buffer += decoder.decode(chunk, { stream: true });
    
    const lines = buffer.split('\n');
    buffer = lines.pop() || "";
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const obj = JSON.parse(line);
      
      if (shouldValidate && options?.schema) {
        if (options.sampleSize === undefined || processedCount < options.sampleSize) {
          options.schema.parse(obj);
        }
      }
      
      const fields = Object.values(obj).map(v => String(v));
      const row = BinaryRow.fromStringArray(fields);
      
      currentBatch.push(row);
      currentBatchSize += line.length;
      processedCount++;
      
      if (currentBatchSize >= BATCH_SIZE_BYTES) {
        yield currentBatch;
        currentBatch = [];
        currentBatchSize = 0;
      }
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    const obj = JSON.parse(buffer);
    
    if (shouldValidate && options?.schema) {
      if (options.sampleSize === undefined || processedCount < options.sampleSize) {
        options.schema.parse(obj);
      }
    }
    
    const fields = Object.values(obj).map(v => String(v));
    const row = BinaryRow.fromStringArray(fields);
    currentBatch.push(row);
  }

  if (currentBatch.length > 0) {
    yield currentBatch;
  }
}

export async function* toJsonBytes(data: AsyncIterable<RowData[] | BinaryRow[]>): AsyncIterable<Uint8Array> {
  for await (const batch of data) {
    if (batch.length === 0) continue;
    
    let lines: string[];
    
    if (batch[0] instanceof BinaryRow) {
      const binaryRows = batch as BinaryRow[];
      lines = binaryRows.map(row => {
        const fields = row.toStringArray();
        // Convert back to object with numeric keys since we lost original keys
        const obj: Record<string, string> = {};
        fields.forEach((field, i) => {
          obj[`field_${i}`] = field;
        });
        return JSON.stringify(obj);
      });
    } else {
      const rowData = batch as RowData[];
      lines = rowData.map(row => JSON.stringify(row));
    }
    
    const jsonl = lines.join('\n') + '\n';
    yield encoder.encode(jsonl);
  }
}
