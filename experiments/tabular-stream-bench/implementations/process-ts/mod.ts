import { StringRow } from "../../../../src/data-transform/string-row.ts";
import { concat } from "@j50n/proc";

export function createStringRowDecoder(): TransformStream<Uint8Array, string[]> {
  let buffer = new Uint8Array(0);
  
  return new TransformStream({
    transform(chunk: Uint8Array, controller) {
      // Combine leftover buffer with new chunk
      const data = buffer.length > 0 ? concat([buffer, chunk]) : chunk;
      let offset = 0;
      
      // Process complete StringRows
      while (offset + 4 <= data.length) {
        const rowLength = new DataView(data.buffer, data.byteOffset + offset).getUint32(0, true);
        
        if (offset + 4 + rowLength <= data.length) {
          const rowData = data.slice(offset + 4, offset + 4 + rowLength);
          
          try {
            const stringRow = StringRow.fromBytes(rowData);
            controller.enqueue(stringRow.toArray());
          } catch (error) {
            console.error("Failed to parse StringRow:", error);
          }
          
          offset += 4 + rowLength;
        } else {
          break;
        }
      }
      
      // Keep only unprocessed remainder
      buffer = offset < data.length ? data.slice(offset) : new Uint8Array(0);
    }
  });
}
