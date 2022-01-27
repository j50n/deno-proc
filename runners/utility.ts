import { BufReader, BufWriter, TextProtoReader } from "../deps.ts";

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
      const buffer = new Uint8Array(DEFAULT_BUFFER_SIZE);
      while (true) {
        const len = await bufferedReader.read(buffer);
        if (len === null) {
          break;
        }
        await bufferedWriter.write(buffer.slice(0, len));
      }
      await bufferedWriter.flush();
    } finally {
      reader.close();
    }
  } finally {
    writer.close();
  }
}

/**
 * Transform a `Reader` to an `AsyncIterableIterator<string>`, separated into lines.
 * @param reader The reader.
 * @param bufSize The buffer size.
 */
export async function* readerToLines(
  reader: Deno.Reader & Deno.Closer,
  bufSize = DEFAULT_BUFFER_SIZE,
): AsyncIterableIterator<string> {
  try {
    const textReader = new TextProtoReader(new BufReader(reader, bufSize));
    while (true) {
      const line = await textReader.readLine();
      if (line === null) {
        break;
      }
      yield line;
    }
  } finally {
    reader.close();
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

export function concat(arrays: Uint8Array[]) {
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
