# Transform Functions Specification

## Transformer Concept

A **transformer** in this project is a function that converts `AsyncIterable<T>` to `AsyncIterable<U>`, enabling data transformation in streaming pipelines. The standard signature is:

```typescript
type TransformerFunction<T, U> = (it: AsyncIterable<T>) => AsyncIterable<U>;
```

Transformers are used with the `.transform()` method on async iterables to process data streams without loading everything into memory.

## Data Types

### Row
```typescript
type Row = Record<string, string>; // Object with string keys and values
```

### LazyRow Format
Binary representation optimized for read-only field access:

**Structure**:
1. `int32` - Number of columns (N)
2. `int32[N]` - Byte offsets (end position of each column in data)
3. `UTF-8 data` - Concatenated field values

**Stream Format** (additional header):
- `int32` - Total record byte length
- Followed by standard LazyRow structure

**Field Access**: Use byte slices with TextDecoder for on-demand string conversion.

**Methods**:
- Convert to/from `string[]` arrays
- Field access by index with lazy UTF-8 decoding

### LazyRow Design

**Polymorphic Implementation**: LazyRow uses an abstract base class with two concrete implementations optimized for different source data types.

**Abstract Base Class**:
```typescript
abstract class LazyRow {
  abstract readonly columnCount: number;
  abstract getField(index: number): string;
  abstract toStringArray(): string[];
  abstract toBinary(): Uint8Array;
  
  // Static factory methods
  static fromStringArray(fields: string[]): LazyRow;
  static fromBinary(data: Uint8Array): LazyRow;
}
```

**Concrete Implementations**:
- **StringArrayLazyRow**: Backed by `string[]` with lazy binary conversion and caching
- **BinaryLazyRow**: Backed by `Uint8Array` with lazy string parsing and caching

**Performance Characteristics**:
- **Creation Speed**: Up to 538M fields/sec (675x faster than previous implementation)
- **Overhead vs String Arrays**: Only 3.08x (down from 77x)
- **CSV Parsing**: 1.05-1.70x faster than regular parsing
- **TSV Parsing**: Up to 1.69x faster on large datasets
- **Caching**: Both implementations cache conversions for repeated access

**Binary Format Specification**:
```
LazyRow Binary Layout:
┌─────────────────┬──────────────────┬─────────────────┐
│ Field Count     │ Field Lengths    │ Field Data      │
│ (4 bytes)       │ (4 * N bytes)    │ (UTF-8 bytes)   │
└─────────────────┴──────────────────┴─────────────────┘

Field Count: int32 - Number of fields (N)
Field Lengths: int32[N] - Byte length of each field
Field Data: Concatenated UTF-8 encoded field values
```

**Factory Method Usage**:
```typescript
// Zero-cost creation from existing string array
const lazyRow1 = LazyRow.fromStringArray(['Alice', '30', 'Engineer']);

// Zero-cost creation from binary data
const binaryData = new Uint8Array([...]); // LazyRow binary format
const lazyRow2 = LazyRow.fromBinary(binaryData);

// Lazy conversion with caching
const binary = lazyRow1.toBinary();     // Converts and caches
const binary2 = lazyRow1.toBinary();    // Returns cached result
```

**Design Benefits**:
- **Zero Conversion Cost**: Choose optimal backing based on source data
- **Lazy Evaluation**: Conversions happen only when needed
- **Caching**: Repeated access uses cached results
- **Polymorphic Interface**: Clean API regardless of backing implementation
- **Performance**: Massive improvements over previous monomorphic design

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
function fromTsvToRows(): (bytes: AsyncIterable<Uint8Array>) => AsyncIterable<Row[]>
function fromTsvToLazyRows(): (bytes: AsyncIterable<Uint8Array>) => AsyncIterable<LazyRow[]>
function toTsv(): (data: AsyncIterable<Row[] | LazyRow[]>) => AsyncIterable<Uint8Array>
```

**Format**: Tab-separated values where fields contain no `\t` or `\n` characters.

### Record Transformers
```typescript
function fromRecordToRows(): (bytes: AsyncIterable<Uint8Array>) => AsyncIterable<Row[]>
function fromRecordToLazyRows(): (bytes: AsyncIterable<Uint8Array>) => AsyncIterable<LazyRow[]>
function toRecord(): (data: AsyncIterable<Row[] | LazyRow[]>) => AsyncIterable<Uint8Array>
```

**Format**: Uses ASCII control characters for reliable parsing:
- **Record Separator (RS)**: `\x1E` (ASCII 30) - separates records
- **Field Separator (FS)**: `\x1F` (ASCII 31) - separates fields within records

These characters are defined in `common.ts` and should not appear in actual data, allowing safe processing of tabs and newlines within field values.

### JSON Transformers (Full Object Graphs)
```typescript
function fromJsonToRows<T = unknown>(options?: JsonOptions<T>): 
  (bytes: AsyncIterable<Uint8Array>) => AsyncIterable<T[]>

function toJson<T = unknown>(): 
  (data: AsyncIterable<T[]>) => AsyncIterable<Uint8Array>
```

**JsonOptions**:
```typescript
interface JsonOptions<T = unknown> {
  schema?: ZodSchema<T>;   // Optional Zod validation schema
  sampleSize?: number;     // Validate only first N rows (default: all rows)
}
```

**Format**: JSONL (JSON Lines) - one JSON value per line.

**Important**: JSON transformers work with complete JSON values (objects, arrays, primitives, null) - NOT flattened tabular data. Each line can be any valid JSON:
- `{"name": "Alice", "age": 30}` (object)
- `[1, 2, 3]` (array) 
- `"hello"` (string)
- `42` (number)
- `null` (null)

**No LazyRow Support**: JSON preserves full object structure and cannot be converted to/from LazyRow format since it's not tabular data.

### CSV Transformers (Using Deno CSV Library)
```typescript
function fromCsvToRows(parseOptions?: CsvParseOptions): 
  (bytes: AsyncIterable<Uint8Array>) => AsyncIterable<string[][]>

function fromCsvToLazyRows(parseOptions?: CsvParseOptions): 
  (bytes: AsyncIterable<Uint8Array>) => AsyncIterable<LazyRow[]>

function toCsv(stringifyOptions?: CsvStringifyOptions): 
  (data: AsyncIterable<string[] | string[][] | LazyRow | LazyRow[]>) => AsyncIterable<Uint8Array>
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

**Note**: 
- CSV works with `string[][]` arrays (batched rows), where `RowData` is `string[]`
- Headers are treated as the first data row
- Each function returns a single transform function for use with `.transform()`

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

## Performance Characteristics

### Format Throughput (Parsing)
Based on comprehensive benchmarks across dataset sizes:

**Small Datasets (1K rows)**:
- JSON: 98.20 MB/s (fastest for small data)
- TSV: 71.61 MB/s 
- Record: 59.95 MB/s
- CSV: 9.82 MB/s

**Large Datasets (50K+ rows)**:
- Record: 93.34 MB/s (most scalable)
- JSON: 70.31 MB/s
- TSV: 56.88 MB/s
- CSV: 27.29 MB/s

### LazyRow Performance Benefits
- **CSV with LazyRow**: 1.05-1.70x faster than regular parsing
- **TSV with LazyRow**: Up to 1.69x faster on large datasets
- **Record with LazyRow**: 1.72x faster on small datasets
- **Best Use Cases**: LazyRow excels with CSV and large TSV datasets

### Format Selection Guidelines
- **Use JSON**: When you need full object structure preservation
- **Use Record**: For highest throughput with structured tabular data
- **Use TSV**: Good balance of speed and human readability
- **Use CSV**: When compatibility is required (slower but universal)
- **Use LazyRow**: Always with CSV, selectively with TSV/Record based on dataset size

### Memory Usage
- **Streaming Design**: Constant memory usage regardless of dataset size
- **Batch Processing**: ~128KB batches optimize async iteration performance
- **LazyRow Caching**: Minimal memory overhead for conversion caching

### Future Performance Plans
**WASM Acceleration Pipeline**:
```
CSV File → JS Chunks → Uint8Array → WASM Parser → LazyRow Binary → Output
```
**Expected Improvements**:
- **Current CSV**: 27 MB/s
- **With WASM**: 200-800 MB/s (7-30x improvement)
- **Round-trip**: 150-200 MB/s (8-10x improvement)

This would make CSV the fastest format by leveraging native-speed WASM processing.

### Error Handling
**Strict mode**: Library throws on any data format errors or invalid UTF-8 characters. No error recovery or skipping malformed records.

**Error Types**:
- **UTF-8 errors**: Invalid byte sequences throw with `fatal: true` TextDecoder
- **Format errors**: Malformed CSV/JSON/TSV/Record data throws appropriate errors
- **Validation errors**: Zod schema validation failures (JSON only)
- **Bounds errors**: LazyRow field access out of range throws errors

**Testing**: All transformers must have comprehensive error tests covering invalid input scenarios.

### Header Handling

**Flow-through Design**: Headers are treated as regular data rows. Callers extract headers as needed. This avoids object creation overhead compared to header-based object mapping.

**Design Decision**: Transform functions do NOT process headers specially:
- Headers are returned as the first row of data (if present)
- No automatic header extraction or object key mapping
- No validation of column counts against headers
- Users must handle header processing in their application code if needed

**Column Count**: Transform functions do NOT guarantee consistent column counts:
- Rows may have different numbers of fields
- No validation that all rows match header column count
- Malformed data may produce rows with varying field counts
- Users should validate column consistency in their application if required

This design prioritizes performance and flexibility over convenience, allowing users to implement their own header and validation logic as needed.

## Benchmarking Infrastructure

### Benchmark Suite
The project includes a comprehensive benchmark suite in `benchmarks/`:

**Benchmark Scripts**:
- `streaming_performance.ts`: Cross-format streaming performance comparison
- `csv_performance.ts`: Detailed CSV parsing and stringify benchmarks  
- `lazy_row_performance.ts`: LazyRow creation and access performance
- `comparative_analysis.ts`: Side-by-side format efficiency analysis

**Test Data Generation**:
- `generate_datasets.ts`: Creates test datasets with special characters
- Sizes: Small (1K), Medium (10K-50K), Large (200K) rows
- Formats: CSV, TSV, JSON with proper UTF-8 encoding
- Special characters: café, naïve, 🚀, 東京, москва

**Running Benchmarks**:
```bash
# Run complete suite
./benchmarks/run_benchmarks.sh

# Individual benchmarks  
deno run --allow-read benchmarks/transforms/streaming_performance.ts
```

**Benchmark Features**:
- Automatic test data generation and cleanup
- Multiple dataset sizes and column configurations
- Throughput measurement in MB/s
- LazyRow vs regular parsing comparisons
- Cross-format performance analysis
- Proper error handling and timeout protection

### Performance Validation
All performance claims are backed by reproducible benchmarks that:
- Test realistic datasets with special characters
- Measure both parsing and stringify performance
- Compare LazyRow vs regular implementations
- Validate data integrity through round-trip tests
- Handle various dataset sizes and column counts

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
