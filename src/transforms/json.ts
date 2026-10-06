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
   * Checks each value: what `schema.parse(value)` returns is the value
   * yielded, so Zod defaults and transforms apply and unknown keys are
   * stripped, and whatever it throws stops the stream. Default: no check.
   */
  schema?: ZodSchema<T>;
  /**
   * Pass only the first `sampleSize` values through `schema`. The rest are
   * yielded as `JSON.parse` made them, unchecked and untransformed, and are
   * typed `T` only by assertion, as with no schema at all; so use it only with
   * a schema that checks values without changing them. Default: every value.
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
 * `T` is only asserted unless you pass a `schema`, whose `parse` result is
 * what you get. A line that isn't JSON throws a `SyntaxError` naming the line,
 * counted from 1 with blank lines included, as in
 * `Invalid JSON at line 4001: Unexpected token ...`. What the schema throws
 * comes out as it is, so `instanceof` still finds a Zod error. Invalid UTF-8
 * throws a `TypeError`.
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

    let lineNumber = 0;

    for await (const lines of splitText(bytes, "\n")) {
      for (const line of lines) {
        lineNumber++;
        if (!line.trim()) continue;

        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch (cause) {
          throw new SyntaxError(
            `Invalid JSON at line ${lineNumber}: ${(cause as Error).message}`,
            { cause },
          );
        }
        const value = schema != null && processedCount < sampleSize
          ? schema.parse(parsed)
          : parsed as T;

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
 * Write values as JSON lines: one `JSON.stringify` per item, one item per
 * line. It is the reverse of `fromJsonToRows()` followed by `.flatten()`.
 *
 * Each item yields one chunk of bytes. An array is one value, written as a
 * JSON array on one line, so flatten a stream of batches first. Inside a
 * value, `JSON.stringify`'s rules apply: a property holding `undefined` or a
 * function is left out, and in an array it becomes `null`. An item with no
 * JSON form at all (`undefined`, a function, a symbol) throws a `TypeError`
 * naming it, counted from 1: `Item 3 can't be written as JSON (undefined)`.
 * So does an item `JSON.stringify` throws on, such as a `BigInt` or a cycle,
 * with that error as its `cause`. Items before it have already been written.
 *
 * @example Write CSV rows as JSON objects
 * ```ts
 * import { read } from "@j50n/proc";
 * import { fromCsvToRows, toJson } from "@j50n/proc/transforms";
 *
 * await read("people.csv")
 *   .transform(fromCsvToRows())
 *   .flatten()
 *   .map(([name, age]) => ({ name, age: Number(age) }))
 *   .transform(toJson())
 *   .writeTo("people.jsonl");
 * ```
 *
 * @returns A transformer for `.transform()`.
 */
export function toJson<T = unknown>(): TransformerFunction<
  T,
  Uint8Array<ArrayBuffer>
> {
  return async function* (
    values: AsyncIterable<T>,
  ): AsyncIterable<Uint8Array<ArrayBuffer>> {
    let itemNumber = 0;
    for await (const value of values) {
      itemNumber++;
      let text: string | undefined;
      try {
        text = JSON.stringify(value);
      } catch (cause) {
        throw new TypeError(
          `Item ${itemNumber} can't be written as JSON (${
            cause instanceof Error ? cause.message : String(cause)
          })`,
          { cause },
        );
      }
      if (text === undefined) {
        throw new TypeError(
          `Item ${itemNumber} can't be written as JSON (${typeof value})`,
        );
      }
      yield encode(text + "\n");
    }
  };
}
