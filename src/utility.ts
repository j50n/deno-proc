/**
 * Concatenate arrays together, returning a single array containing the result.
 *
 * Note that this may return the original source data rather than a copy in some
 * circumstances.
 *
 * @param arrays The arrays to concatenate together.
 * @returns The result of the concatenation.
 */
export function concat(arrays: Uint8Array[]): Uint8Array {
  if (!arrays.length) return new Uint8Array(0);

  /*
   * In many cases, we are dealing with data that actually only contains a single array of bytes
   * and does not actually need to be concatenated. In this case, we just return the first buffer
   * from the array (it is the only buffer) and skip the processing, saving a redundant memcpy.
   */
  if (arrays.length === 1) {
    return arrays[0];
  }

  const totalLength = arrays.reduce((acc, value) => acc + value.length, 0);
  const result = new Uint8Array(totalLength);

  let pos = 0;
  for (const array of arrays) {
    result.set(array, pos);
    pos += array.length;
  }

  return result;
}

/**
 * Convert an `AsyncIterable<Uint8Array>` into an `AsyncIterable<string>` of lines.
 * @param buffs The iterable bytes.
 */
export function toLines(
  buffs: AsyncIterable<Uint8Array>,
): AsyncIterable<string[]> {
  const decoder = new TextDecoder();

  return {
    async *[Symbol.asyncIterator]() {
      for await (const lines of toByteLines(buffs)) {
        yield lines.map((line) => decoder.decode(line));
      }
    },
  };
}

/**
 * Convert an `AsyncIterable<Uint8Array>` into an `AsyncIterable<Uint8Array[]>`
 * (an array of lines chunked together based on buffer size)
 * split on `lf` and also suppressing trailing `cr`. `lf` and trailing `cr`
 * is removed from the returned lines.
 * @param buffs The iterable bytes.
 */
export async function* toByteLines(
  buffs: AsyncIterable<Uint8Array>,
): AsyncIterable<Uint8Array[]> {
  /*
   * Using subarray since that is just a view. No copy operation.
   *
   * Iterating and testing byte-wise rather than using `find()`, which requires a
   * call to a function for each byte. Should be pretty close to byte-at-a-time
   * C-style scanning. Not as fast as a SIMD operation, but that isn't an option
   * here.
   */
  let currentLine: Uint8Array[] = [];
  let lastline: undefined | Uint8Array;

  function bufferLine(): Uint8Array | undefined {
    function createLine(): Uint8Array {
      const line = concat(currentLine);

      if (line.length > 0 && line[line.length - 1] === 13) {
        /*  Strip the carriage return. */
        return line.subarray(0, line.length - 1);
      } else {
        return line;
      }
    }

    const temp = lastline;
    lastline = createLine();
    return temp;
  }

  try {
    for await (const buff of buffs) {
      const length = buff.length;

      const chunk: Uint8Array[] = [];

      let start = 0;
      for (let pos = 0; pos < length; pos++) {
        if (buff[pos] === 10) {
          if (pos) {
            currentLine.push(buff.subarray(start, pos));
          }

          const b = bufferLine();
          if (b) {
            chunk.push(b);
          }

          currentLine = [];
          start = pos + 1;
        }
      }

      if (chunk.length > 0) {
        yield chunk;
      }

      if (start < length) {
        currentLine.push(buff.subarray(start));
      }
    }
  } finally {
    const chunk: Uint8Array[] = [];

    if (currentLine.length > 0) {
      const b = bufferLine();
      if (b) {
        chunk.push(b);
      }
    }

    if (lastline?.length) {
      chunk.push(lastline);
    }

    if (chunk.length > 0) {
      yield chunk;
    }
  }
}
