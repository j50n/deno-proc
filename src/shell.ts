import { WritableIterable } from "./writable-iterable.ts";

export async function pipeTo<T>(
  src: AsyncIterable<T>,
  dest: WritableIterable<T>,
) {
  try {
    for await (const item of src) {
      dest.write(item);
    }
  } finally {
    dest.close();
  }
}

export async function* pipeThrough<T, U>(
  src: AsyncIterable<T>,
  transform: (item: T) => U | Promise<U>,
): AsyncIterableIterator<U> {
  for await (const item of src) {
    yield transform(item);
  }
}

export class Shell implements Deno.Closer {
  constructor() {}

  async close(): Promise<void> {
  }
}
