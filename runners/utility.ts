import { BufReader, BufWriter } from "../deps.ts";
import * as path from "https://deno.land/std@0.127.0/path/mod.ts";

export const DEFAULT_BUFFER_SIZE = 4096;

/**
 * Efficiently pump data from a reader to a writer.
 * @param reader The reader.
 * @param writer The writer.
 */
export async function pump(
  reader: Deno.Reader & Deno.Closer,
  writer: Deno.Writer & Deno.Closer,
): Promise<void> {
  try {
    try {
      const bufferedReader = new BufReader(reader, DEFAULT_BUFFER_SIZE);
      const bufferedWriter = new BufWriter(writer, DEFAULT_BUFFER_SIZE);
      try {
        const buffer = new Uint8Array(DEFAULT_BUFFER_SIZE);
        while (true) {
          const len = await bufferedReader.read(buffer);
          if (len === null) {
            break;
          }
          await bufferedWriter.write(buffer.slice(0, len));
        }
      } finally {
        await bufferedWriter.flush();
      }
    } finally {
      reader.close();
    }
  } finally {
    writer.close();
  }
}

/**
 * Pump data from a reader to a writer, unbuffered.
 * @param reader The reader.
 * @param writer The writer.
 */
export async function pumpUnbuffered(
  reader: Deno.Reader & Deno.Closer,
  writer: Deno.Writer & Deno.Closer,
): Promise<void> {
  try {
    try {
      const buffer = new Uint8Array(DEFAULT_BUFFER_SIZE);
      while (true) {
        const len = await reader.read(buffer);
        if (len === null) {
          break;
        }
        await writer.write(buffer.slice(0, len));
      }
    } finally {
      reader.close();
    }
  } finally {
    writer.close();
  }
}

/**
 * Convert an `AsyncIterable<Uint8Array>` into an `AsyncIterable<string>` of lines.
 * @param buffs The iterable bytes.
 */
export async function* bytesToTextLines(
  buffs: AsyncIterable<Uint8Array>,
): AsyncIterableIterator<string> {
  const decoder = new TextDecoder();

  for await (const line of bytesToByteLines(buffs)) {
    yield decoder.decode(line);
  }
}

/**
 * Convert an `AsyncIterable<Uint8Array>` into an `AsyncIterable<Uint8Array>`
 * split on `lf` and suppressing trailing `cr`.
 * @param buffs The iterable bytes.
 */
export async function* bytesToByteLines(
  buffs: AsyncIterable<Uint8Array>,
): AsyncIterableIterator<Uint8Array> {
  let currentLine: Uint8Array[] = [];

  const createLine = (): Uint8Array => {
    const line = concat(currentLine);
    if (line.length > 0 && line[line.length - 1] === 0x0C) {
      /* Strip the carriage return. */
      return line.slice(0, line.length - 1);
    } else {
      return line;
    }
  };

  for await (const buff of buffs) {
    const length = buff.length;

    let start = 0;
    for (let pos = 0; pos < length; pos++) {
      if (buff[pos] === 0x0A) {
        if (pos) {
          currentLine.push(buff.slice(start, pos));
        }

        yield createLine();

        currentLine = [];
        start = pos + 1;
      }
    }
    if (start < length) {
      currentLine.push(buff.slice(start));
    }
  }

  if (currentLine.length > 0) {
    yield createLine();
  }
}

/**
 * Efficiently transform a `Reader` to an `AsyncIterableIterator<Uint8Array>`.
 * @param reader The reader.
 * @param bufSize The buffer size.
 */
export async function* readerToBytes(
  reader: Deno.Reader & Deno.Closer,
  bufSize = DEFAULT_BUFFER_SIZE,
): AsyncIterableIterator<Uint8Array> {
  try {
    const bufferedReader = new BufReader(reader, bufSize);
    const buffer = new Uint8Array(bufSize);

    while (true) {
      const len = await bufferedReader.read(buffer);
      if (len === null) {
        break;
      }
      yield buffer.slice(0, len);
    }
  } finally {
    reader.close();
  }
}

/**
 * Transform a `Reader` to an `AsyncIterableIterator<Uint8Array>`, unbuffered.
 * This will read bytes as soon as they are available.
 *
 * @param reader The reader.
 * @param bufSize The buffer size.
 */
export async function* readerToBytesUnbuffered(
  reader: Deno.Reader & Deno.Closer,
): AsyncIterableIterator<Uint8Array> {
  try {
    const buffer = new Uint8Array(DEFAULT_BUFFER_SIZE);

    while (true) {
      const len = await reader.read(buffer);
      if (len === null) {
        break;
      }
      yield buffer.slice(0, len);
    }
  } finally {
    reader.close();
  }
}

export function concat(arrays: Uint8Array[]): Uint8Array {
  if (!arrays.length) return new Uint8Array(0);

  const totalLength = arrays.reduce((acc, value) => acc + value.length, 0);
  const result = new Uint8Array(totalLength);

  let length = 0;
  for (const array of arrays) {
    result.set(array, length);
    length += array.length;
  }

  return result;
}

export function randomString(length: number): string {
  const chs = "abcdefghijklmnopqrstuvwxyz";

  const result: string[] = [];
  for (let i = 0; i < length; i++) {
    result.push(chs[Math.floor(Math.random() * chs.length)]);
  }

  return result.join("");
}

/**
 * Sleep for a while.
 * @param delayms Delay in milliseconds.
 */
export async function sleep(delayms: number): Promise<void> {
  await new Promise<void>((resolve, _reject) =>
    setTimeout(() => resolve(), delayms)
  );
}

export function filename(meta: { url: string }): string {
  return path.fromFileUrl(meta.url);
}

export function dirname(meta: { url: string }): string {
  return path.dirname(filename(meta));
}
