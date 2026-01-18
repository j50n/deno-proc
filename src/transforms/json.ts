import { BATCH_SIZE_BYTES } from "./common.ts";

type ZodSchema<T = unknown> = { parse(value: unknown): T }; // Minimal Zod interface

/**
 * Options for JSON Lines parsing.
 */
export interface JsonOptions<T = unknown> {
  /**
   * Optional Zod validation schema.
   * When provided, each parsed object is validated against this schema.
   */
  schema?: ZodSchema<T>;
  /**
   * Validate only the first N rows.
   * Useful for performance when you trust the data after initial validation.
   * Default: validate all rows (when schema is provided).
   */
  sampleSize?: number;
}

const decode = (() => {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  return decoder.decode.bind(decoder);
})();
const encode = (() => {
  const encoder = new TextEncoder();
  return encoder.encode.bind(encoder);
})();

/**
 * Parse JSON Lines (JSONL) bytes into batches of objects.
 *
 * Streams JSONL data efficiently, yielding batches of parsed objects (~128KB each).
 * Each line is expected to be a valid JSON object.
 *
 * **Performance**: JSON parsing achieves ~70-98 MB/s depending on object complexity.
 *
 * @example Basic JSONL parsing
 * ```typescript
 * import { read } from "jsr:@j50n/proc";
 * import { fromJsonToRows } from "jsr:@j50n/proc/transforms";
 *
 * const events = await read("events.jsonl")
 *   .transform(fromJsonToRows())
 *   .flatten()
 *   .collect();
 * // unknown[] - parsed JSON objects
 * ```
 *
 * @example With TypeScript type
 * ```typescript
 * interface Event { id: string; timestamp: number; }
 *
 * const events = await read("events.jsonl")
 *   .transform(fromJsonToRows<Event>())
 *   .flatten()
 *   .filter(e => e.timestamp > Date.now() - 86400000)
 *   .collect();
 * ```
 *
 * @example With Zod validation
 * ```typescript
 * import { z } from "zod";
 *
 * const EventSchema = z.object({
 *   id: z.string(),
 *   timestamp: z.number()
 * });
 *
 * const events = await read("events.jsonl")
 *   .transform(fromJsonToRows({ schema: EventSchema }))
 *   .flatten()
 *   .collect();
 * ```
 *
 * @param options Parsing and validation options.
 * @returns A transformer function for use with `.transform()`.
 */
export function fromJsonToRows<T = unknown>(options?: JsonOptions<T>) {
  return async function* (
    bytes: AsyncIterable<Uint8Array>,
  ): AsyncIterable<T[]> {
    let buffer = "";
    let currentBatch: T[] = [];
    let currentBatchSize = 0;
    let processedCount = 0;
    const shouldValidate = options?.schema &&
      (options.sampleSize === undefined || options.sampleSize > 0);

    for await (const chunk of bytes) {
      buffer += decode(chunk, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        const value: T = JSON.parse(line);

        // Validate if needed
        if (shouldValidate && options?.schema) {
          if (
            options.sampleSize === undefined ||
            processedCount < options.sampleSize
          ) {
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

    buffer += decode();
    if (buffer.trim()) {
      const value: T = JSON.parse(buffer);
      if (shouldValidate && options?.schema) {
        if (
          options.sampleSize === undefined ||
          processedCount < options.sampleSize
        ) {
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

/**
 * Convert objects to JSON Lines (JSONL) bytes.
 *
 * Accepts batches of objects and produces newline-delimited JSON output.
 *
 * @example Write JSONL file
 * ```typescript
 * import { read } from "jsr:@j50n/proc";
 * import { fromJsonToRows, toJson } from "jsr:@j50n/proc/transforms";
 *
 * await read("input.jsonl")
 *   .transform(fromJsonToRows())
 *   .transform(toJson())
 *   .writeTo("output.jsonl");
 * ```
 *
 * @example Convert CSV to JSONL
 * ```typescript
 * import { read } from "jsr:@j50n/proc";
 * import { fromCsvToRows } from "jsr:@j50n/proc/transforms";
 * import { toJson } from "jsr:@j50n/proc/transforms";
 *
 * await read("data.csv")
 *   .transform(fromCsvToRows())
 *   .map(batch => batch.map((row, i) => ({ index: i, fields: row })))
 *   .transform(toJson())
 *   .writeTo("data.jsonl");
 * ```
 *
 * @returns A transformer function for use with `.transform()`.
 */
export function toJson<T = unknown>() {
  return async function* (data: AsyncIterable<T[]>): AsyncIterable<Uint8Array> {
    for await (const batch of data) {
      if (batch.length === 0) continue;

      let result = "";
      for (let i = 0; i < batch.length; i++) {
        if (i > 0) result = result.concat("\n");
        result = result.concat(JSON.stringify(batch[i]));
      }
      result = result.concat("\n");
      yield encode(result);
    }
  };
}
