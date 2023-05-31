import { AsyncIterableRunnable } from "./shell.ts";

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
export function bytesToTextLines(
  buffs: AsyncIterable<Uint8Array>,
): AsyncIterableRunnable<string> {
  const decoder = new TextDecoder();

  return new AsyncIterableRunnable<string>({
    async *[Symbol.asyncIterator]() {
      for await (const line of bytesToByteLines(buffs)) {
        yield decoder.decode(line);
      }
    },
  });
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
  let lastline: undefined | Uint8Array;

  function bufferLine(): Uint8Array | undefined {
    function createLine(): Uint8Array {
      const line = concat(currentLine);
      //console.dir(line[line.length - 1]);
      if (line.length > 0 && line[line.length - 1] === 13) {
        /* Strip the carriage return. */
        return line.subarray(0, line.length - 1);
      } else {
        return line;
      }
    }

    const temp = lastline;
    lastline = createLine();
    return temp;
  }

  for await (const buff of buffs) {
    const length = buff.length;

    let start = 0;
    for (let pos = 0; pos < length; pos++) {
      if (buff[pos] === 10) {
        if (pos) {
          currentLine.push(buff.subarray(start, pos));
        }

        const b = bufferLine();
        if (b) {
          yield b;
        }

        currentLine = [];
        start = pos + 1;
      }
    }
    if (start < length) {
      currentLine.push(buff.subarray(start));
    }
  }

  if (currentLine.length > 0) {
    const b = bufferLine();
    if (b) {
      yield b;
    }
  }

  if (lastline?.length) {
    yield lastline;
  }
}
