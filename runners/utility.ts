import { BufReader, BufWriter, TextProtoReader } from "../deps.ts";

export const DEFAULT_BUFFER_SIZE = 4096;

export async function pump(
  input: Deno.Reader & Deno.Closer,
  output: Deno.Writer & Deno.Closer,
): Promise<void> {
  try {
    try {
      const reader = new BufReader(input, DEFAULT_BUFFER_SIZE);
      const writer = new BufWriter(output, DEFAULT_BUFFER_SIZE);
      const buffer = new Uint8Array(DEFAULT_BUFFER_SIZE);
      while (true) {
        const len = await reader.read(buffer);
        if (len === null) {
          break;
        }
        await writer.write(buffer.slice(0, len));
      }
      await writer.flush();
    } finally {
      input.close();
    }
  } finally {
    output.close();
  }
}

export async function* readerToLines(
  input: Deno.Reader & Deno.Closer,
  bufSize = DEFAULT_BUFFER_SIZE,
): AsyncIterableIterator<string> {
  try {
    const reader = new TextProtoReader(new BufReader(input, bufSize));
    while (true) {
      const line = await reader.readLine();
      if (line === null) {
        break;
      }
      yield line;
    }
  } finally {
    input.close();
  }
}

export async function* readerToBytes(
  input: Deno.Reader & Deno.Closer,
  bufSize = DEFAULT_BUFFER_SIZE,
): AsyncIterableIterator<Uint8Array> {
  try {
    const reader = new BufReader(input, bufSize);
    const buffer = new Uint8Array(bufSize);

    while(true){
      const len = await reader.read(buffer);
      if(len === null){
        break;
      }
      yield buffer.slice(0, len);
    }
  } finally {
    input.close();
  }
}
