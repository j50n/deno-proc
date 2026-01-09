import { FlatText, type ParserConfig } from "../../wasm/flattext-api.ts";

/**
 * Helper function to convert string input to streaming for tests
 */
export async function csvToTsv(input: string, config?: ParserConfig): Promise<string> {
  const converter = await FlatText.create();
  
  const inputStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(input));
      controller.close();
    }
  });
  
  let output = "";
  const outputStream = new WritableStream({
    write(chunk) {
      output += new TextDecoder().decode(chunk);
    }
  });
  
  await converter.streamCsvToTsv(inputStream, outputStream, config);
  return output;
}

/**
 * Helper function to convert string input to streaming for tests
 */
export async function tsvToCsv(input: string, config?: ParserConfig): Promise<string> {
  const converter = await FlatText.create();
  
  const inputStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(input));
      controller.close();
    }
  });
  
  let output = "";
  const outputStream = new WritableStream({
    write(chunk) {
      output += new TextDecoder().decode(chunk);
    }
  });
  
  await converter.streamTsvToCsv(inputStream, outputStream, config);
  return output;
}
