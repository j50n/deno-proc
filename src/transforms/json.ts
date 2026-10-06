import type { TransformerFunction } from "../transformers.ts";
import { BATCH_SIZE_BYTES, splitText } from "./common.ts";

/**
 * Anything with a `parse` method that returns the value when it is valid and
 * throws when it isn't. A Zod schema fits as it is.
 */
export type ZodSchema<T = unknown> = { parse(value: unknown): T };

/** Options for {@link fromJsonToRows}. */
export interface JsonOptions<T = unknown> {
  /**
   * Checks each value: `schema.parse(value)` is called, and whatever it throws
   * stops the stream. Its return value is ignored, so you get the value as
   * `JSON.parse` made it: Zod transforms and defaults are not applied, and
   * unknown keys are not stripped. Default: no check.
   */
  schema?: ZodSchema<T>;
  /**
   * Check only the first `sampleSize` values with `schema`; the rest pass
   * unchecked. Default: check every value.
   */
  sampleSize?: number;
}

const encode = (() => {
  const encoder = new TextEncoder();
  return encoder.encode.bind(encoder);
})();

/**
 * Parse JSON lines into batches of values, one value per line.
 *
 * Each line is parsed with `JSON.parse` and can hold any JSON value, not only
 * an object. Blank lines are skipped. Batches close at about 128 KiB of text
 * ({@link BATCH_SIZE_BYTES}); add `.flatten()` to work value by value.
 *
 * `T` is only asserted unless you pass a `schema`. A line that isn't JSON
 * throws the `SyntaxError` from `JSON.parse`, whose position counts from the
 * start of that line; it doesn't say which line. Invalid UTF-8 throws a
 * `TypeError`.
 *
 * @example Read events, checking each one
 * ```ts
 * import { read } from "@j50n/proc";
 * import { fromJsonToRows } from "@j50n/proc/transforms";
 *
 * type Event = { id: string; timestamp: number };
 * const EventSchema = {
 *   parse(value: unknown): Event {
 *     const e = value as Partial<Event>;
 *     if (typeof e?.id !== "string" || typeof e.timestamp !== "number") {
 *       throw new TypeError(`not an event: ${JSON.stringify(value)}`);
 *     }
 *     return e as Event;
 *   },
 * };
 *
 * const recent = await read("events.jsonl")
 *   .transform(fromJsonToRows({ schema: EventSchema }))
 *   .flatten()
 *   .filter((e) => e.timestamp > Date.now() - 86_400_000)
 *   .collect();
 * ```
 *
 * @param options A schema to check values with.
 * @returns A transformer for `.transform()`.
 */
export function fromJsonToRows<T = unknown>(
  options?: JsonOptions<T>,
): TransformerFunction<Uint8Array, T[]> {
  return async function* (
    bytes: AsyncIterable<Uint8Array>,
  ): AsyncIterable<T[]> {
    let currentBatch: T[] = [];
    let currentBatchSize = 0;
    let processedCount = 0;
    const schema = options?.schema;
    const sampleSize = options?.sampleSize ?? Infinity;

    for await (const lines of splitText(bytes, "\n")) {
      for (const line of lines) {
        if (!line.trim()) continue;

        const value: T = JSON.parse(line);
        if (schema != null && processedCount < sampleSize) {
          schema.parse(value); // Will throw if invalid
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

    if (currentBatch.length > 0) {
      yield currentBatch;
    }
  };
}

/**
 * Write batches of values as JSON lines, one `JSON.stringify` per line.
 *
 * Each item must be a batch (an array of values), and yields one chunk of
 * bytes; empty batches yield nothing. Watch for this after `.flatten()`: a
 * stream of `Row`s is a stream of arrays, so each row is taken as a batch and
 * each field lands on a line of its own. To write single values, wrap them:
 * `.map((v) => [v])`. A value `JSON.stringify` can't represent, such as
 * `undefined` or a function, is written as the text `undefined`.
 *
 * @example Write CSV rows as JSON objects
 * ```ts
 * import { read } from "@j50n/proc";
 * import { fromCsvToRows, toJson } from "@j50n/proc/transforms";
 *
 * await read("people.csv")
 *   .transform(fromCsvToRows())
 *   .map((batch) => batch.map(([name, age]) => ({ name, age: Number(age) })))
 *   .transform(toJson())
 *   .writeTo("people.jsonl");
 * ```
 *
 * @returns A transformer for `.transform()`.
 */
export function toJson<T = unknown>(): TransformerFunction<
  T[],
  Uint8Array<ArrayBuffer>
> {
  return async function* (
    data: AsyncIterable<T[]>,
  ): AsyncIterable<Uint8Array<ArrayBuffer>> {
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
