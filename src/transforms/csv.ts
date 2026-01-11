import { parse, stringify } from "jsr:@std/csv";
import { RowData, BinaryRow } from "../types.ts";

export function fromCsvBytesToRowData(bytes: Uint8Array): RowData[] {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const text = decoder.decode(bytes, { stream: true });
  
  const records = parse(text, { skipFirstRow: false });
  if (records.length === 0) return [];
  
  const headers = records[0];
  return records.slice(1).map(row => 
    Object.fromEntries(headers.map((header, i) => [header, row[i] || ""]))
  );
}

export function fromCsvBytesToBinaryRow(bytes: Uint8Array): BinaryRow[] {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const text = decoder.decode(bytes, { stream: true });
  
  const records = parse(text, { skipFirstRow: false });
  if (records.length === 0) return [];
  
  const headers = records[0];
  return records.slice(1).map(row => new BinaryRow(
    headers.map((header, i) => row[i] || "")
  ));
}

export function toCsvBytes(data: RowData[] | BinaryRow[]): Uint8Array {
  if (data.length === 0) return new Uint8Array();
  
  let headers: string[];
  let rows: string[][];
  
  if (data[0] instanceof BinaryRow) {
    const binaryRows = data as BinaryRow[];
    headers = binaryRows[0].headers;
    rows = binaryRows.map(row => row.values);
  } else {
    const rowData = data as RowData[];
    headers = Object.keys(rowData[0]);
    rows = rowData.map(row => headers.map(h => row[h] || ""));
  }
  
  const csv = stringify([headers, ...rows]);
  return new TextEncoder().encode(csv);
}
