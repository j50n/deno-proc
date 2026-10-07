// Splitting a byte stream into decoded pieces: lines for `.lines`, JSON
// lines, and the record format's records.

/**
 * Decode a byte stream and split it on `separator`, yielding the complete
 * pieces from each chunk. The text after the last separator comes last, if
 * there is any.
 *
 * Each stream gets its own decoder, because a decoder carries a character split
 * across two chunks from one to the next.
 *
 * Invalid UTF-8 is a `TypeError` with the message `invalid` makes from the
 * number of the piece holding it, counting from 1; the pieces before it are
 * yielded first.
 *
 * @internal
 */
export async function* splitText(
  bytes: AsyncIterable<Uint8Array>,
  separator: string,
  invalid: (piece: number) => string,
): AsyncIterable<string[]> {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let tail = "";
  let count = 0;
  let recent: Uint8Array = new Uint8Array(0);

  for await (const chunk of bytes) {
    let text: string;
    let failed = false;
    try {
      text = decoder.decode(chunk, { stream: true });
    } catch {
      const atStart = count === 0 && !tail;
      text = textBeforeInvalid(recent, chunk, separator.charCodeAt(0), atStart);
      failed = true;
    }
    recent = lastBytes(recent, chunk);
    // Re-splitting a long unfinished piece on every chunk would be quadratic.
    if (text.includes(separator)) {
      const pieces = (tail + text).split(separator);
      tail = pieces.pop()!;
      count += pieces.length;
      yield pieces;
    } else {
      tail += text;
    }
    if (failed) throw new TypeError(invalid(count + 1));
  }

  try {
    tail += decoder.decode();
  } catch {
    throw new TypeError(invalid(count + 1));
  }
  if (tail !== "") yield [tail];
}

/**
 * The last bytes of a stream so far, enough to hold the start of a character
 * that `chunk` didn't finish: `recent` was the result for the chunk before.
 */
function lastBytes(recent: Uint8Array, chunk: Uint8Array): Uint8Array {
  if (chunk.length >= 3) return chunk.subarray(chunk.length - 3);
  const both = new Uint8Array(recent.length + chunk.length);
  both.set(recent);
  both.set(chunk, recent.length);
  return both.subarray(Math.max(0, both.length - 3));
}

/**
 * After a fatal streaming `TextDecoder` refused `chunk`: the text of the
 * pieces before the one holding the invalid byte, each through its
 * `separator`, so they can be delivered before the error. The separator is an
 * ASCII byte, never part of a longer character. `recent` is {@link lastBytes}
 * of the stream before `chunk`, which may hold the start of a character the
 * decoder was waiting to finish.
 */
function textBeforeInvalid(
  recent: Uint8Array,
  chunk: Uint8Array,
  separator: number,
  atStart: boolean,
): string {
  const carried = unfinished(recent);
  const bytes = new Uint8Array(carried.length + chunk.length);
  bytes.set(carried);
  bytes.set(chunk, carried.length);
  // A BOM is dropped only at the start of the stream, as the decoder did.
  const decoder = new TextDecoder("utf-8", {
    fatal: true,
    ignoreBOM: !atStart,
  });
  let text = "";
  let start = 0;
  while (true) {
    const end = bytes.indexOf(separator, start);
    if (end === -1) return text;
    try {
      text += decoder.decode(bytes.subarray(start, end + 1), { stream: true });
    } catch {
      return text;
    }
    start = end + 1;
  }
}

/** The bytes at the end of `bytes` that start a character but don't finish it. */
function unfinished(bytes: Uint8Array): Uint8Array {
  for (let back = 1; back <= Math.min(3, bytes.length); back++) {
    const byte = bytes[bytes.length - back];
    if (byte < 0x80) break;
    if (byte >= 0xC0) {
      const length = byte >= 0xF0 ? 4 : byte >= 0xE0 ? 3 : 2;
      return back < length
        ? bytes.subarray(bytes.length - back)
        : bytes.subarray(0, 0);
    }
  }
  return bytes.subarray(0, 0);
}
