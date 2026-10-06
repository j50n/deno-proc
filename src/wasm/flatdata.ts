/**
 * The CSV and TSV kernels in `wasm/flatdata.wasm`, built from `swift/`.
 *
 * The module is compiled once and shared. Each stream gets an instance of its
 * own and drops it when it ends, which is how its memory is released: the
 * module's allocator never frees (see `swift/Sources/Arena/arena.c`).
 *
 * Input goes to WASM a full buffer of `BATCH_SIZE_BYTES` at a time, however
 * the source happens to chunk it, so every call does a good amount of work and
 * a batch of rows is about that size. Each operation takes a smaller
 * `chunkBytes` too, which tests use to put chunk boundaries everywhere.
 *
 * @module
 */

import { FLATDATA_WASM_BASE64 } from "./flatdata-wasm.ts";
import { BATCH_SIZE_BYTES, invalidCharacter } from "../transforms/common.ts";

/**
 * The module's exports. A `last` of 1 ends the stream. A feed returns -1 once
 * the input has had a byte refused, and the `invalid_*` functions, which take
 * any handle, say which and where.
 */
interface Exports {
  memory: WebAssembly.Memory;
  _initialize(): void;

  invalid_row(handle: number): number;
  invalid_field(handle: number): number;
  invalid_byte(handle: number): number;
  invalid_in_output(handle: number): number;

  reader_new(separator: number, quoting: number, chunkCapacity: number): number;
  reader_input(reader: number): number;
  reader_feed(reader: number, count: number, last: number): number;
  reader_output(reader: number): number;
  reader_fields(reader: number): number;
  reader_byte_ends(reader: number): number;
  reader_text_ends(reader: number): number;

  csv2tsv_new(separator: number, chunkCapacity: number): number;
  csv2tsv_input(converter: number): number;
  csv2tsv_output(converter: number): number;
  csv2tsv_feed(converter: number, count: number, last: number): number;

  tsv2csv_new(separator: number, crlf: number, chunkCapacity: number): number;
  tsv2csv_input(converter: number): number;
  tsv2csv_output(converter: number): number;
  tsv2csv_feed(converter: number, count: number, last: number): number;
}

let compiled: Promise<WebAssembly.Module> | undefined;

/** A fresh instance of the module, compiled on first use. */
async function instantiate(): Promise<Exports> {
  compiled ??= WebAssembly.compile(
    Uint8Array.from(atob(FLATDATA_WASM_BASE64), (c) => c.charCodeAt(0)),
  );
  const instance = await WebAssembly.instantiate(await compiled, {});
  const exports = instance.exports as unknown as Exports;
  exports._initialize();
  return exports;
}

/**
 * The error for the byte a handle refused. `input` and `output` name the
 * formats: the input's for a byte it doesn't allow where it is, the output's
 * for one it can't hold.
 */
function refused(
  wasm: Exports,
  handle: number,
  input: string,
  output = input,
): Error {
  return invalidCharacter(
    wasm.invalid_byte(handle),
    wasm.invalid_in_output(handle) ? output : input,
    wasm.invalid_row(handle),
    wasm.invalid_field(handle) - 1,
  );
}

/**
 * Whole rows of CSV or TSV, in record format (each field ends in 0x1F, the
 * last of a row in 0x1E), with the end of every field: `byteEnds[i]` in
 * `bytes` and `textEnds[i]` in UTF-16 code units of `bytes` decoded.
 *
 * The arrays are views of WASM memory, good only until the stream is pulled
 * again.
 */
export interface RowBatch {
  bytes: Uint8Array;
  byteEnds: Uint32Array;
  textEnds: Uint32Array;
}

/**
 * Read CSV, or TSV with `quoting` off and a tab separator, into batches of
 * whole rows; see `swift/Sources/CSV/CSVLexer.swift` for the rules. Batches
 * with no rows are skipped. A byte order mark at the start is dropped.
 *
 * A CR anywhere but before LF (outside quotes, in CSV) throws when the chunk
 * holding it is read. Batches of earlier chunks have been yielded already.
 */
export async function* readRows(
  bytes: AsyncIterable<Uint8Array>,
  separator: number,
  quoting: boolean,
  chunkBytes = BATCH_SIZE_BYTES,
): AsyncIterable<RowBatch> {
  const wasm = await instantiate();
  const reader = wasm.reader_new(separator, quoting ? 1 : 0, chunkBytes);
  const batches = feedInChunks(
    withoutBom(bytes),
    chunkBytes,
    wasm.memory,
    () => wasm.reader_input(reader),
    (count, last): RowBatch => {
      const size = wasm.reader_feed(reader, count, last ? 1 : 0);
      if (size < 0) throw refused(wasm, reader, quoting ? "CSV" : "TSV");
      const fields = wasm.reader_fields(reader);
      const buffer = wasm.memory.buffer;
      return {
        bytes: new Uint8Array(buffer, wasm.reader_output(reader), size),
        byteEnds: new Uint32Array(
          buffer,
          wasm.reader_byte_ends(reader),
          fields,
        ),
        textEnds: new Uint32Array(
          buffer,
          wasm.reader_text_ends(reader),
          fields,
        ),
      };
    },
  );
  for await (const batch of batches) {
    if (batch.byteEnds.length > 0) yield batch;
  }
}

/** Convert CSV to TSV, bytes to bytes. See `swift/Sources/CSV/CSVToTSV.swift`. */
export async function* convertCsvToTsv(
  bytes: AsyncIterable<Uint8Array>,
  separator: number,
  chunkBytes = BATCH_SIZE_BYTES,
): AsyncIterable<Uint8Array<ArrayBuffer>> {
  const wasm = await instantiate();
  const converter = wasm.csv2tsv_new(separator, chunkBytes);
  const output = wasm.csv2tsv_output(converter);
  yield* nonEmpty(feedInChunks(
    withoutBom(bytes),
    chunkBytes,
    wasm.memory,
    () => wasm.csv2tsv_input(converter),
    (count, last) => {
      const size = wasm.csv2tsv_feed(converter, count, last ? 1 : 0);
      if (size < 0) throw refused(wasm, converter, "CSV", "TSV");
      return new Uint8Array(wasm.memory.buffer, output, size).slice();
    },
  ));
}

/** Convert TSV to CSV, bytes to bytes. See `swift/Sources/CSV/TSVToCSV.swift`. */
export async function* convertTsvToCsv(
  bytes: AsyncIterable<Uint8Array>,
  separator: number,
  crlf: boolean,
  chunkBytes = BATCH_SIZE_BYTES,
): AsyncIterable<Uint8Array<ArrayBuffer>> {
  const wasm = await instantiate();
  const converter = wasm.tsv2csv_new(separator, crlf ? 1 : 0, chunkBytes);
  yield* nonEmpty(feedInChunks(
    withoutBom(bytes),
    chunkBytes,
    wasm.memory,
    () => wasm.tsv2csv_input(converter),
    (count, last) => {
      const size = wasm.tsv2csv_feed(converter, count, last ? 1 : 0);
      if (size < 0) throw refused(wasm, converter, "TSV");
      const output = wasm.tsv2csv_output(converter);
      return new Uint8Array(wasm.memory.buffer, output, size).slice();
    },
  ));
}

async function* nonEmpty(
  chunks: AsyncIterable<Uint8Array<ArrayBuffer>>,
): AsyncIterable<Uint8Array<ArrayBuffer>> {
  for await (const chunk of chunks) {
    if (chunk.length > 0) yield chunk;
  }
}

/**
 * Copy a byte stream into a WASM operation's input buffer of `chunkBytes`,
 * call `feed` each time the buffer is full, and once more, with `last`, at
 * the end of the stream. Yields what each call returns.
 *
 * `input` is asked for the buffer's address before each copy, since it may
 * move during a feed.
 */
async function* feedInChunks<T>(
  bytes: AsyncIterable<Uint8Array>,
  chunkBytes: number,
  memory: WebAssembly.Memory,
  input: () => number,
  feed: (count: number, last: boolean) => T,
): AsyncIterable<T> {
  let filled = 0;
  for await (const chunk of bytes) {
    for (let offset = 0; offset < chunk.length;) {
      const count = Math.min(chunkBytes - filled, chunk.length - offset);
      new Uint8Array(memory.buffer, input() + filled, count)
        .set(chunk.subarray(offset, offset + count));
      filled += count;
      offset += count;
      if (filled === chunkBytes) {
        yield feed(filled, false);
        filled = 0;
      }
    }
  }
  yield feed(filled, true);
}

const BOM = [0xEF, 0xBB, 0xBF];

/**
 * The stream without a UTF-8 byte order mark at its start, as `TextDecoder`
 * drops it when reading text. Spreadsheet programs write one.
 */
async function* withoutBom(
  bytes: AsyncIterable<Uint8Array>,
): AsyncIterable<Uint8Array> {
  let head: number[] | undefined = [];
  for await (const chunk of bytes) {
    if (head === undefined) {
      yield chunk;
      continue;
    }
    // Hold back the first bytes while they could still be a split BOM.
    let i = 0;
    while (
      i < chunk.length && head.length < 3 && chunk[i] === BOM[head.length]
    ) {
      head.push(chunk[i++]);
    }
    if (head.length < 3 && i === chunk.length) continue;
    if (head.length < 3) yield Uint8Array.from(head);
    yield chunk.subarray(i);
    head = undefined;
  }
  if (head !== undefined && head.length > 0) yield Uint8Array.from(head);
}
