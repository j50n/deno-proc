import { readCSV } from "jsr:@std/csv";

export function createCSVParser(): TransformStream<Uint8Array, string[]> {
  return new TransformStream({
    async start(controller) {
      // CSV parser will handle the stream
    },
    async transform(chunk: Uint8Array, controller) {
      // This will be handled by readCSV directly
    }
  });
}

export function createTSVParser(): TransformStream<string[], string[]> {
  return new TransformStream({
    transform(lines: string[], controller) {
      for (const line of lines) {
        if (line.trim()) {
          const values = line.split(/\t/);
          controller.enqueue(values);
        }
      }
    }
  });
}
