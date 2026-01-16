# CSV Parser Specification

This appendix documents the RFC 4180 compliant CSV parser used by proc's data
transforms and the flatdata CLI. The parser is implemented in Odin and compiled
to WebAssembly for high-performance parsing in JavaScript/TypeScript
environments.

## Standards Compliance

The parser implements
[RFC 4180](https://datatracker.ietf.org/doc/html/rfc4180) - Common Format and
MIME Type for Comma-Separated Values (CSV) Files.

### RFC 4180 Requirements

| Requirement                      | Status | Notes                            |
| -------------------------------- | ------ | -------------------------------- |
| Records separated by line breaks | ✓      | Supports LF and CRLF             |
| Optional header line             | ✓      | Parser treats all rows uniformly |
| Fields separated by commas       | ✓      | Configurable separator           |
| Fields may be quoted             | ✓      | Double-quote character           |
| Quotes escaped by doubling       | ✓      | `""` becomes `"`                 |
| Newlines in quoted fields        | ✓      | Preserved in output              |
| Commas in quoted fields          | ✓      | Preserved in output              |

### Extensions Beyond RFC 4180

- **Configurable separator**: Supports any single-byte delimiter (comma,
  semicolon, tab, etc.)
- **Lenient mode**: Accepts bare quotes in unquoted fields (non-strict)
- **Strict mode**: Rejects malformed input with detailed error reporting
- **Streaming**: Processes input in chunks without loading entire file

## Parser Modes

### Strict Mode

In strict mode, the parser rejects malformed CSV and reports errors with row and
column positions.

Error conditions:

- `BareQuote`: Unescaped quote in unquoted field
- `InvalidCharAfterQuote`: Non-separator/newline after closing quote
- `UnclosedQuote`: EOF reached inside quoted field
- `BareCR`: Carriage return not followed by line feed
- `FieldCountMismatch`: Row has different field count than expected

### Lenient Mode (Default)

In lenient mode, the parser accepts common malformations:

- Bare quotes in unquoted fields are preserved literally
- Bare CR characters start a new record
- Field count mismatches are allowed

## Output Formats

### Record Format

The primary output format uses ASCII control characters:

- `\x1F` (Unit Separator) between fields
- `\x1E` (Record Separator) between rows

This format enables trivial downstream parsing: `row.split('\x1F')` yields
fields.

### Span Format

For zero-copy parsing, the span format returns byte offsets into the original
input rather than copying field data.

## API Reference

### Initialization

```
delimited_init(options: CsvOptions) -> DelimitedParser
```

Options:

- `separator`: Field delimiter (default: `,`)
- `strict`: Enable strict mode (default: `false`)
- `expected_fields`: Expected field count per row, 0 to disable (default: `0`)

### Parsing

```
delimited_parse(parser, input: []u8) -> (rows: u32, ok: bool)
```

Parses a chunk of input. May be called multiple times for streaming. Returns the
number of complete rows parsed and success status.

```
delimited_finish(parser) -> (rows: u32, ok: bool)
```

Finalizes parsing after all input has been provided. Handles any remaining
partial record.

### Output Retrieval

```
delimited_get_complete_output(parser) -> []u8
```

Returns output bytes for complete records only. Partial records (those without a
trailing record separator) are retained for the next chunk.

```
delimited_reset_output(parser)
```

Clears the output buffer after reading.

### Error Handling

```
parser.error.kind  // CsvErrorKind enum
parser.error.row   // 0-indexed row number
parser.error.col   // 0-indexed column number
```

## Stringifier API

The stringifier converts record format back to CSV/TSV.

### Initialization

```
delimited_stringify_init(options: StringifyOptions) -> DelimitedStringifier
```

Options:

- `separator`: Output field delimiter (default: `,`)
- `line_ending`: `.LF` or `.CRLF` (default: `.LF`)
- `always_quote`: Quote all fields, not just those requiring it (default:
  `false`)
- `expected_fields`: Expected field count, 0 to disable (default: `0`)

### Stringifying

```
delimited_stringify(stringifier, input: []u8) -> bool
```

Converts record-format input to CSV. Returns success status.

### Quoting Rules

Fields are quoted when they contain:

- The separator character
- Double quotes (which are escaped by doubling)
- Newline characters (LF or CR)

With `always_quote` enabled, all fields are quoted regardless of content.

## Performance Characteristics

| Metric               | Value              |
| -------------------- | ------------------ |
| Native throughput    | Fastest            |
| WASM throughput      | Very Fast          |
| Memory overhead      | Low                |
| Streaming chunk size | 64 KB recommended  |

Performance characteristics based on typical CSV data with moderate field lengths.

## WebAssembly Integration

The parser is compiled to WebAssembly with the following characteristics:

- **Memory model**: Uses imported memory for zero-copy buffer sharing
- **Build flags**: `--import-memory --strip-all`
- **Target**: `js_wasm32`

### WASM Exports

Buffer management:

- `alloc_input_buffer(size) -> ptr`
- `alloc_output_buffer(size) -> ptr`

Parser lifecycle:

- `create_delimited_parser(separator, strict, expected_fields) -> id`
- `parse_delimited(id, input_len) -> result`
- `finish_delimited(id) -> result`
- `get_delimited_output(id) -> len`
- `clear_delimited_output(id)`
- `destroy_delimited_parser(id)`

Stringifier lifecycle:

- `create_delimited_stringifier(separator, crlf, always_quote, expected_fields) -> id`
- `stringify_delimited(id, input_len) -> ok`
- `get_stringify_output(id) -> len`
- `clear_stringify_output(id)`
- `destroy_delimited_stringifier(id)`

## Implementation Notes

### State Machine

The parser uses a 5-state machine:

1. `FieldStart`: Beginning of a field
2. `Unquoted`: Inside an unquoted field
3. `Quoted`: Inside a quoted field
4. `QuoteInQuoted`: After a quote inside a quoted field (escape or end)
5. `RecordEnd`: After CR, expecting LF

### Memory Management

- Dynamic arrays use Odin's built-in allocator
- Output buffer grows as needed with 10% overhead reservation
- Streaming maintains partial record state between chunks

### UTF-8 Handling

The parser operates on raw bytes and is UTF-8 transparent. Multi-byte UTF-8
sequences pass through unchanged. The separator and control characters are all
single-byte ASCII, ensuring correct handling of UTF-8 text.
