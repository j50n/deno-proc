import { BATCH_SIZE_BYTES } from "./common.ts";

type ZodSchema<T = unknown> = { parse(value: unknown): T }; // Minimal Zod interface

export interface JsonOptions<T = unknown> {
  schema?: ZodSchema<T>;     // Optional Zod validation schema
  sampleSize?: number;    // Validate only first N rows (default: all rows)
}

const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();

export function fromJsonToRows<T = unknown>(options?: JsonOptions<T>) {
  return async function* (bytes: AsyncIterable<Uint8Array>): AsyncIterable<T[]> {
    let buffer = "";
    let currentBatch: T[] = [];
    let currentBatchSize = 0;
    let processedCount = 0;
    let shouldValidate = options?.schema && (options.sampleSize === undefined || options.sampleSize > 0);

    for await (const chunk of bytes) {
      buffer += decoder.decode(chunk, { stream: true });
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        const value: T = JSON.parse(line);
        
        // Validate if needed
        if (shouldValidate && options?.schema) {
          if (options.sampleSize === undefined || processedCount < options.sampleSize) {
            options.schema.parse(value); // Will throw if invalid
          }
        }
        
        currentBatch.push(value);
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
      const value: T = JSON.parse(buffer);
      if (shouldValidate && options?.schema) {
        if (options.sampleSize === undefined || processedCount < options.sampleSize) {
          options.schema.parse(value);
        }
      }
      currentBatch.push(value);
    }

    if (currentBatch.length > 0) {
      yield currentBatch;
    }
  };
}

export function toJson<T = unknown>() {
  return async function* (data: AsyncIterable<T[]>): AsyncIterable<Uint8Array> {
    for await (const batch of data) {
      if (batch.length === 0) continue;
      
      const lines = batch.map(value => JSON.stringify(value));
      const jsonl = lines.join('\n') + '\n';
      yield encoder.encode(jsonl);
    }
  };
}
