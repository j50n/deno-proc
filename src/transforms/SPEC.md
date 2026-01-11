# Transform Functions Specification

## Transformer Concept

A **transformer** in this project is a function that converts `AsyncIterable<T>` to `AsyncIterable<U>`, enabling data transformation in streaming pipelines. The standard signature is:

```typescript
type TransformerFunction<T, U> = (it: AsyncIterable<T>) => AsyncIterable<U>;
```

Transformers are used with the `.transform()` method on async iterables to process data streams without loading everything into memory.

## Data Types

### RowData
```typescript
type RowData = Record<string, string>; // Object with string keys and values
```

### BinaryRow Format
Binary representation optimized for read-only field access:

**Structure**:
1. `int32` - Number of columns (N)
2. `int32[N]` - Byte offsets (end position of each column in data)
3. `UTF-8 data` - Concatenated field values

**Stream Format** (additional header):
- `int32` - Total record byte length
- Followed by standard BinaryRow structure

**Field Access**: Use byte slices with TextDecoder for on-demand string conversion.

**Methods**:
- Convert to/from `string[]` arrays
- Field access by index with lazy UTF-8 decoding

### BinaryRow Class
```typescript
class BinaryRow {
  constructor(private data: Uint8Array) {}
  
  get columnCount(): number;
  getField(index: number): string;     // Lazy UTF-8 decode field by index
  toStringArray(): string[];           // Convert all fields to string[]
  static fromStringArray(fields: string[]): BinaryRow;
}
```

## Transform Functions vs Transformers

The functions in this module **are** async generator transformers that follow the project's streaming pattern:

- **Async generators** that process `AsyncIterable<Uint8Array>` inputs
- **Streaming processors** that yield batched results (10-100 items per yield)
- **Format converters** between binary streams and structured data streams

These follow the standard transformer signature: `AsyncIterable<Uint8Array> → AsyncIterable<RowData[] | BinaryRow[]>`

**Batching Strategy**: Functions yield arrays targeting ~128KB batches to optimize async iteration performance while managing memory usage. Batch size is defined in `common.ts`.

## Function Signatures

### TSV Transformers
```typescript
function fromTsvBytes(bytes: AsyncIterable<Uint8Array>): AsyncIterable<RowData[]>
function fromTsvBytesToBinaryRow(bytes: AsyncIterable<Uint8Array>): AsyncIterable<BinaryRow[]>
function toTsvBytes(data: AsyncIterable<RowData[] | BinaryRow[]>): AsyncIterable<Uint8Array>
```

**Format**: Tab-separated values where fields contain no `\t` or `\n` characters.

### Record Transformers
```typescript
function fromRecordBytes(bytes: AsyncIterable<Uint8Array>): AsyncIterable<RowData[]>
function fromRecordBytesToBinaryRow(bytes: AsyncIterable<Uint8Array>): AsyncIterable<BinaryRow[]>
function toRecordBytes(data: AsyncIterable<RowData[] | BinaryRow[]>): AsyncIterable<Uint8Array>
```

**Format**: Uses ASCII control characters for reliable parsing:
- **Record Separator (RS)**: `\x1E` (ASCII 30) - separates records
- **Field Separator (FS)**: `\x1F` (ASCII 31) - separates fields within records

These characters are defined in `common.ts` and should not appear in actual data, allowing safe processing of tabs and newlines within field values.

### JSON Transformers
```typescript
function fromJsonBytes(bytes: AsyncIterable<Uint8Array>, options?: JsonOptions): AsyncIterable<RowData[]>
function fromJsonBytesToBinaryRow(bytes: AsyncIterable<Uint8Array>, options?: JsonOptions): AsyncIterable<BinaryRow[]>
function toJsonBytes(data: AsyncIterable<RowData[] | BinaryRow[]>): AsyncIterable<Uint8Array>
```

**JsonOptions**:
```typescript
interface JsonOptions {
  schema?: ZodSchema;     // Optional Zod validation schema
  sampleSize?: number;    // Validate only first N rows (default: all rows)
}
```

**Format**: JSONL (JSON Lines) - one JSON object per line.

**Validation Strategy**: Zod validation adds significant overhead, so sampling validates only the first N rows then assumes remaining data is valid.

### CSV Transformers (Using Deno CSV Library)
```typescript
function createCsvTransformers(parseOptions?: CsvParseOptions, stringifyOptions?: CsvStringifyOptions): {
  fromCsvBytes: (bytes: AsyncIterable<Uint8Array>) => AsyncIterable<string[][]>
  toCsvBytes: (data: AsyncIterable<string[][]>) => AsyncIterable<Uint8Array>
}
```

**CsvParseOptions**:
```typescript
interface CsvParseOptions {
  separator?: string;        // Field separator (default: ",")
  comment?: string;          // Comment character to ignore lines
  trimLeadingSpace?: boolean; // Trim leading whitespace
  lazyQuotes?: boolean;      // Allow lazy quotes
  fieldsPerRecord?: number;  // Expected fields per record (-1 for variable)
}
```

**CsvStringifyOptions**:
```typescript
interface CsvStringifyOptions {
  separator?: string;        // Field separator (default: ",")
  crlf?: boolean;           // Use CRLF line endings (default: true)
  quote?: string;           // Quote character (default: '"')
  quotedFields?: boolean;   // Quote all fields (default: false)
}
```

**Note**: CSV always works with `string[][]` arrays (batched), never objects. Headers are treated as the first data row.

**Implementation Note**: CSV transformers use `jsr:@std/csv` for parsing and generation to ensure RFC 4180 compliance and proper handling of quoted fields, escaping, and edge cases.

## Design Motivation

### Uint8Array Inputs
All transformer functions accept `Uint8Array` inputs instead of strings to:
- Handle binary data and encoding edge cases properly
- Support streaming operations with chunk boundaries
- Provide consistent interface across all transformers
- Enable proper UTF-8 handling with streaming TextDecoder

### Auto-Detection
Functions automatically detect input data type using:
- `instanceof BinaryRow` checks for BinaryRow inputs
- `Array.isArray()` checks for RowData inputs
- Eliminates need for separate function variants

### Streaming TextDecoder
UTF-8 decoding uses streaming pattern with strict error handling:
```typescript
const decoder = new TextDecoder('utf-8', {fatal: true});
const text = decoder.decode(bytes, {stream: true});
```
This handles multi-byte UTF-8 sequences that may be split across chunk boundaries and throws on invalid UTF-8.

### Library Dependencies
- **CSV**: Uses `jsr:@std/csv` for RFC 4180 compliant parsing and generation
- **TSV/Record/JSON**: Direct implementation with streaming TextDecoder for performance

### Performance Strategy
Optimized for large-scale streaming (100GB+ datasets):

- **Batching**: Process data targeting ~128KB batches (byte count) to minimize async iteration overhead
- **Performance hierarchy**: `for` loops (1x) → standard iterators (10x) → async iterators (100x+)
- **Batch sizing**: Use byte count for batching decisions; fallback to character count if cheaper
- **Stream-friendly**: Never accumulate entire datasets in memory
- **Inner loop efficiency**: Use fast numeric loops for processing within chunks
- **Micro-optimizations**: BinaryRow class optimized for speed at the micro level

**Goal**: Make async iteration penalty negligible through intelligent batching while maintaining streaming characteristics.

### Error Handling
**Strict mode**: Library throws on any data format errors or invalid UTF-8 characters. No error recovery or skipping malformed records.

### Header Handling
**Flow-through**: Headers are treated as regular data rows. Callers extract headers as needed. This avoids object creation overhead compared to header-based object mapping.

## Testing Strategy

Transform functions integrate seamlessly with the project's `enumerate().transform().collect()` pattern:

```typescript
// Test CSV parsing
const csvData = "name,age\nAlice,30\nBob,25";
const result = await enumerate([new TextEncoder().encode(csvData)])
  .transform(fromCsvBytes)
  .collect();

// Test with multiple chunks
const chunks = ["name,age\n", "Alice,30\n", "Bob,25"];
const result = await enumerate(chunks.map(s => new TextEncoder().encode(s)))
  .transform(fromCsvBytes)
  .collect();
```

**Key testing patterns**:
- Use `TextEncoder().encode()` to convert test strings to `Uint8Array`
- Use `enumerate()` to create `AsyncIterable<Uint8Array>` from test data
- Chain with `.transform(transformFunction)` to test the transform
- Use `.collect()` to gather all results for assertions
- Test both single chunks and multi-chunk scenarios for streaming behavior

### Line Ending Normalization
Consistent LF line endings across all formats:
```typescript
.replace(/\r?\n$/, '') + '\n'
```

### Synchronous API
Functions are async generators that yield batched arrays:
- Process data in streaming fashion without loading entire datasets
- Yield arrays of 10-100 items to optimize async iteration performance
- Handle errors through async generator exception propagation
- Enable backpressure control through pull-based iteration
