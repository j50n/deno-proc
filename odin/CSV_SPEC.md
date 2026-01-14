# CSV Push Parser Specification

RFC 4180 compliant CSV parser for Odin, designed for WebAssembly streaming.

## Package

```
odin/src/csv/       # Standalone package, importable as "csv"
├── csv.odin        # Parser implementations
└── csv_test.odin   # Comprehensive tests
```

## Architecture

- **Push-based**: Caller feeds chunks via `parse(chunk)`. Parser emits
  fields/records as found.
- **Streaming**: Handles arbitrary chunk boundaries, including mid-field and
  mid-quote splits.
- **Two implementations**: Optimized separately for different output needs.
- **No header handling**: All rows are data rows. Caller interprets first row as
  header if needed.

## RFC 4180 Grammar

```
file = [header CRLF] record *(CRLF record) [CRLF]
header = name *(COMMA name)
record = field *(COMMA field)
field = escaped / non-escaped
escaped = DQUOTE *(TEXTDATA / COMMA / CR / LF / 2DQUOTE) DQUOTE
non-escaped = *TEXTDATA
COMMA = %x2C
CR = %x0D
LF = %x0A
CRLF = CR LF
DQUOTE = %x22
TEXTDATA = %x20-21 / %x23-2B / %x2D-7E
```

## Parser States

```odin
CsvState :: enum u8 {
    FieldStart,      // Beginning of a field
    Unquoted,        // Inside unquoted field
    Quoted,          // Inside quoted field
    QuoteInQuoted,   // Saw quote inside quoted field (escape or end?)
    RecordEnd,       // Just saw CR, expecting LF
}
```

## State Transitions

| State         | Input | Action                        | Next State    |
| ------------- | ----- | ----------------------------- | ------------- |
| FieldStart    | `"`   | mark field start              | Quoted        |
| FieldStart    | `,`   | emit empty field              | FieldStart    |
| FieldStart    | CR    | emit empty field              | RecordEnd     |
| FieldStart    | LF    | emit empty field, emit record | FieldStart    |
| FieldStart    | other | mark field start              | Unquoted      |
| Unquoted      | `,`   | emit field                    | FieldStart    |
| Unquoted      | CR    | emit field                    | RecordEnd     |
| Unquoted      | LF    | emit field, emit record       | FieldStart    |
| Unquoted      | `"`   | ERROR or include (mode)       | Unquoted      |
| Unquoted      | other | continue                      | Unquoted      |
| Quoted        | `"`   | —                             | QuoteInQuoted |
| Quoted        | other | continue                      | Quoted        |
| QuoteInQuoted | `"`   | append quote to field         | Quoted        |
| QuoteInQuoted | `,`   | emit field                    | FieldStart    |
| QuoteInQuoted | CR    | emit field                    | RecordEnd     |
| QuoteInQuoted | LF    | emit field, emit record       | FieldStart    |
| QuoteInQuoted | other | ERROR (always)                | —             |
| RecordEnd     | LF    | emit record                   | FieldStart    |
| RecordEnd     | other | ERROR or emit record (mode)   | FieldStart    |

## Implementations

### 1. DelimitedParser

Copies field content to output buffer with ASCII delimiters. Unescapes `""` →
`"` inline.

**Output format**: `field1\x1Ffield2\x1Ffield3\x1E` (fields separated by `\x1F`,
records by `\x1E`)

**Use case**: JS unpacks via `text.split('\x1E').map(row => row.split('\x1F'))`

```odin
DelimitedParser :: struct {
    state:         CsvState,
    row:           u32,
    col:           u32,
    fields_in_row: u32,
    opts:          CsvOptions,
    error:         CsvError,
    output:        [dynamic]u8,
    carry:         [dynamic]u8,    // partial field across chunks
    row_started:   bool,
}
```

### 2. SpanParser

Zero-copy. Emits `(start, end, flags)` tuples referencing input buffer. Caller
unescapes quoted fields.

**Output format**: Array of `FieldSpan` structs + `row_ends` indices

**Use case**: Lazy field access, caller extracts only needed fields

```odin
SpanParser :: struct {
    state:         CsvState,
    row:           u32,
    col:           u32,
    field_start:   u32,
    fields_in_row: u32,
    opts:          CsvOptions,
    error:         CsvError,
    spans:         [dynamic]FieldSpan,
    row_ends:      [dynamic]u32,
    is_quoted:     bool,
    base_offset:   u32,
}

FieldSpan :: struct {
    start: u32,
    end:   u32,
    flags: u8,      // bit 0: quoted (needs unescape)
}
```

## Options

```odin
CsvOptions :: struct {
    separator:       u8,    // Field delimiter, default ','
    strict:          bool,  // Error on RFC violations, default false
    expected_fields: u32,   // Required field count, 0 = any
}
```

## Field Count Validation

- **Lenient (default)**: Accept any field count per row
- **Strict**: Set `expected_fields > 0`, returns `FieldCountMismatch` error on
  mismatch

## Error Handling

### Error Types

```odin
CsvErrorKind :: enum u8 {
    None = 0,
    BareQuote,              // Quote in unquoted field (strict only)
    UnclosedQuote,          // EOF inside quoted field (strict only)
    InvalidCharAfterQuote,  // Non-comma/newline after closing quote (always)
    BareCR,                 // CR not followed by LF (strict only)
    FieldCountMismatch,     // Wrong field count (strict + expected_fields)
}

CsvError :: struct {
    kind: CsvErrorKind,
    row:  u32,              // 0-indexed
    col:  u32,              // 0-indexed byte position in row
}
```

### Strict vs Lenient

| Condition                | Strict                        | Lenient                       |
| ------------------------ | ----------------------------- | ----------------------------- |
| Quote in unquoted field  | `BareQuote` error             | Include quote in field        |
| EOF inside quoted field  | `UnclosedQuote` error         | Close field at EOF            |
| Char after closing quote | `InvalidCharAfterQuote` error | `InvalidCharAfterQuote` error |
| CR not followed by LF    | `BareCR` error                | Treat CR as line ending       |
| Field count mismatch     | `FieldCountMismatch` error    | Accept row                    |

### JavaScript Error Classes

```typescript
class CsvParseError extends Error {
  constructor(
    public kind: string,
    public row: number,
    public col: number,
    message?: string,
  ) {
    super(message ?? `CSV parse error: ${kind} at row ${row}, col ${col}`);
    this.name = kind;
  }
}
```

### WASM → JS Error Protocol

Error written to fixed memory location after `parse()`:

```
offset 0:   error_kind (u8)
offset 1:   reserved (u8)
offset 2-5: row (u32 LE)
offset 6-9: col (u32 LE)
```

## API

```odin
// Delimited parser
delimited_init       :: proc(opts: CsvOptions = {}) -> DelimitedParser
delimited_destroy    :: proc(p: ^DelimitedParser)
delimited_reset      :: proc(p: ^DelimitedParser)
delimited_parse      :: proc(p: ^DelimitedParser, input: []u8) -> (rows: u32, ok: bool)
delimited_finish     :: proc(p: ^DelimitedParser) -> (rows: u32, ok: bool)

// Span parser
span_init            :: proc(opts: CsvOptions = {}) -> SpanParser
span_destroy         :: proc(p: ^SpanParser)
span_reset           :: proc(p: ^SpanParser)
span_parse           :: proc(p: ^SpanParser, input: []u8, base_offset: u32 = 0) -> (rows: u32, ok: bool)
span_finish          :: proc(p: ^SpanParser, input_len: u32) -> (rows: u32, ok: bool)
```

## Test Cases

### Basic Parsing

```
a,b,c         → ["a", "b", "c"]
a,b,c\n       → ["a", "b", "c"]
a,b,c\r\n     → ["a", "b", "c"]
```

### Empty Fields

```
,b,c          → ["", "b", "c"]
a,,c          → ["a", "", "c"]
a,b,          → ["a", "b", ""]
```

### Quoted Fields

```
"a",b,c       → ["a", "b", "c"]
"a,b",c       → ["a,b", "c"]
"a\nb",c      → ["a\nb", "c"]
"a""b",c      → ["a\"b", "c"]
""            → [""]
""""          → ["\""]
```

### Multi-row

```
a,b\nc,d      → [["a","b"], ["c","d"]]
```

### Streaming Chunk Splits

```
chunk1: "abc"    chunk2: "def,g\n"   → ["abcdef", "g"]
chunk1: "\"abc"  chunk2: "def\",g\n" → ["abcdef", "g"]
chunk1: "\"a\""  chunk2: "\"b\",c\n" → ["a\"b", "c"]
chunk1: "a,b\r"  chunk2: "\nc,d\n"   → [["a","b"], ["c","d"]]
```

### Error Cases

```
# InvalidCharAfterQuote (always fatal)
"a"b,c        → InvalidCharAfterQuote(row=0, col=3)

# BareQuote (strict only)
a"b,c         → BareQuote(row=0, col=1)

# UnclosedQuote (strict only)
"abc          → UnclosedQuote(row=0, col=0)

# BareCR (strict only)
a,b\rc,d      → BareCR(row=0, col=3)

# FieldCountMismatch (strict + expected_fields=3)
a,b,c\nd,e    → FieldCountMismatch(row=1, col=0)
```

## Performance Notes

- Two separate implementations avoid branching in hot loop
- DelimitedParser: byte-by-byte copy with inline unescape
- SpanParser: only tracks offsets, no copying
- Future: SIMD scan for special characters (`,` `"` `\r` `\n`)
- Pre-size dynamic arrays based on input size estimate

---

# CSV Stringifier Specification

Convert structured data back to RFC 4180 compliant CSV text.

## Implementations

### 1. DelimitedStringifier

Converts delimited format (`\x1F`/`\x1E` separated) back to CSV.

```odin
DelimitedStringifier :: struct {
    opts:   StringifyOptions,
    output: [dynamic]u8,
    error:  CsvError,
}
```

### 2. SpanStringifier

Converts span-based data (original buffer + spans) back to CSV.

```odin
SpanStringifier :: struct {
    opts:   StringifyOptions,
    output: [dynamic]u8,
    error:  CsvError,
}
```

## Options

```odin
StringifyOptions :: struct {
    separator:       u8,    // Field delimiter, default ','
    line_ending:     LineEnding,  // CRLF or LF, default LF
    always_quote:    bool,  // Quote all fields, default false
    expected_fields: u32,   // Required field count, 0 = any
}

LineEnding :: enum u8 {
    LF,     // \n (Unix)
    CRLF,   // \r\n (Windows/RFC 4180)
}
```

## Quoting Rules

Fields are quoted when they contain:

- The separator character
- Double quote (`"`)
- Newline (`\n` or `\r`)

When `always_quote = true`, all fields are quoted regardless of content.

Quotes within fields are escaped as `""`.

## API

```odin
// Delimited stringifier
delimited_stringify_init    :: proc(opts: StringifyOptions = {}) -> DelimitedStringifier
delimited_stringify_destroy :: proc(s: ^DelimitedStringifier)
delimited_stringify_reset   :: proc(s: ^DelimitedStringifier)
delimited_stringify         :: proc(s: ^DelimitedStringifier, input: []u8) -> (ok: bool)
delimited_stringify_row     :: proc(s: ^DelimitedStringifier, fields: []string) -> (ok: bool)

// Span stringifier
span_stringify_init         :: proc(opts: StringifyOptions = {}) -> SpanStringifier
span_stringify_destroy      :: proc(s: ^SpanStringifier)
span_stringify_reset        :: proc(s: ^SpanStringifier)
span_stringify              :: proc(s: ^SpanStringifier, source: []u8, spans: []FieldSpan, row_ends: []u32) -> (ok: bool)
span_stringify_row          :: proc(s: ^SpanStringifier, source: []u8, spans: []FieldSpan) -> (ok: bool)
```

## Error Handling

```odin
StringifyErrorKind :: enum u8 {
    None = 0,
    FieldCountMismatch,     // Row has wrong field count (when expected_fields > 0)
    InvalidInput,           // Malformed delimited input
}
```

## Stringifier Test Cases

### Basic Output

```
["a", "b", "c"]           → a,b,c\n
[["a","b"], ["c","d"]]    → a,b\nc,d\n
```

### Quoting

```
["a,b", "c"]              → "a,b",c\n
["a\"b", "c"]             → "a""b",c\n
["a\nb", "c"]             → "a\nb",c\n
["a", "b"] (always_quote) → "a","b"\n
```

### Empty Fields

```
["", "b", ""]             → ,b,\n
[""]                      → ""\n  (or just \n?)
```

### Line Endings

```
["a","b"] (LF)            → a,b\n
["a","b"] (CRLF)          → a,b\r\n
```

### Custom Separator

```
["a","b","c"] (sep=\t)    → a\tb\tc\n
```

### Round-trip Tests

```
# Parse then stringify should preserve data
"a,b,c\n"                 → parse → stringify → "a,b,c\n"
"\"a,b\",c\n"             → parse → stringify → "\"a,b\",c\n"
"\"a\"\"b\",c\n"          → parse → stringify → "\"a\"\"b\",c\n"
```

### Error Cases

```
# FieldCountMismatch (expected_fields=3)
["a","b"]                 → FieldCountMismatch(row=0)

# InvalidInput (malformed delimited)
"a\x1Fb\x1E\x1E"          → InvalidInput (empty record marker)
```

---

# Test Coverage Requirements

## Parser Tests

### DelimitedParser

- [ ] Basic: single row, multiple fields
- [ ] Basic: multiple rows
- [ ] Basic: no trailing newline (finish flushes)
- [ ] Basic: CRLF line endings
- [ ] Basic: LF line endings
- [ ] Basic: mixed CRLF/LF (lenient)
- [ ] Empty: empty input
- [ ] Empty: empty fields (leading, middle, trailing comma)
- [ ] Empty: empty quoted field (`""`)
- [ ] Empty: row with only empty fields
- [ ] Quoted: simple quoted field
- [ ] Quoted: field containing comma
- [ ] Quoted: field containing newline
- [ ] Quoted: field containing CRLF
- [ ] Quoted: escaped quote (`""`)
- [ ] Quoted: multiple escaped quotes
- [ ] Quoted: only escaped quotes (`""""`)
- [ ] Streaming: chunk split mid-unquoted-field
- [ ] Streaming: chunk split mid-quoted-field
- [ ] Streaming: chunk split mid-escape (`"` then `"`)
- [ ] Streaming: chunk split mid-CRLF (`\r` then `\n`)
- [ ] Streaming: single byte chunks
- [ ] Options: custom separator (tab, pipe, semicolon)
- [ ] Options: strict mode enabled
- [ ] Options: expected_fields validation
- [ ] Error: bare quote in unquoted (strict)
- [ ] Error: bare quote in unquoted (lenient - accepts)
- [ ] Error: unclosed quote at EOF (strict)
- [ ] Error: unclosed quote at EOF (lenient - closes)
- [ ] Error: invalid char after closing quote (always fatal)
- [ ] Error: bare CR (strict)
- [ ] Error: bare CR (lenient - accepts)
- [ ] Error: field count mismatch (strict + expected)
- [ ] Error: field count mismatch (lenient - accepts)
- [ ] Error: error position (row, col) accuracy

### SpanParser

- [ ] All above tests adapted for span output
- [ ] Span: correct start/end offsets
- [ ] Span: quoted flag set correctly
- [ ] Span: row_ends indices correct
- [ ] Span: base_offset applied correctly

## Stringifier Tests

### DelimitedStringifier

- [ ] Basic: single row
- [ ] Basic: multiple rows
- [ ] Basic: empty fields
- [ ] Quoting: field with separator
- [ ] Quoting: field with quote (escaped)
- [ ] Quoting: field with newline
- [ ] Quoting: always_quote option
- [ ] Options: custom separator
- [ ] Options: CRLF line ending
- [ ] Options: LF line ending
- [ ] Options: expected_fields validation
- [ ] Error: field count mismatch
- [ ] Error: invalid delimited input

### SpanStringifier

- [ ] All above tests adapted for span input
- [ ] Span: handles quoted flag (unescapes `""`)
- [ ] Span: handles unquoted spans

## Round-trip Tests

- [ ] Parse (delimited) → Stringify → equals original
- [ ] Parse (span) → Stringify → equals original
- [ ] Various edge cases preserved through round-trip
