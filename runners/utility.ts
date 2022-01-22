import { BufReader, BufWriter, TextProtoReader } from "../deps.ts";

export async function pump(
  input: Deno.Reader & Deno.Closer,
  output: Deno.Writer & Deno.Closer,
): Promise<void> {
  try {
    try {
      const reader = new BufReader(input, 16368);
      const writer = new BufWriter(output, 16368);
      const buffer = new Uint8Array(16368);
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

export async function* reader2Lines(
  input: Deno.Reader & Deno.Closer,
): AsyncIterableIterator<string> {
  try {
    const reader = new TextProtoReader(new BufReader(input));
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
