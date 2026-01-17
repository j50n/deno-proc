package csv

import "base:runtime"

/*
RFC 4180 Compliant CSV Push Parser
==================================

This module implements a streaming CSV parser designed for WASM environments.
It uses a "push parser" architecture where you feed chunks of input and receive
parsed output incrementally - ideal for processing large files with constant memory.

Output Format (Delimited)
-------------------------
Parsed output uses ASCII control characters for unambiguous field/record separation:
  - \x1F (Unit Separator) between fields within a record
  - \x1E (Record Separator) at the end of each record

Example: "Alice,30\nBob,25\n" → "Alice\x1FBob\x1E30\x1F25\x1E"

This format is trivial to parse downstream: split on \x1E for rows, \x1F for fields.

Parser Types
------------
1. DelimitedParser - Copies field content to output buffer with \x1F/\x1E separators.
   Best for: streaming to another process, when you need the actual text.

2. SpanParser - Records (start, end, flags) offsets into the original input.
   Best for: random access, when you want to avoid copying, or need to preserve
   the original input for reference.

3. DirectParser (in exports.odin) - Writes directly to output buffer without
   intermediate storage. Best for: maximum throughput in WASM streaming scenarios.

Stringifier Types
-----------------
1. DelimitedStringifier - Converts \x1F/\x1E delimited input back to CSV.
2. SpanStringifier - Converts span offsets back to CSV (requires original source).

Error Handling
--------------
Parsers track errors with row/column position. Error kinds:
  - BareQuote: Unescaped quote in unquoted field (strict mode)
  - UnclosedQuote: EOF inside quoted field (strict mode)
  - InvalidCharAfterQuote: Character other than separator/newline after closing quote
  - BareCR: Carriage return not followed by newline (strict mode)
  - FieldCountMismatch: Row has different field count than expected (strict mode)

Streaming Usage
---------------
1. Create parser with options (separator, strict mode, expected fields)
2. Call parse() with each input chunk - returns number of complete rows
3. Call get_output() to retrieve parsed data, then reset_output()
4. Call finish() after last chunk to flush any remaining data
5. Destroy parser to free resources
*/

// ASCII control characters for output format
FIELD_SEP :: 0x1F  // Unit Separator - delimits fields within a record
RECORD_SEP :: 0x1E // Record Separator - marks end of each record

// Parser state machine states
CsvState :: enum u8 {
    FieldStart,     // At start of a field (may be quoted or unquoted)
    Unquoted,       // Inside an unquoted field
    Quoted,         // Inside a quoted field
    QuoteInQuoted,  // Just saw a quote inside a quoted field (escape or end)
    RecordEnd,      // Just saw CR, expecting LF
}

// Error types that can occur during parsing
CsvErrorKind :: enum u8 {
    None = 0,
    BareQuote,           // Quote character in unquoted field (strict mode)
    UnclosedQuote,       // EOF reached inside quoted field (strict mode)
    InvalidCharAfterQuote, // Non-separator/newline after closing quote
    BareCR,              // CR not followed by LF (strict mode)
    FieldCountMismatch,  // Row has wrong number of fields (strict mode)
}

// Error details with position information
CsvError :: struct {
    kind: CsvErrorKind,
    row: u32,   // 0-indexed row where error occurred
    col: u32,   // 0-indexed column (byte offset in row)
}

// Parser configuration options
CsvOptions :: struct {
    separator: u8,        // Field separator character (default: ',')
    strict: bool,         // If true, errors on malformed input; if false, best-effort parsing
    expected_fields: u32, // If > 0, error when row has different field count (strict mode)
}

default_csv_options :: proc() -> CsvOptions {
    return CsvOptions{separator = ',', strict = false, expected_fields = 0}
}

/*
Delimited Output Parser
=======================
Parses CSV input and produces \x1F/\x1E delimited output.
Copies field content to an internal buffer - use when you need the text.

The parser maintains state between calls, allowing chunked input processing.
Only complete records are returned; incomplete records are buffered until
more input arrives or finish() is called.
*/

DelimitedParser :: struct {
    state: CsvState,
    row: u32,
    col: u32,
    fields_in_row: u32,
    opts: CsvOptions,
    error: CsvError,
    output: [dynamic]u8,
    row_started: bool,
    complete_output_len: int,  // Length of output containing only complete records
}

// Create a new delimited parser with the given options
delimited_init :: proc(opts := CsvOptions{}) -> DelimitedParser {
    o := opts
    if o.separator == 0 do o.separator = ','
    return DelimitedParser{
        state = .FieldStart,
        opts = o,
        output = make([dynamic]u8),
    }
}

// Free parser resources
delimited_destroy :: proc(p: ^DelimitedParser) {
    delete(p.output)
}

// Clear output buffer, preserving any incomplete record data for next parse call
delimited_reset_output :: proc(p: ^DelimitedParser) {
    // Keep incomplete record data, remove only complete records
    if p.complete_output_len > 0 && p.complete_output_len < len(p.output) {
        // Move incomplete data to start
        incomplete := p.output[p.complete_output_len:]
        copy(p.output[:len(incomplete)], incomplete)
        resize(&p.output, len(incomplete))
    } else {
        clear(&p.output)
    }
    p.complete_output_len = 0
}

// Get only complete records from output (excludes any partial record at end)
delimited_get_complete_output :: proc(p: ^DelimitedParser) -> []u8 {
    return p.output[:p.complete_output_len]
}

// Parse a chunk of CSV input. Returns (rows_completed, success).
// On error, check p.error for details. Call get_complete_output() to retrieve results.
delimited_parse :: proc(p: ^DelimitedParser, input: []u8) -> (rows: u32, ok: bool) {
    if p.error.kind != .None do return 0, false
    
    sep := p.opts.separator
    rows = 0
    n := len(input)
    
    // Pre-reserve to avoid reallocations during raw writes
    start_len := len(p.output)
    reserve(&p.output, start_len + n + n/10)
    // Get data pointer from dynamic array struct
    raw := (^runtime.Raw_Dynamic_Array)(&p.output)
    out_ptr := ([^]u8)(raw.data)
    out_len := start_len
    
    for i := 0; i < n; i += 1 {
        c := input[i]
        
        switch p.state {
        case .FieldStart:
            if c == '"' {
                if p.row_started { out_ptr[out_len] = FIELD_SEP; out_len += 1 }
                p.row_started = true
                p.state = .Quoted
            } else if c == sep {
                if p.row_started { out_ptr[out_len] = FIELD_SEP; out_len += 1 }
                p.row_started = true
                p.fields_in_row += 1
            } else if c == '\r' {
                if p.row_started {
                    out_ptr[out_len] = FIELD_SEP; out_len += 1
                    p.fields_in_row += 1
                }
                p.state = .RecordEnd
            } else if c == '\n' {
                if p.row_started {
                    out_ptr[out_len] = FIELD_SEP; out_len += 1
                    p.fields_in_row += 1
                }
                raw.len = out_len
                rows += delimited_emit_record(p)
                out_len = raw.len  // emit_record may have appended
                out_ptr = ([^]u8)(raw.data)  // refresh pointer
                if p.error.kind != .None do return rows, false
            } else {
                if p.row_started { out_ptr[out_len] = FIELD_SEP; out_len += 1 }
                p.row_started = true
                out_ptr[out_len] = c; out_len += 1
                p.state = .Unquoted
            }
            
        case .Unquoted:
            if c == sep {
                p.fields_in_row += 1
                p.state = .FieldStart
            } else if c == '\r' {
                p.fields_in_row += 1
                p.state = .RecordEnd
            } else if c == '\n' {
                p.fields_in_row += 1
                raw.len = out_len
                rows += delimited_emit_record(p)
                out_len = raw.len
                out_ptr = ([^]u8)(raw.data)
                if p.error.kind != .None do return rows, false
                p.state = .FieldStart
            } else if c == '"' && p.opts.strict {
                raw.len = out_len
                p.error = CsvError{.BareQuote, p.row, p.col}
                return rows, false
            } else {
                out_ptr[out_len] = c; out_len += 1
            }
            
        case .Quoted:
            if c == '"' {
                p.state = .QuoteInQuoted
            } else {
                out_ptr[out_len] = c; out_len += 1
            }
            
        case .QuoteInQuoted:
            if c == '"' {
                out_ptr[out_len] = '"'; out_len += 1
                p.state = .Quoted
            } else if c == sep {
                p.fields_in_row += 1
                p.state = .FieldStart
            } else if c == '\r' {
                p.fields_in_row += 1
                p.state = .RecordEnd
            } else if c == '\n' {
                p.fields_in_row += 1
                raw.len = out_len
                rows += delimited_emit_record(p)
                out_len = raw.len
                out_ptr = ([^]u8)(raw.data)
                if p.error.kind != .None do return rows, false
                p.state = .FieldStart
            } else {
                raw.len = out_len
                p.error = CsvError{.InvalidCharAfterQuote, p.row, p.col}
                return rows, false
            }
            
        case .RecordEnd:
            if c == '\n' {
                raw.len = out_len
                rows += delimited_emit_record(p)
                out_len = raw.len
                out_ptr = ([^]u8)(raw.data)
                if p.error.kind != .None do return rows, false
                p.state = .FieldStart
            } else if p.opts.strict {
                raw.len = out_len
                p.error = CsvError{.BareCR, p.row, p.col}
                return rows, false
            } else {
                raw.len = out_len
                rows += delimited_emit_record(p)
                out_len = raw.len
                out_ptr = ([^]u8)(raw.data)
                if p.error.kind != .None do return rows, false
                p.state = .FieldStart
                i -= 1  // Re-process
            }
        }
        p.col += 1
    }
    
    raw.len = out_len
    return rows, true
}

// Finalize parsing after all input has been provided.
// Flushes any remaining partial record. Returns (rows_completed, success).
delimited_finish :: proc(p: ^DelimitedParser) -> (rows: u32, ok: bool) {
    if p.error.kind != .None do return 0, false
    
    switch p.state {
    case .Quoted:
        if p.opts.strict {
            p.error = CsvError{.UnclosedQuote, p.row, p.col}
            return 0, false
        }
        p.fields_in_row += 1
        return delimited_emit_record(p), true
        
    case .QuoteInQuoted:
        p.fields_in_row += 1
        return delimited_emit_record(p), true
        
    case .Unquoted:
        p.fields_in_row += 1
        return delimited_emit_record(p), true
        
    case .RecordEnd:
        return delimited_emit_record(p), true
        
    case .FieldStart:
        if p.row_started {
            return delimited_emit_record(p), true
        }
    }
    
    return 0, true
}

@(private)
delimited_emit_record :: proc(p: ^DelimitedParser) -> u32 {
    if p.opts.expected_fields > 0 && p.fields_in_row != p.opts.expected_fields {
        if p.opts.strict {
            p.error = CsvError{.FieldCountMismatch, p.row, 0}
            return 0
        }
    }
    
    if !p.row_started && p.fields_in_row == 0 {
        return 0
    }
    
    append(&p.output, RECORD_SEP)
    p.complete_output_len = len(p.output)
    p.row += 1
    p.col = 0
    p.fields_in_row = 0
    p.row_started = false
    return 1
}

/*
Span Output Parser (Zero-Copy)
==============================
Parses CSV and records field positions as (start, end, flags) tuples.
Does NOT copy field content - just records offsets into the original input.

Use when:
- You need random access to fields
- You want to avoid copying data
- You need to preserve the original input

The spans reference positions in the input buffer, so the input must remain
valid while using the spans. For streaming, use base_offset parameter to
adjust span positions across chunks.
*/

// A field's position in the source buffer
FieldSpan :: struct {
    start: u32,  // Start offset (inclusive)
    end: u32,    // End offset (exclusive)
    flags: u8,   // Bit 0: quoted (field content needs quote unescaping)
}

SPAN_FLAG_QUOTED :: u8(1)  // Field was quoted; content may contain escaped quotes ("")

SpanParser :: struct {
    state: CsvState,
    row: u32,
    col: u32,
    field_start: u32,
    fields_in_row: u32,
    opts: CsvOptions,
    error: CsvError,
    spans: [dynamic]FieldSpan,  // All field spans
    row_ends: [dynamic]u32,     // Index into spans where each row ends
    is_quoted: bool,
    base_offset: u32,           // Offset added to all spans (for streaming across chunks)
}

// Create a new span parser with the given options
span_init :: proc(opts := CsvOptions{}) -> SpanParser {
    o := opts
    if o.separator == 0 do o.separator = ','
    return SpanParser{
        state = .FieldStart,
        opts = o,
        spans = make([dynamic]FieldSpan),
        row_ends = make([dynamic]u32),
    }
}

span_destroy :: proc(p: ^SpanParser) {
    delete(p.spans)
    delete(p.row_ends)
}

span_reset_output :: proc(p: ^SpanParser) {
    clear(&p.spans)
    clear(&p.row_ends)
}

span_parse :: proc(p: ^SpanParser, input: []u8, base_offset: u32 = 0) -> (rows: u32, ok: bool) {
    if p.error.kind != .None do return 0, false
    
    sep := p.opts.separator
    p.base_offset = base_offset
    rows = 0
    i := u32(0)
    n := u32(len(input))
    
    for i < n {
        c := input[i]
        
        switch p.state {
        case .FieldStart:
            p.field_start = i
            p.is_quoted = false
            
            if c == '"' {
                p.is_quoted = true
                p.field_start = i + 1  // skip opening quote
                p.state = .Quoted
                p.col += 1
            } else if c == sep {
                // Empty field
                span_emit_field(p, i, i)
                p.col += 1
            } else if c == '\r' {
                span_emit_field(p, i, i)  // empty field
                p.state = .RecordEnd
            } else if c == '\n' {
                span_emit_field(p, i, i)  // empty field
                rows += span_emit_record(p)
                if p.error.kind != .None do return rows, false
            } else {
                p.state = .Unquoted
                p.col += 1
            }
            
        case .Unquoted:
            if c == sep {
                span_emit_field(p, p.field_start, i)
                p.state = .FieldStart
                p.col += 1
            } else if c == '\r' {
                span_emit_field(p, p.field_start, i)
                p.state = .RecordEnd
            } else if c == '\n' {
                span_emit_field(p, p.field_start, i)
                rows += span_emit_record(p)
                if p.error.kind != .None do return rows, false
                p.state = .FieldStart
            } else if c == '"' && p.opts.strict {
                p.error = CsvError{.BareQuote, p.row, p.col}
                return rows, false
            } else {
                p.col += 1
            }
            
        case .Quoted:
            if c == '"' {
                p.state = .QuoteInQuoted
            } else if c == '\n' {
                p.col = 0
            } else {
                p.col += 1
            }
            
        case .QuoteInQuoted:
            if c == '"' {
                // Escaped quote - stay in quoted, field contains ""
                p.state = .Quoted
                p.col += 1
            } else if c == sep {
                span_emit_field(p, p.field_start, i - 1)  // exclude closing quote
                p.state = .FieldStart
                p.col += 1
            } else if c == '\r' {
                span_emit_field(p, p.field_start, i - 1)
                p.state = .RecordEnd
            } else if c == '\n' {
                span_emit_field(p, p.field_start, i - 1)
                rows += span_emit_record(p)
                if p.error.kind != .None do return rows, false
                p.state = .FieldStart
            } else {
                p.error = CsvError{.InvalidCharAfterQuote, p.row, p.col}
                return rows, false
            }
            
        case .RecordEnd:
            if c == '\n' {
                rows += span_emit_record(p)
                if p.error.kind != .None do return rows, false
                p.state = .FieldStart
            } else if p.opts.strict {
                p.error = CsvError{.BareCR, p.row, p.col}
                return rows, false
            } else {
                rows += span_emit_record(p)
                if p.error.kind != .None do return rows, false
                p.state = .FieldStart
                continue
            }
        }
        i += 1
    }
    
    return rows, true
}

span_finish :: proc(p: ^SpanParser, input_len: u32) -> (rows: u32, ok: bool) {
    if p.error.kind != .None do return 0, false
    
    switch p.state {
    case .Quoted:
        if p.opts.strict {
            p.error = CsvError{.UnclosedQuote, p.row, p.col}
            return 0, false
        }
        span_emit_field(p, p.field_start, input_len)
        return span_emit_record(p), true
        
    case .QuoteInQuoted:
        span_emit_field(p, p.field_start, input_len - 1)
        return span_emit_record(p), true
        
    case .Unquoted:
        span_emit_field(p, p.field_start, input_len)
        return span_emit_record(p), true
        
    case .RecordEnd:
        return span_emit_record(p), true
        
    case .FieldStart:
        if p.fields_in_row > 0 {
            return span_emit_record(p), true
        }
    }
    
    return 0, true
}

@(private)
span_emit_field :: proc(p: ^SpanParser, start, end: u32) {
    flags: u8 = SPAN_FLAG_QUOTED if p.is_quoted else 0
    append(&p.spans, FieldSpan{
        start = start + p.base_offset,
        end = end + p.base_offset,
        flags = flags,
    })
    p.fields_in_row += 1
}

@(private)
span_emit_record :: proc(p: ^SpanParser) -> u32 {
    if p.opts.expected_fields > 0 && p.fields_in_row != p.opts.expected_fields {
        if p.opts.strict {
            p.error = CsvError{.FieldCountMismatch, p.row, 0}
            return 0
        }
    }
    
    if p.fields_in_row == 0 {
        return 0
    }
    
    append(&p.row_ends, u32(len(p.spans)))
    p.row += 1
    p.col = 0
    p.fields_in_row = 0
    return 1
}


/*
Stringifier Types
=================
Convert parsed data back to CSV format.

DelimitedStringifier: Takes \x1F/\x1E delimited input, outputs RFC 4180 CSV.
SpanStringifier: Takes spans + source buffer, outputs RFC 4180 CSV.

Both handle proper quoting: fields containing separator, quote, or newline
characters are quoted, and internal quotes are escaped as "".
*/

// Line ending style for output
LineEnding :: enum u8 {
    LF,    // Unix style: \n
    CRLF,  // Windows/RFC 4180 style: \r\n
}

// Stringifier configuration
StringifyOptions :: struct {
    separator:       u8,          // Field separator (default: ',')
    line_ending:     LineEnding,  // Line ending style (default: LF)
    always_quote:    bool,        // If true, quote all fields; if false, quote only when needed
    expected_fields: u32,         // If > 0, error when row has different field count
}

// Stringifier error types
StringifyErrorKind :: enum u8 {
    None = 0,
    FieldCountMismatch,  // Row has wrong number of fields
    InvalidInput,        // Malformed input data
}

StringifyError :: struct {
    kind: StringifyErrorKind,
    row:  u32,  // Row where error occurred
}

/*
Delimited Stringifier
---------------------
Converts \x1F/\x1E delimited input back to RFC 4180 CSV.
*/

DelimitedStringifier :: struct {
    opts:   StringifyOptions,
    output: [dynamic]u8,
    error:  StringifyError,
    row:    u32,
}

delimited_stringify_init :: proc(opts := StringifyOptions{}) -> DelimitedStringifier {
    o := opts
    if o.separator == 0 do o.separator = ','
    return DelimitedStringifier{
        opts = o,
        output = make([dynamic]u8),
    }
}

delimited_stringify_destroy :: proc(s: ^DelimitedStringifier) {
    delete(s.output)
}

delimited_stringify_reset :: proc(s: ^DelimitedStringifier) {
    clear(&s.output)
    s.error = {}
    s.row = 0
}

// Stringify delimited input (fields separated by \x1F, records by \x1E).
// Returns true on success, false on error (check s.error for details).
delimited_stringify :: proc(s: ^DelimitedStringifier, input: []u8) -> bool {
    if s.error.kind != .None do return false
    if len(input) == 0 do return true
    
    sep := s.opts.separator
    i := 0
    n := len(input)
    field_start := 0
    fields_in_row: u32 = 0
    first_field := true
    
    for i < n {
        c := input[i]
        
        if c == FIELD_SEP || c == RECORD_SEP {
            field := input[field_start:i]
            
            if !first_field {
                append(&s.output, sep)
            }
            first_field = false
            
            write_field(s, field)
            fields_in_row += 1
            
            if c == RECORD_SEP {
                // Check field count
                if s.opts.expected_fields > 0 && fields_in_row != s.opts.expected_fields {
                    s.error = StringifyError{.FieldCountMismatch, s.row}
                    return false
                }
                
                // Write line ending
                if s.opts.line_ending == .CRLF {
                    append(&s.output, '\r')
                }
                append(&s.output, '\n')
                
                s.row += 1
                fields_in_row = 0
                first_field = true
            }
            
            field_start = i + 1
        }
        
        i += 1
    }
    
    return true
}

// Write a single CSV field with proper RFC 4180 quoting/escaping
// Public helper for encoding individual fields
write_csv_field :: proc(output: ^[dynamic]u8, field: []u8, separator: u8, always_quote := false) {
    needs_quote := always_quote
    
    // Check if quoting needed
    if !needs_quote {
        for c in field {
            if c == separator || c == '"' || c == '\n' || c == '\r' {
                needs_quote = true
                break
            }
        }
    }
    
    if needs_quote {
        append(output, '"')
        for c in field {
            if c == '"' {
                append(output, '"', '"')
            } else {
                append(output, c)
            }
        }
        append(output, '"')
    } else {
        append(output, ..field)
    }
}

@(private)
write_field :: proc(s: ^DelimitedStringifier, field: []u8) {
    write_csv_field(&s.output, field, s.opts.separator, s.opts.always_quote)
}

/*
Span Stringifier
----------------
Converts span offsets back to RFC 4180 CSV.
Requires the original source buffer that the spans reference.
*/

SpanStringifier :: struct {
    opts:   StringifyOptions,
    output: [dynamic]u8,
    error:  StringifyError,
    row:    u32,
}

span_stringify_init :: proc(opts := StringifyOptions{}) -> SpanStringifier {
    o := opts
    if o.separator == 0 do o.separator = ','
    return SpanStringifier{
        opts = o,
        output = make([dynamic]u8),
    }
}

span_stringify_destroy :: proc(s: ^SpanStringifier) {
    delete(s.output)
}

span_stringify_reset :: proc(s: ^SpanStringifier) {
    clear(&s.output)
    s.error = {}
    s.row = 0
}

// Stringify from spans and source buffer
span_stringify :: proc(s: ^SpanStringifier, source: []u8, spans: []FieldSpan, row_ends: []u32) -> bool {
    if s.error.kind != .None do return false
    
    sep := s.opts.separator
    span_idx: u32 = 0
    prev_row_end: u32 = 0
    
    for row_idx := 0; row_idx < len(row_ends); row_idx += 1 {
        row_end := row_ends[row_idx]
        fields_in_row := row_end - prev_row_end
        
        // Check field count
        if s.opts.expected_fields > 0 && fields_in_row != s.opts.expected_fields {
            s.error = StringifyError{.FieldCountMismatch, s.row}
            return false
        }
        
        first := true
        for span_idx < row_end {
            if !first {
                append(&s.output, sep)
            }
            first = false
            
            span := spans[span_idx]
            field := source[span.start:span.end]
            is_quoted := (span.flags & SPAN_FLAG_QUOTED) != 0
            
            write_span_field(s, field, is_quoted)
            span_idx += 1
        }
        
        // Write line ending
        if s.opts.line_ending == .CRLF {
            append(&s.output, '\r')
        }
        append(&s.output, '\n')
        
        s.row += 1
        prev_row_end = row_end
    }
    
    return true
}

@(private)
write_span_field :: proc(s: ^SpanStringifier, field: []u8, was_quoted: bool) {
    needs_quote := s.opts.always_quote
    sep := s.opts.separator
    has_escaped_quotes := false
    
    // Check if quoting needed
    if !needs_quote {
        for i := 0; i < len(field); i += 1 {
            c := field[i]
            if c == sep || c == '\n' || c == '\r' {
                needs_quote = true
            }
            if c == '"' {
                needs_quote = true
                // Check for escaped quote
                if was_quoted && i + 1 < len(field) && field[i + 1] == '"' {
                    has_escaped_quotes = true
                }
            }
        }
    }
    
    if needs_quote {
        append(&s.output, '"')
        if was_quoted && has_escaped_quotes {
            // Field contains "" sequences, copy as-is (already escaped)
            append(&s.output, ..field)
        } else if was_quoted {
            // Was quoted but no escapes, just copy
            append(&s.output, ..field)
        } else {
            // Need to escape any quotes
            for c in field {
                if c == '"' {
                    append(&s.output, '"', '"')
                } else {
                    append(&s.output, c)
                }
            }
        }
        append(&s.output, '"')
    } else {
        append(&s.output, ..field)
    }
}


/*
LazyRow Binary Format Encoder/Decoder
======================================

Binary format optimized for random field access without parsing.
Each row is encoded as:
  - [row_length: u32] Total bytes for this row (little-endian)
  - [field_count: u32] Number of fields (little-endian)
  - [field_lengths: u32[]] Length of each field (little-endian)
  - [field_data: bytes] Concatenated field data

Benefits:
  - O(1) access to any field by index
  - No string parsing needed for field access
  - Efficient for columnar operations

Trade-offs:
  - Larger file size (~20-30% overhead for metadata)
  - Binary format (not human-readable)
*/

LazyRowEncoder :: struct {
    output: [dynamic]u8,
}

lazyrow_encoder_init :: proc() -> LazyRowEncoder {
    return LazyRowEncoder{
        output = make([dynamic]u8),
    }
}

lazyrow_encoder_destroy :: proc(e: ^LazyRowEncoder) {
    delete(e.output)
}

lazyrow_encoder_reset :: proc(e: ^LazyRowEncoder) {
    clear(&e.output)
}

// Encode record format (\x1F/\x1E delimited) to binary lazyrow format.
// Processes all complete records in input, returns number of bytes written.
lazyrow_encode :: proc(e: ^LazyRowEncoder, input: []u8) -> int {
    if len(input) == 0 do return 0
    
    start_len := len(e.output)
    i := 0
    n := len(input)
    field_start := 0
    fields: [dynamic][]u8
    defer delete(fields)
    
    for i < n {
        c := input[i]
        
        if c == FIELD_SEP {
            append(&fields, input[field_start:i])
            field_start = i + 1
        } else if c == RECORD_SEP {
            // Add final field
            append(&fields, input[field_start:i])
            
            // Encode this row
            encode_row(e, fields[:])
            
            // Reset for next row
            clear(&fields)
            field_start = i + 1
        }
        
        i += 1
    }
    
    return len(e.output) - start_len
}

@(private)
encode_row :: proc(e: ^LazyRowEncoder, fields: [][]u8) {
    field_count := u32(len(fields))
    data_size := 0
    for f in fields {
        data_size += len(f)
    }
    
    header_size := 4 + int(field_count) * 4  // field_count + field_lengths array
    row_length := u32(header_size + data_size)
    
    // Write row_length
    append(&e.output, u8(row_length), u8(row_length >> 8), u8(row_length >> 16), u8(row_length >> 24))
    
    // Write field_count
    append(&e.output, u8(field_count), u8(field_count >> 8), u8(field_count >> 16), u8(field_count >> 24))
    
    // Write field lengths
    for f in fields {
        flen := u32(len(f))
        append(&e.output, u8(flen), u8(flen >> 8), u8(flen >> 16), u8(flen >> 24))
    }
    
    // Write field data
    for f in fields {
        append(&e.output, ..f)
    }
}

LazyRowDecoder :: struct {
    output: [dynamic]u8,
    consumed: int,  // Track how many input bytes were consumed
}

lazyrow_decoder_init :: proc() -> LazyRowDecoder {
    return LazyRowDecoder{
        output = make([dynamic]u8),
        consumed = 0,
    }
}

lazyrow_decoder_destroy :: proc(d: ^LazyRowDecoder) {
    delete(d.output)
}

lazyrow_decoder_reset :: proc(d: ^LazyRowDecoder) {
    clear(&d.output)
    d.consumed = 0
}

// Decode binary lazyrow format to record format (\x1F/\x1E delimited).
// Processes all complete rows in input, returns number of bytes written.
// Use d.consumed to get how many input bytes were processed.
lazyrow_decode :: proc(d: ^LazyRowDecoder, input: []u8) -> int {
    if len(input) < 4 do return 0
    
    start_len := len(d.output)
    i := 0
    n := len(input)
    
    for i + 4 <= n {
        // Read row_length
        row_length := u32(input[i]) | (u32(input[i+1]) << 8) | (u32(input[i+2]) << 16) | (u32(input[i+3]) << 24)
        
        // Check if we have the complete row
        if i + 4 + int(row_length) > n {
            break
        }
        
        row_data := input[i+4 : i+4+int(row_length)]
        decode_row(d, row_data)
        
        i += 4 + int(row_length)
    }
    
    d.consumed = i
    return len(d.output) - start_len
}

@(private)
decode_row :: proc(d: ^LazyRowDecoder, row_data: []u8) {
    if len(row_data) < 4 do return
    
    // Read field_count
    field_count := u32(row_data[0]) | (u32(row_data[1]) << 8) | (u32(row_data[2]) << 16) | (u32(row_data[3]) << 24)
    
    header_size := 4 + int(field_count) * 4
    if len(row_data) < header_size do return
    
    // Read field lengths
    field_lengths := make([]u32, field_count)
    defer delete(field_lengths)
    
    for i := 0; i < int(field_count); i += 1 {
        offset := 4 + i * 4
        field_lengths[i] = u32(row_data[offset]) | (u32(row_data[offset+1]) << 8) | 
                          (u32(row_data[offset+2]) << 16) | (u32(row_data[offset+3]) << 24)
    }
    
    // Write fields to output
    data_offset := header_size
    for i := 0; i < int(field_count); i += 1 {
        flen := int(field_lengths[i])
        if data_offset + flen > len(row_data) do return
        
        // Write field data
        append(&d.output, ..row_data[data_offset:data_offset+flen])
        
        // Write separator
        if i < int(field_count) - 1 {
            append(&d.output, FIELD_SEP)
        } else {
            append(&d.output, RECORD_SEP)
        }
        
        data_offset += flen
    }
}

// Decode binary lazyrow format directly to delimited output.
// Like lazyrow_decode but outputs with custom field/record separators.
lazyrow_decode_delimited :: proc(d: ^LazyRowDecoder, input: []u8, field_sep: u8, record_sep: u8) -> int {
    if len(input) < 4 do return 0
    
    start_len := len(d.output)
    i := 0
    n := len(input)
    
    for i + 4 <= n {
        // Read row_length
        row_length := u32(input[i]) | (u32(input[i+1]) << 8) | (u32(input[i+2]) << 16) | (u32(input[i+3]) << 24)
        
        // Check if we have the complete row
        if i + 4 + int(row_length) > n {
            break
        }
        
        row_data := input[i+4 : i+4+int(row_length)]
        decode_row_delimited(d, row_data, field_sep, record_sep)
        
        i += 4 + int(row_length)
    }
    
    d.consumed = i
    return len(d.output) - start_len
}

@(private)
decode_row_delimited :: proc(d: ^LazyRowDecoder, row_data: []u8, field_sep: u8, record_sep: u8) {
    if len(row_data) < 4 do return
    
    // Read field_count
    field_count := u32(row_data[0]) | (u32(row_data[1]) << 8) | (u32(row_data[2]) << 16) | (u32(row_data[3]) << 24)
    
    header_size := 4 + int(field_count) * 4
    if len(row_data) < header_size do return
    
    // Read field lengths
    field_lengths := make([]u32, field_count)
    defer delete(field_lengths)
    
    for i := 0; i < int(field_count); i += 1 {
        offset := 4 + i * 4
        field_lengths[i] = u32(row_data[offset]) | (u32(row_data[offset+1]) << 8) | 
                          (u32(row_data[offset+2]) << 16) | (u32(row_data[offset+3]) << 24)
    }
    
    // Write fields to output with custom separators
    data_offset := header_size
    for i := 0; i < int(field_count); i += 1 {
        flen := int(field_lengths[i])
        if data_offset + flen > len(row_data) do return
        
        // Write field data
        append(&d.output, ..row_data[data_offset:data_offset+flen])
        
        // Write separator
        if i < int(field_count) - 1 {
            append(&d.output, field_sep)
        } else {
            append(&d.output, record_sep)
        }
        
        data_offset += flen
    }
}


/*
Streaming LazyRow Decoder
=========================
High-performance streaming decoder that:
- Accepts arbitrary input chunks (buffers incomplete rows internally)
- Accumulates output until threshold before returning
- Uses dynamic field_lengths array (no artificial limits)

Designed for maximum throughput with minimal JS↔WASM boundary crossings.
*/

OUTPUT_THRESHOLD :: 64 * 1024  // Accumulate at least 64KB before returning

StreamingLazyRowDecoder :: struct {
    output: [dynamic]u8,
    carry: [dynamic]u8,  // Buffer for incomplete row data between chunks
    field_lengths: [dynamic]u32,  // Reusable field lengths array
    field_sep: u8,
    record_sep: u8,
}

streaming_lazyrow_decoder_init :: proc(field_sep: u8, record_sep: u8) -> StreamingLazyRowDecoder {
    return StreamingLazyRowDecoder{
        output = make([dynamic]u8),
        carry = make([dynamic]u8),
        field_lengths = make([dynamic]u32),
        field_sep = field_sep,
        record_sep = record_sep,
    }
}

streaming_lazyrow_decoder_destroy :: proc(d: ^StreamingLazyRowDecoder) {
    delete(d.output)
    delete(d.carry)
    delete(d.field_lengths)
}

// Decode a chunk of lazyrow binary data. Returns bytes written to output.
// Buffers incomplete rows internally. Output accumulates until >= OUTPUT_THRESHOLD.
// Call streaming_lazyrow_get_output() to retrieve output, then streaming_lazyrow_clear_output().
streaming_lazyrow_decode :: proc(d: ^StreamingLazyRowDecoder, input: []u8) -> int {
    start_len := len(d.output)
    
    // Combine carry buffer with new input
    total_len := len(d.carry) + len(input)
    if total_len < 4 {
        append(&d.carry, ..input)
        return 0
    }
    
    // Work buffer: carry + input
    data: []u8
    temp_buf: [dynamic]u8
    if len(d.carry) > 0 {
        reserve(&temp_buf, total_len)
        append(&temp_buf, ..d.carry[:])
        append(&temp_buf, ..input)
        data = temp_buf[:]
        clear(&d.carry)
    } else {
        data = input
    }
    defer delete(temp_buf)
    
    i := 0
    n := len(data)
    
    rows_decoded := 0
    for i + 4 <= n {
        // Read row_length (little-endian u32)
        row_length := u32(data[i]) | (u32(data[i+1]) << 8) | (u32(data[i+2]) << 16) | (u32(data[i+3]) << 24)
        total_row_size := 4 + int(row_length)
        
        // Check if we have the complete row
        if i + total_row_size > n {
            break
        }
        
        // Decode this row directly to output
        row_data := data[i+4 : i+total_row_size]
        streaming_decode_row(d, row_data)
        rows_decoded += 1
        
        i += total_row_size
    }
    
    // Save incomplete data to carry buffer
    if i < n {
        append(&d.carry, ..data[i:])
    }
    
    return len(d.output) - start_len
}

@(private)
streaming_decode_row :: proc(d: ^StreamingLazyRowDecoder, row_data: []u8) {
    if len(row_data) < 4 do return
    
    // Read field_count
    field_count := int(u32(row_data[0]) | (u32(row_data[1]) << 8) | (u32(row_data[2]) << 16) | (u32(row_data[3]) << 24))
    
    header_size := 4 + field_count * 4
    if len(row_data) < header_size do return
    
    // Ensure field_lengths array is large enough
    if len(d.field_lengths) < field_count {
        resize(&d.field_lengths, field_count)
    }
    
    // Read field lengths
    for i := 0; i < field_count; i += 1 {
        offset := 4 + i * 4
        d.field_lengths[i] = u32(row_data[offset]) | (u32(row_data[offset+1]) << 8) | 
                            (u32(row_data[offset+2]) << 16) | (u32(row_data[offset+3]) << 24)
    }
    
    // Write fields to output
    data_offset := header_size
    for i := 0; i < field_count; i += 1 {
        flen := int(d.field_lengths[i])
        if data_offset + flen > len(row_data) do return
        
        append(&d.output, ..row_data[data_offset:data_offset+flen])
        
        if i < field_count - 1 {
            append(&d.output, d.field_sep)
        } else {
            append(&d.output, d.record_sep)
        }
        
        data_offset += flen
    }
}

// Check if output has reached threshold
streaming_lazyrow_has_output :: proc(d: ^StreamingLazyRowDecoder) -> bool {
    return len(d.output) >= OUTPUT_THRESHOLD
}

// Get current output length
streaming_lazyrow_output_len :: proc(d: ^StreamingLazyRowDecoder) -> int {
    return len(d.output)
}

// Clear output buffer after reading
streaming_lazyrow_clear_output :: proc(d: ^StreamingLazyRowDecoder) {
    clear(&d.output)
}

// Flush any remaining data (call at end of stream)
streaming_lazyrow_finish :: proc(d: ^StreamingLazyRowDecoder) -> int {
    if len(d.carry) == 0 do return len(d.output)
    
    // Process any remaining complete rows in carry buffer
    start_len := len(d.output)
    data := d.carry[:]
    i := 0
    n := len(data)
    
    for i + 4 <= n {
        row_length := u32(data[i]) | (u32(data[i+1]) << 8) | (u32(data[i+2]) << 16) | (u32(data[i+3]) << 24)
        total_row_size := 4 + int(row_length)
        
        if i + total_row_size > n do break
        
        row_data := data[i+4 : i+total_row_size]
        streaming_decode_row(d, row_data)
        
        i += total_row_size
    }
    
    clear(&d.carry)
    return len(d.output) - start_len
}


/*
Streaming Record Stringifier
============================
High-performance streaming converter from record format to delimited output.
- Accepts arbitrary input chunks (buffers incomplete records internally)
- Accumulates output until threshold before returning
- Handles proper CSV quoting when needed
*/

StreamingRecordStringifier :: struct {
    output: [dynamic]u8,
    carry: [dynamic]u8,  // Buffer for incomplete record data between chunks
    field_sep: u8,       // Input field separator (default \x1F)
    record_sep: u8,      // Input record separator (default \x1E)
    out_sep: u8,         // Output field separator
    line_ending: LineEnding,
    always_quote: bool,
}

streaming_record_stringifier_init :: proc(out_sep: u8, field_sep: u8, record_sep: u8, crlf: bool, always_quote: bool) -> StreamingRecordStringifier {
    return StreamingRecordStringifier{
        output = make([dynamic]u8),
        carry = make([dynamic]u8),
        field_sep = field_sep if field_sep > 0 else FIELD_SEP,
        record_sep = record_sep if record_sep > 0 else RECORD_SEP,
        out_sep = out_sep if out_sep > 0 else ',',
        line_ending = .CRLF if crlf else .LF,
        always_quote = always_quote,
    }
}

streaming_record_stringifier_destroy :: proc(s: ^StreamingRecordStringifier) {
    delete(s.output)
    delete(s.carry)
}

OUTPUT_THRESHOLD_STRINGIFY :: 64 * 1024

// Stringify a chunk of record format data. Returns bytes written to output.
streaming_record_stringify :: proc(s: ^StreamingRecordStringifier, input: []u8) -> int {
    start_len := len(s.output)
    
    // Combine carry buffer with new input
    total_len := len(s.carry) + len(input)
    if total_len == 0 do return 0
    
    // Work buffer: carry + input
    data: []u8
    temp_buf: [dynamic]u8
    if len(s.carry) > 0 {
        reserve(&temp_buf, total_len)
        append(&temp_buf, ..s.carry[:])
        append(&temp_buf, ..input)
        data = temp_buf[:]
        clear(&s.carry)
    } else {
        data = input
    }
    defer delete(temp_buf)
    
    // Find last complete record
    last_record_end := -1
    for i := len(data) - 1; i >= 0; i -= 1 {
        if data[i] == s.record_sep {
            last_record_end = i
            break
        }
    }
    
    if last_record_end < 0 {
        // No complete records, save everything to carry
        append(&s.carry, ..data)
        return 0
    }
    
    // Process complete records
    complete_data := data[:last_record_end + 1]
    field_start := 0
    first_field_in_row := true
    
    for i := 0; i < len(complete_data); i += 1 {
        c := complete_data[i]
        
        if c == s.field_sep || c == s.record_sep {
            field := complete_data[field_start:i]
            
            if !first_field_in_row {
                append(&s.output, s.out_sep)
            }
            first_field_in_row = false
            
            // Check if quoting needed
            needs_quote := s.always_quote
            if !needs_quote {
                for b in field {
                    if b == s.out_sep || b == '"' || b == '\n' || b == '\r' {
                        needs_quote = true
                        break
                    }
                }
            }
            
            if needs_quote {
                append(&s.output, '"')
                for b in field {
                    if b == '"' {
                        append(&s.output, '"', '"')
                    } else {
                        append(&s.output, b)
                    }
                }
                append(&s.output, '"')
            } else {
                append(&s.output, ..field)
            }
            
            if c == s.record_sep {
                if s.line_ending == .CRLF {
                    append(&s.output, '\r')
                }
                append(&s.output, '\n')
                first_field_in_row = true
            }
            
            field_start = i + 1
        }
    }
    
    // Save incomplete record to carry
    if last_record_end + 1 < len(data) {
        append(&s.carry, ..data[last_record_end + 1:])
    }
    
    return len(s.output) - start_len
}

streaming_record_has_output :: proc(s: ^StreamingRecordStringifier) -> bool {
    return len(s.output) >= OUTPUT_THRESHOLD_STRINGIFY
}

streaming_record_output_len :: proc(s: ^StreamingRecordStringifier) -> int {
    return len(s.output)
}

streaming_record_clear_output :: proc(s: ^StreamingRecordStringifier) {
    clear(&s.output)
}

streaming_record_finish :: proc(s: ^StreamingRecordStringifier) -> int {
    if len(s.carry) == 0 do return len(s.output)
    
    // Process remaining data as final record (even if no trailing separator)
    data := s.carry[:]
    field_start := 0
    first_field_in_row := true
    has_content := false
    
    for i := 0; i < len(data); i += 1 {
        c := data[i]
        
        if c == s.field_sep || c == s.record_sep {
            field := data[field_start:i]
            has_content = true
            
            if !first_field_in_row {
                append(&s.output, s.out_sep)
            }
            first_field_in_row = false
            
            needs_quote := s.always_quote
            if !needs_quote {
                for b in field {
                    if b == s.out_sep || b == '"' || b == '\n' || b == '\r' {
                        needs_quote = true
                        break
                    }
                }
            }
            
            if needs_quote {
                append(&s.output, '"')
                for b in field {
                    if b == '"' {
                        append(&s.output, '"', '"')
                    } else {
                        append(&s.output, b)
                    }
                }
                append(&s.output, '"')
            } else {
                append(&s.output, ..field)
            }
            
            if c == s.record_sep {
                if s.line_ending == .CRLF {
                    append(&s.output, '\r')
                }
                append(&s.output, '\n')
                first_field_in_row = true
            }
            
            field_start = i + 1
        }
    }
    
    // Handle trailing field without separator
    if field_start < len(data) {
        field := data[field_start:]
        has_content = true
        
        if !first_field_in_row {
            append(&s.output, s.out_sep)
        }
        
        needs_quote := s.always_quote
        if !needs_quote {
            for b in field {
                if b == s.out_sep || b == '"' || b == '\n' || b == '\r' {
                    needs_quote = true
                    break
                }
            }
        }
        
        if needs_quote {
            append(&s.output, '"')
            for b in field {
                if b == '"' {
                    append(&s.output, '"', '"')
                } else {
                    append(&s.output, b)
                }
            }
            append(&s.output, '"')
        } else {
            append(&s.output, ..field)
        }
    }
    
    // Add final newline if we had content
    if has_content && !first_field_in_row {
        if s.line_ending == .CRLF {
            append(&s.output, '\r')
        }
        append(&s.output, '\n')
    }
    
    clear(&s.carry)
    return len(s.output)
}


/*
Streaming Delimiter Replacer
============================
Ultra-fast streaming converter that just replaces delimiters.
No quoting logic - use only when output format doesn't require quoting.
*/


// Convert binary lazyrow format directly to CSV.
// Decodes lazyrow binary and stringifies to CSV in one pass.
// Returns number of bytes written to output, or -1 if output buffer too small.
lazyrow_to_csv :: proc(input: []u8, output: []u8, separator: u8, crlf: bool) -> int {
    out_pos := 0
    in_pos := 0
    
    for in_pos < len(input) {
        // Read row_length prefix
        if in_pos + 4 > len(input) do return -1
        
        row_length := int(input[in_pos]) | 
                     (int(input[in_pos+1]) << 8) |
                     (int(input[in_pos+2]) << 16) |
                     (int(input[in_pos+3]) << 24)
        in_pos += 4
        
        if in_pos + row_length > len(input) do return -1
        
        row_end := in_pos + row_length
        
        // Read field_count
        if in_pos + 4 > row_end do return -1
        field_count := int(input[in_pos]) |
                      (int(input[in_pos+1]) << 8) |
                      (int(input[in_pos+2]) << 16) |
                      (int(input[in_pos+3]) << 24)
        in_pos += 4
        
        // Read field lengths
        field_lengths := make([]int, field_count, context.temp_allocator)
        for i in 0..<field_count {
            if in_pos + 4 > row_end do return -1
            field_lengths[i] = int(input[in_pos]) |
                              (int(input[in_pos+1]) << 8) |
                              (int(input[in_pos+2]) << 16) |
                              (int(input[in_pos+3]) << 24)
            in_pos += 4
        }
        
        // Process each field
        for field_idx in 0..<field_count {
            field_len := field_lengths[field_idx]
            if in_pos + field_len > row_end do return -1
            
            field := input[in_pos:in_pos+field_len]
            in_pos += field_len
            
            // Add separator between fields
            if field_idx > 0 {
                if out_pos >= len(output) do return -1
                output[out_pos] = separator
                out_pos += 1
            }
            
            // Check if field needs quoting
            needs_quote := false
            for b in field {
                if b == separator || b == '"' || b == '\n' || b == '\r' {
                    needs_quote = true
                    break
                }
            }
            
            if needs_quote {
                // Write quoted field
                if out_pos >= len(output) do return -1
                output[out_pos] = '"'
                out_pos += 1
                
                for b in field {
                    if b == '"' {
                        // Escape quote with double quote
                        if out_pos + 2 > len(output) do return -1
                        output[out_pos] = '"'
                        output[out_pos+1] = '"'
                        out_pos += 2
                    } else {
                        if out_pos >= len(output) do return -1
                        output[out_pos] = b
                        out_pos += 1
                    }
                }
                
                if out_pos >= len(output) do return -1
                output[out_pos] = '"'
                out_pos += 1
            } else {
                // Write unquoted field
                if out_pos + field_len > len(output) do return -1
                copy(output[out_pos:], field)
                out_pos += field_len
            }
        }
        
        // Add line ending
        if crlf {
            if out_pos + 2 > len(output) do return -1
            output[out_pos] = '\r'
            output[out_pos+1] = '\n'
            out_pos += 2
        } else {
            if out_pos >= len(output) do return -1
            output[out_pos] = '\n'
            out_pos += 1
        }
        
        // Move to next row
        in_pos = row_end
    }
    
    return out_pos
}


// Convert binary lazyrow format directly to TSV.
// Decodes lazyrow binary and outputs TSV (tab-separated) in one pass.
// Much simpler than CSV - no quoting needed since TSV doesn't support special characters.
// Returns number of bytes written to output, or -1 if output buffer too small.
lazyrow_to_tsv :: proc(input: []u8, output: []u8) -> int {
    out_pos := 0
    in_pos := 0
    
    for in_pos < len(input) {
        // Read row_length prefix
        if in_pos + 4 > len(input) do return -1
        
        row_length := int(input[in_pos]) | 
                     (int(input[in_pos+1]) << 8) |
                     (int(input[in_pos+2]) << 16) |
                     (int(input[in_pos+3]) << 24)
        in_pos += 4
        
        if in_pos + row_length > len(input) do return -1
        
        row_end := in_pos + row_length
        
        // Read field_count
        if in_pos + 4 > row_end do return -1
        field_count := int(input[in_pos]) |
                      (int(input[in_pos+1]) << 8) |
                      (int(input[in_pos+2]) << 16) |
                      (int(input[in_pos+3]) << 24)
        in_pos += 4
        
        // Calculate where field data starts (after all field length headers)
        field_data_start := in_pos + (field_count * 4)
        if field_data_start > row_end do return -1
        
        // Process each field
        field_data_pos := field_data_start
        for field_idx in 0..<field_count {
            // Read field length
            if in_pos + 4 > field_data_start do return -1
            field_len := int(input[in_pos]) |
                        (int(input[in_pos+1]) << 8) |
                        (int(input[in_pos+2]) << 16) |
                        (int(input[in_pos+3]) << 24)
            in_pos += 4
            
            if field_data_pos + field_len > row_end do return -1
            
            // Add tab separator between fields
            if field_idx > 0 {
                if out_pos >= len(output) do return -1
                output[out_pos] = '\t'
                out_pos += 1
            }
            
            // Copy field data directly (no quoting needed for TSV)
            if out_pos + field_len > len(output) do return -1
            copy(output[out_pos:], input[field_data_pos:field_data_pos+field_len])
            out_pos += field_len
            field_data_pos += field_len
        }
        
        // Add newline
        if out_pos >= len(output) do return -1
        output[out_pos] = '\n'
        out_pos += 1
        
        // Move to next row
        in_pos = row_end
    }
    
    return out_pos
}

// Convert binary LazyRow format to Record format (US/RS separators).
// Record format: fields separated by 0x1F (US), records terminated by 0x1E (RS).
// Returns number of bytes written to output, or -1 if output buffer too small.
lazyrow_to_record :: proc(input: []u8, output: []u8) -> int {
    out_pos := 0
    in_pos := 0
    
    for in_pos < len(input) {
        // Read row_length prefix
        if in_pos + 4 > len(input) do return -1
        
        row_length := int(input[in_pos]) | 
                     (int(input[in_pos+1]) << 8) |
                     (int(input[in_pos+2]) << 16) |
                     (int(input[in_pos+3]) << 24)
        in_pos += 4
        
        if in_pos + row_length > len(input) do return -1
        
        row_end := in_pos + row_length
        
        // Read field_count
        if in_pos + 4 > row_end do return -1
        field_count := int(input[in_pos]) |
                      (int(input[in_pos+1]) << 8) |
                      (int(input[in_pos+2]) << 16) |
                      (int(input[in_pos+3]) << 24)
        in_pos += 4
        
        // Calculate where field data starts (after all field length headers)
        field_data_start := in_pos + (field_count * 4)
        if field_data_start > row_end do return -1
        
        // Process each field
        field_data_pos := field_data_start
        for field_idx in 0..<field_count {
            // Read field length
            if in_pos + 4 > field_data_start do return -1
            field_len := int(input[in_pos]) |
                        (int(input[in_pos+1]) << 8) |
                        (int(input[in_pos+2]) << 16) |
                        (int(input[in_pos+3]) << 24)
            in_pos += 4
            
            if field_data_pos + field_len > row_end do return -1
            
            // Add US separator between fields
            if field_idx > 0 {
                if out_pos >= len(output) do return -1
                output[out_pos] = 0x1F
                out_pos += 1
            }
            
            // Copy field data directly
            if out_pos + field_len > len(output) do return -1
            copy(output[out_pos:], input[field_data_pos:field_data_pos+field_len])
            out_pos += field_len
            field_data_pos += field_len
        }
        
        // Add RS terminator
        if out_pos >= len(output) do return -1
        output[out_pos] = 0x1E
        out_pos += 1
        
        // Move to next row
        in_pos = row_end
    }
    
    return out_pos
}
