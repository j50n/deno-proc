package csv_wasm

import "base:runtime"
import "core:slice"
import "csv"

/*
WASM Exports for RFC 4180 CSV Parser
====================================

This module provides WebAssembly exports for the CSV parser, designed for
high-performance streaming CSV processing from JavaScript/TypeScript.

Memory Model
------------
Uses shared memory buffers for efficient data transfer:
- Input buffer: Caller writes CSV data here before calling parse functions
- Output buffer: Parser writes results here; caller reads after parse calls

Call alloc_input_buffer() and alloc_output_buffer() once at startup, then
reuse for all operations. Buffers persist until explicitly freed.

Parser Lifecycle
----------------
1. Allocate buffers: alloc_input_buffer(size), alloc_output_buffer(size)
2. Create parser: create_*_parser(...) → returns parser ID
3. For each chunk:
   a. Copy input to input buffer
   b. Call parse_*(id, len) → returns packed result
   c. Call get_*_output(id) → returns bytes written to output buffer
   d. Read output buffer
   e. Call clear_*_output(id)
4. After last chunk: call finish_*(id)
5. Destroy parser: destroy_*_parser(id)

Return Value Format
-------------------
Parse functions return i64 with packed values:
- High 32 bits: number of complete rows parsed
- Low 32 bits: error code (0 = success, >0 = CsvErrorKind)

Example: result = 0x0000000500000000 means 5 rows, no error
         result = 0x0000000300000002 means 3 rows, then UnclosedQuote error

Parser Types
------------
1. DelimitedParser - Outputs \x1F/\x1E separated text to internal buffer
2. DirectParser - Outputs \x1F/\x1E directly to output buffer (fastest for streaming)
3. SpanParser - Outputs field offset tuples (for zero-copy access)
4. DelimitedStringifier - Converts \x1F/\x1E back to CSV
*/

// Parser instance storage (maps ID → parser pointer)
delimited_parsers: map[i32]^csv.DelimitedParser
span_parsers: map[i32]^csv.SpanParser
delimited_stringifiers: map[i32]^csv.DelimitedStringifier
next_id: i32 = 1  // Next available parser ID

// Shared memory buffers for WASM ↔ JS data transfer (dynamic arrays auto-grow)
input_buffer: [dynamic]u8
output_buffer: [dynamic]u8

// Error reporting area (10 bytes at start of output buffer)
// [0]: error_kind, [1]: reserved, [2-5]: row (u32 LE), [6-9]: col (u32 LE)

main :: proc() {}

/*
Buffer Management
=================
Allocate shared buffers for data transfer between JS and WASM.
Call once at startup; reuse for all operations.
*/

// Allocate input buffer. Returns pointer to buffer start.
@(export)
alloc_input_buffer :: proc "c" (size: i32) -> rawptr {
    context = runtime.default_context()
    resize(&input_buffer, int(size))
    return raw_data(input_buffer)
}

// Allocate output buffer. Returns pointer to buffer start.
@(export)
alloc_output_buffer :: proc "c" (size: i32) -> rawptr {
    context = runtime.default_context()
    resize(&output_buffer, int(size))
    return raw_data(output_buffer)
}

// Get current output buffer pointer (may change after grow)
@(export)
get_output_buffer :: proc "c" () -> rawptr {
    return raw_data(output_buffer)
}

// Get current input buffer pointer (may change after grow)
@(export)
get_input_buffer :: proc "c" () -> rawptr {
    return raw_data(input_buffer)
}

// Free a previously allocated buffer
@(export)
free_buffer :: proc "c" (ptr: rawptr) {
    context = runtime.default_context()
    if ptr == raw_data(input_buffer) {
        delete(input_buffer)
        input_buffer = {}
    } else if ptr == raw_data(output_buffer) {
        delete(output_buffer)
        output_buffer = {}
    }
}

/*
Delimited Parser
================
Parses CSV and outputs \x1F/\x1E separated text to an internal buffer.
Use get_delimited_output() to copy results to the output buffer.

Best for: when you need parsed text and want to control when output is retrieved.
*/

// Create a delimited parser. Returns parser ID (>0) or error (<0).
// Parameters:
//   separator: field separator char code (0 = default comma)
//   strict: 1 = fail on errors, 0 = best-effort parsing
//   expected_fields: if >0, error when row has different field count
@(export)
create_delimited_parser :: proc "c" (separator: i32, strict: i32, expected_fields: i32) -> i32 {
    context = runtime.default_context()
    
    opts := csv.CsvOptions{
        separator = u8(separator) if separator > 0 else ',',
        strict = strict != 0,
        expected_fields = u32(expected_fields) if expected_fields > 0 else 0,
    }
    
    p := new(csv.DelimitedParser)
    p^ = csv.delimited_init(opts)
    
    id := next_id
    next_id += 1
    delimited_parsers[id] = p
    return id
}

// Destroy a delimited parser and free its resources
@(export)
destroy_delimited_parser :: proc "c" (id: i32) {
    context = runtime.default_context()
    if p, ok := delimited_parsers[id]; ok {
        csv.delimited_destroy(p)
        free(p)
        delete_key(&delimited_parsers, id)
    }
}

// Parse CSV data from input buffer.
// Returns: high 32 bits = rows completed, low 32 bits = error code (0 = ok)
// Output is stored in parser's internal buffer; call get_delimited_output() to retrieve.
@(export)
parse_delimited :: proc "c" (id: i32, input_len: i32) -> i64 {
    context = runtime.default_context()
    
    p, ok := delimited_parsers[id]
    if !ok do return -1
    
    input := input_buffer[:input_len]
    rows, success := csv.delimited_parse(p, input)
    
    err: i32 = 0 if success else i32(p.error.kind)
    return (i64(rows) << 32) | i64(err)
}

// Finalize parsing after all input. Flushes any remaining partial record.
// Returns: same format as parse_delimited
@(export)
finish_delimited :: proc "c" (id: i32) -> i64 {
    context = runtime.default_context()
    
    p, ok := delimited_parsers[id]
    if !ok do return -1
    
    rows, success := csv.delimited_finish(p)
    
    err: i32 = 0 if success else i32(p.error.kind)
    return (i64(rows) << 32) | i64(err)
}

// Copy complete records from parser to output buffer.
// Returns: number of bytes written to output buffer.
// Only returns complete records (those ending with \x1E).
@(export)
get_delimited_output :: proc "c" (id: i32) -> i32 {
    context = runtime.default_context()
    
    p, ok := delimited_parsers[id]
    if !ok do return 0
    
    output := csv.delimited_get_complete_output(p)
    if len(output) == 0 do return 0
    
    resize(&output_buffer, len(output))
    copy(output_buffer[:], output)
    
    return i32(len(output))
}

// Clear parser's output buffer. Call after reading output to free memory.
// Preserves any incomplete record data for the next parse call.
@(export)
clear_delimited_output :: proc "c" (id: i32) {
    context = runtime.default_context()
    if p, ok := delimited_parsers[id]; ok {
        csv.delimited_reset_output(p)
    }
}

// Get error position details. Returns: high 32 bits = row, low 32 bits = column
@(export)
get_delimited_error :: proc "c" (id: i32) -> i64 {
    context = runtime.default_context()
    
    p, ok := delimited_parsers[id]
    if !ok do return 0
    
    return (i64(p.error.row) << 32) | i64(p.error.col)
}

/*
Direct Buffer Parser
====================
Parses CSV and writes \x1F/\x1E output directly to the output buffer.
Fastest option for streaming - no intermediate buffer copy.

Handles incomplete records by carrying them to the next parse call.
Returns only complete records; partial data is buffered internally.
Output buffer grows automatically if needed.
*/

// Internal state for direct buffer parser
DirectParser :: struct {
    state: csv.CsvState,
    row: u32,
    fields_in_row: u32,
    opts: csv.CsvOptions,
    error: csv.CsvError,
    row_started: bool,
    carry: [dynamic]u8,  // Buffer for incomplete record data between chunks
    field_sep: u8,       // Output field separator (default \x1F)
    record_sep: u8,      // Output record separator (default \x1E)
    input_record_sep: u8, // Input record separator (default \n)
    work_buffer: [2 * 1024 * 1024]u8,  // Fixed buffer for accumulating output
    work_len: int,       // Current length in work_buffer
}

direct_parsers: map[i32]^DirectParser

// Create a direct parser. Returns parser ID.
// Parameters:
//   separator: field separator char code for INPUT (0 = default comma)
//   strict: 1 = fail on errors, 0 = best-effort parsing
//   field_sep: OUTPUT field separator (0 = default \x1F)
//   record_sep: OUTPUT record separator (0 = default \x1E)
//   input_record_sep: INPUT record separator (0 = default \n)
@(export)
create_direct_parser :: proc "c" (separator: i32, strict: i32, field_sep: i32, record_sep: i32, input_record_sep: i32) -> i32 {
    context = runtime.default_context()
    
    p := new(DirectParser)
    p.opts = csv.CsvOptions{
        separator = u8(separator) if separator > 0 else ',',
        strict = strict != 0,
    }
    p.state = .FieldStart
    p.carry = make([dynamic]u8)
    p.field_sep = u8(field_sep) if field_sep > 0 else csv.FIELD_SEP
    p.record_sep = u8(record_sep) if record_sep > 0 else csv.RECORD_SEP
    p.input_record_sep = u8(input_record_sep) if input_record_sep > 0 else '\n'
    
    id := next_id
    next_id += 1
    direct_parsers[id] = p
    return id
}

// Destroy a direct parser and free its resources
@(export)
destroy_direct_parser :: proc "c" (id: i32) {
    context = runtime.default_context()
    if p, ok := direct_parsers[id]; ok {
        delete(p.carry)
        free(p)
        delete_key(&direct_parsers, id)
    }
}

// Parse CSV from input buffer, write directly to output buffer.
// Returns: number of bytes written (complete records only), or -1 on memory error.
// Incomplete record data is carried to the next call automatically.
// Output buffer grows automatically if needed.
@(export)
parse_direct :: proc "c" (id: i32, input_len: i32) -> i32 {
    context = runtime.default_context()
    
    p, ok := direct_parsers[id]
    if !ok do return 0
    if p.error.kind != .None do return 0
    
    input := input_buffer[:input_len]
    
    // Reset work buffer
    p.work_len = 0
    
    sep := p.opts.separator
    field_sep := p.field_sep
    record_sep := p.record_sep
    input_rec_sep := p.input_record_sep
    
    // First, flush any carried data
    for b in p.carry {
        if p.work_len < len(p.work_buffer) {
            p.work_buffer[p.work_len] = b
            p.work_len += 1
        }
    }
    clear(&p.carry)
    
    record_start := 0  // Start of current record in work buffer
    
    for i := 0; i < int(input_len); i += 1 {
        c := input[i]
        
        switch p.state {
        case .FieldStart:
            if c == '"' {
                if p.row_started && p.work_len < len(p.work_buffer) {
                    p.work_buffer[p.work_len] = field_sep
                    p.work_len += 1
                }
                p.row_started = true
                p.state = .Quoted
            } else if c == sep {
                if p.row_started && p.work_len < len(p.work_buffer) {
                    p.work_buffer[p.work_len] = field_sep
                    p.work_len += 1
                }
                p.row_started = true
                p.fields_in_row += 1
            } else if c == '\r' {
                if p.row_started {
                    if p.work_len < len(p.work_buffer) {
                        p.work_buffer[p.work_len] = field_sep
                        p.work_len += 1
                    }
                    p.fields_in_row += 1
                }
                p.state = .RecordEnd
            } else if c == input_rec_sep {
                if p.row_started {
                    if p.work_len < len(p.work_buffer) {
                        p.work_buffer[p.work_len] = field_sep
                        p.work_len += 1
                    }
                    p.fields_in_row += 1
                    if p.work_len < len(p.work_buffer) {
                        p.work_buffer[p.work_len] = record_sep
                        p.work_len += 1
                    }
                }
                p.row += 1
                p.fields_in_row = 0
                p.row_started = false
                record_start = p.work_len
            } else {
                if p.row_started && p.work_len < len(p.work_buffer) {
                    p.work_buffer[p.work_len] = field_sep
                    p.work_len += 1
                }
                p.row_started = true
                if p.work_len < len(p.work_buffer) {
                    p.work_buffer[p.work_len] = c
                    p.work_len += 1
                }
                p.state = .Unquoted
            }
            
        case .Unquoted:
            if c == sep {
                p.fields_in_row += 1
                p.state = .FieldStart
            } else if c == '\r' {
                p.fields_in_row += 1
                p.state = .RecordEnd
            } else if c == input_rec_sep {
                p.fields_in_row += 1
                if p.work_len < len(p.work_buffer) {
                    p.work_buffer[p.work_len] = record_sep
                    p.work_len += 1
                }
                p.row += 1
                p.fields_in_row = 0
                p.row_started = false
                p.state = .FieldStart
                record_start = p.work_len
            } else {
                if p.work_len < len(p.work_buffer) {
                    p.work_buffer[p.work_len] = c
                    p.work_len += 1
                }
            }
            
        case .Quoted:
            if c == '"' {
                p.state = .QuoteInQuoted
            } else {
                if p.work_len < len(p.work_buffer) {
                    p.work_buffer[p.work_len] = c
                    p.work_len += 1
                }
            }
            
        case .QuoteInQuoted:
            if c == '"' {
                if p.work_len < len(p.work_buffer) {
                    p.work_buffer[p.work_len] = '"'
                    p.work_len += 1
                }
                p.state = .Quoted
            } else if c == sep {
                p.fields_in_row += 1
                p.state = .FieldStart
            } else if c == '\r' {
                p.fields_in_row += 1
                p.state = .RecordEnd
            } else if c == input_rec_sep {
                p.fields_in_row += 1
                if p.work_len < len(p.work_buffer) {
                    p.work_buffer[p.work_len] = record_sep
                    p.work_len += 1
                }
                p.row += 1
                p.fields_in_row = 0
                p.row_started = false
                p.state = .FieldStart
                record_start = p.work_len
            } else {
                p.error = csv.CsvError{.InvalidCharAfterQuote, p.row, 0}
                return 0
            }
            
        case .RecordEnd:
            if c == input_rec_sep {
                if p.work_len < len(p.work_buffer) {
                    p.work_buffer[p.work_len] = record_sep
                    p.work_len += 1
                }
                p.row += 1
                p.fields_in_row = 0
                p.row_started = false
                p.state = .FieldStart
                record_start = p.work_len
            } else {
                if p.work_len < len(p.work_buffer) {
                    p.work_buffer[p.work_len] = record_sep
                    p.work_len += 1
                }
                p.row += 1
                p.fields_in_row = 0
                p.row_started = false
                p.state = .FieldStart
                record_start = p.work_len
                i -= 1
            }
        }
    }
    
    // Copy complete records to output_buffer
    clear(&output_buffer)
    reserve(&output_buffer, record_start)
    append(&output_buffer, ..p.work_buffer[:record_start])
    
    // Carry incomplete record to next call
    clear(&p.carry)
    if record_start < p.work_len {
        append(&p.carry, ..p.work_buffer[record_start:p.work_len])
    }
    
    return i32(len(output_buffer))
}

// Finalize parsing - flush any remaining buffered data to output.
@(export)
finish_direct :: proc "c" (id: i32) -> i32 {
    context = runtime.default_context()
    
    p, ok := direct_parsers[id]
    if !ok do return 0
    
    clear(&output_buffer)
    
    // Flush carry buffer
    for b in p.carry {
        append(&output_buffer, b)
    }
    
    // Add final record separator if there's data
    if p.row_started && len(output_buffer) > 0 {
        append(&output_buffer, p.record_sep)
    }
    
    clear(&p.carry)
    return i32(len(output_buffer))
}

/*
Span Parser
===========
Parses CSV and outputs field position tuples instead of copying text.
Zero-copy approach - records (start, end, flags) offsets into original input.

Output format in output buffer (per span, 12 bytes):
  - start: u32 - start offset in source
  - end: u32 - end offset in source (exclusive)
  - flags: u32 - bit 0 = quoted (needs unescape)

Use get_spans() and get_row_ends() to retrieve parsed structure.
*/

// Create a span parser. Returns parser ID.
@(export)
create_span_parser :: proc "c" (separator: i32, strict: i32, expected_fields: i32) -> i32 {
    context = runtime.default_context()
    
    opts := csv.CsvOptions{
        separator = u8(separator) if separator > 0 else ',',
        strict = strict != 0,
        expected_fields = u32(expected_fields) if expected_fields > 0 else 0,
    }
    
    p := new(csv.SpanParser)
    p^ = csv.span_init(opts)
    
    id := next_id
    next_id += 1
    span_parsers[id] = p
    return id
}

// Destroy a span parser and free its resources
@(export)
destroy_span_parser :: proc "c" (id: i32) {
    context = runtime.default_context()
    if p, ok := span_parsers[id]; ok {
        csv.span_destroy(p)
        free(p)
        delete_key(&span_parsers, id)
    }
}

// Parse CSV from input buffer into span offsets.
// Parameters:
//   input_len: bytes of CSV data in input buffer
//   base_offset: offset to add to all span positions (for streaming across chunks)
// Returns: high 32 bits = rows, low 32 bits = error code
@(export)
parse_span :: proc "c" (id: i32, input_len: i32, base_offset: i32) -> i64 {
    context = runtime.default_context()
    
    p, ok := span_parsers[id]
    if !ok do return -1
    
    input := input_buffer[:input_len]
    rows, success := csv.span_parse(p, input, u32(base_offset))
    
    err: i32 = 0 if success else i32(p.error.kind)
    return (i64(rows) << 32) | i64(err)
}

// Finalize span parsing
@(export)
finish_span :: proc "c" (id: i32, input_len: i32) -> i64 {
    context = runtime.default_context()
    
    p, ok := span_parsers[id]
    if !ok do return -1
    
    rows, success := csv.span_finish(p, u32(input_len))
    
    err: i32 = 0 if success else i32(p.error.kind)
    return (i64(rows) << 32) | i64(err)
}

// Get total number of field spans parsed
@(export)
get_span_count :: proc "c" (id: i32) -> i32 {
    context = runtime.default_context()
    p, ok := span_parsers[id]
    if !ok do return 0
    return i32(len(p.spans))
}

// Get number of complete rows parsed
@(export)
get_span_row_count :: proc "c" (id: i32) -> i32 {
    context = runtime.default_context()
    p, ok := span_parsers[id]
    if !ok do return 0
    return i32(len(p.row_ends))
}

// Copy field spans to output buffer.
// Format: [start:u32, end:u32, flags:u32] × N (12 bytes per span)
// Returns: number of spans written
@(export)
get_spans :: proc "c" (id: i32) -> i32 {
    context = runtime.default_context()
    
    p, ok := span_parsers[id]
    if !ok do return 0
    
    spans := p.spans[:]
    if len(spans) == 0 do return 0
    
    // Each span = 12 bytes (3 x u32)
    bytes_needed := len(spans) * 12
    resize(&output_buffer, bytes_needed)
    
    out := slice.from_ptr(cast(^u32)raw_data(output_buffer), len(spans) * 3)
    for i := 0; i < len(spans); i += 1 {
        out[i*3 + 0] = spans[i].start
        out[i*3 + 1] = spans[i].end
        out[i*3 + 2] = u32(spans[i].flags)
    }
    
    return i32(len(spans))
}

// Copy row end indices to output buffer.
// Each u32 is the index into spans array where that row ends.
// Returns: number of row ends written
@(export)
get_row_ends :: proc "c" (id: i32) -> i32 {
    context = runtime.default_context()
    
    p, ok := span_parsers[id]
    if !ok do return 0
    
    row_ends := p.row_ends[:]
    if len(row_ends) == 0 do return 0
    
    bytes_needed := len(row_ends) * 4
    resize(&output_buffer, bytes_needed)
    
    out := slice.from_ptr(cast(^u32)raw_data(output_buffer), len(row_ends))
    copy(out, row_ends)
    
    return i32(len(row_ends))
}

// Clear span parser's output arrays
@(export)
clear_span_output :: proc "c" (id: i32) {
    context = runtime.default_context()
    if p, ok := span_parsers[id]; ok {
        csv.span_reset_output(p)
    }
}

/*
Delimited Stringifier
=====================
Converts \x1F/\x1E delimited input back to RFC 4180 CSV.
Handles proper quoting of fields containing special characters.
*/

// Create a stringifier. Returns stringifier ID.
// Parameters:
//   separator: output field separator (0 = default comma)
//   crlf: 1 = use \r\n line endings, 0 = use \n
//   always_quote: 1 = quote all fields, 0 = quote only when needed
//   expected_fields: if >0, error when row has different field count
@(export)
create_delimited_stringifier :: proc "c" (separator: i32, crlf: i32, always_quote: i32, expected_fields: i32) -> i32 {
    context = runtime.default_context()
    
    opts := csv.StringifyOptions{
        separator = u8(separator) if separator > 0 else ',',
        line_ending = .CRLF if crlf != 0 else .LF,
        always_quote = always_quote != 0,
        expected_fields = u32(expected_fields) if expected_fields > 0 else 0,
    }
    
    s := new(csv.DelimitedStringifier)
    s^ = csv.delimited_stringify_init(opts)
    
    id := next_id
    next_id += 1
    delimited_stringifiers[id] = s
    return id
}

// Destroy a stringifier and free its resources
@(export)
destroy_delimited_stringifier :: proc "c" (id: i32) {
    context = runtime.default_context()
    if s, ok := delimited_stringifiers[id]; ok {
        csv.delimited_stringify_destroy(s)
        free(s)
        delete_key(&delimited_stringifiers, id)
    }
}

// Convert delimited input to CSV. Input is read from input buffer.
// Returns: 1 on success, 0 on error
@(export)
stringify_delimited :: proc "c" (id: i32, input_len: i32) -> i32 {
    context = runtime.default_context()
    
    s, ok := delimited_stringifiers[id]
    if !ok do return 0
    
    input := input_buffer[:input_len]
    success := csv.delimited_stringify(s, input)
    
    return 1 if success else 0
}

// Copy stringifier output to output buffer.
// Returns: number of bytes written
@(export)
get_stringify_output :: proc "c" (id: i32) -> i32 {
    context = runtime.default_context()
    
    s, ok := delimited_stringifiers[id]
    if !ok do return 0
    
    output := s.output[:]
    if len(output) == 0 do return 0
    
    resize(&output_buffer, len(output))
    copy(output_buffer[:], output)
    
    return i32(len(output))
}

// Clear stringifier's output buffer
@(export)
clear_stringify_output :: proc "c" (id: i32) {
    context = runtime.default_context()
    if s, ok := delimited_stringifiers[id]; ok {
        csv.delimited_stringify_reset(s)
    }
}

/*
Direct Stringifier
==================
Converts delimited input (with custom separators) directly to CSV output.
Supports configurable input field/record separators for flexibility.
*/

DirectStringifier :: struct {
    opts: csv.StringifyOptions,
    field_sep: u8,   // Input field separator
    record_sep: u8,  // Input record separator
}

direct_stringifiers: map[i32]^DirectStringifier

// Create a direct stringifier with custom input separators.
// Parameters:
//   separator: OUTPUT field separator (0 = default comma)
//   crlf: 1 = use \r\n line endings, 0 = use \n
//   always_quote: 1 = quote all fields, 0 = quote only when needed
//   field_sep: INPUT field separator (0 = default \x1F)
//   record_sep: INPUT record separator (0 = default \x1E)
@(export)
create_direct_stringifier :: proc "c" (separator: i32, crlf: i32, always_quote: i32, field_sep: i32, record_sep: i32) -> i32 {
    context = runtime.default_context()
    
    s := new(DirectStringifier)
    s.opts = csv.StringifyOptions{
        separator = u8(separator) if separator > 0 else ',',
        line_ending = .CRLF if crlf != 0 else .LF,
        always_quote = always_quote != 0,
    }
    s.field_sep = u8(field_sep) if field_sep > 0 else csv.FIELD_SEP
    s.record_sep = u8(record_sep) if record_sep > 0 else csv.RECORD_SEP
    
    id := next_id
    next_id += 1
    direct_stringifiers[id] = s
    return id
}

// Destroy a direct stringifier
@(export)
destroy_direct_stringifier :: proc "c" (id: i32) {
    context = runtime.default_context()
    if s, ok := direct_stringifiers[id]; ok {
        free(s)
        delete_key(&direct_stringifiers, id)
    }
}

// Convert delimited input to CSV, writing directly to output buffer.
// Returns: number of bytes written to output buffer
@(export)
stringify_direct :: proc "c" (id: i32, input_len: i32) -> i32 {
    context = runtime.default_context()
    
    s, ok := direct_stringifiers[id]
    if !ok do return 0
    
    input := input_buffer[:input_len]
    clear(&output_buffer)
    
    field_sep := s.field_sep
    record_sep := s.record_sep
    out_sep := s.opts.separator
    always_quote := s.opts.always_quote
    line_ending := s.opts.line_ending
    
    field_start := 0
    first_field_in_row := true
    
    for i := 0; i < int(input_len); i += 1 {
        c := input[i]
        
        if c == field_sep || c == record_sep {
            // Add separator before field (except for first field in row)
            if !first_field_in_row {
                append(&output_buffer, out_sep)
            }
            first_field_in_row = false
            
            // Process the field
            field := input[field_start:i]
            
            needs_quote := always_quote
            if !needs_quote {
                for b in field {
                    if b == out_sep || b == '"' || b == '\n' || b == '\r' {
                        needs_quote = true
                        break
                    }
                }
            }
            
            if needs_quote {
                append(&output_buffer, '"')
                for b in field {
                    if b == '"' {
                        append(&output_buffer, '"')
                        append(&output_buffer, '"')
                    } else {
                        append(&output_buffer, b)
                    }
                }
                append(&output_buffer, '"')
            } else {
                for b in field {
                    append(&output_buffer, b)
                }
            }
            
            // Handle record separator
            if c == record_sep {
                if line_ending == .CRLF {
                    append(&output_buffer, '\r')
                }
                append(&output_buffer, '\n')
                first_field_in_row = true
            }
            
            field_start = i + 1
        }
    }
    
    return i32(len(output_buffer))
}


// =============================================================================
// LazyRow Binary Format Encoder/Decoder
// =============================================================================

lazyrow_encoders: map[i32]^csv.LazyRowEncoder
lazyrow_decoders: map[i32]^csv.LazyRowDecoder

// Create a lazyrow encoder
@(export)
create_lazyrow_encoder :: proc "c" () -> i32 {
    context = runtime.default_context()
    
    e := new(csv.LazyRowEncoder)
    e^ = csv.lazyrow_encoder_init()
    
    id := next_id
    next_id += 1
    lazyrow_encoders[id] = e
    return id
}

// Destroy a lazyrow encoder
@(export)
destroy_lazyrow_encoder :: proc "c" (id: i32) {
    context = runtime.default_context()
    if e, ok := lazyrow_encoders[id]; ok {
        csv.lazyrow_encoder_destroy(e)
        free(e)
        delete_key(&lazyrow_encoders, id)
    }
}

// Encode record format to binary lazyrow format.
// Input: record format in input buffer
// Output: binary lazyrow in output buffer
@(export)
lazyrow_encode :: proc "c" (id: i32, input_len: i32) -> i32 {
    context = runtime.default_context()
    
    e, ok := lazyrow_encoders[id]
    if !ok do return 0
    
    input := input_buffer[:input_len]
    csv.lazyrow_encoder_reset(e)
    csv.lazyrow_encode(e, input)
    
    // Copy encoder output to output_buffer
    out_len := len(e.output)
    resize(&output_buffer, out_len)
    if out_len > 0 {
        copy(output_buffer[:], e.output[:])
    }
    
    return i32(out_len)
}

// Encode record format to binary lazyrow format (from output buffer).
// Input: record format in output buffer
// Output: binary lazyrow in input buffer (swapped to avoid copy)
@(export)
lazyrow_encode_from_output :: proc "c" (id: i32, input_len: i32) -> i32 {
    context = runtime.default_context()
    
    e, ok := lazyrow_encoders[id]
    if !ok do return 0
    
    input := output_buffer[:input_len]
    csv.lazyrow_encoder_reset(e)
    csv.lazyrow_encode(e, input)
    
    // Copy encoder output to input_buffer (swapped)
    out_len := len(e.output)
    resize(&input_buffer, out_len)
    if out_len > 0 {
        copy(input_buffer[:], e.output[:])
    }
    
    return i32(out_len)
}

// Create a lazyrow decoder
@(export)
create_lazyrow_decoder :: proc "c" () -> i32 {
    context = runtime.default_context()
    
    d := new(csv.LazyRowDecoder)
    d^ = csv.lazyrow_decoder_init()
    
    id := next_id
    next_id += 1
    lazyrow_decoders[id] = d
    return id
}

// Destroy a lazyrow decoder
@(export)
destroy_lazyrow_decoder :: proc "c" (id: i32) {
    context = runtime.default_context()
    if d, ok := lazyrow_decoders[id]; ok {
        csv.lazyrow_decoder_destroy(d)
        free(d)
        delete_key(&lazyrow_decoders, id)
    }
}

// Decode binary lazyrow format to record format.
// Input: binary lazyrow in input buffer
// Output: record format in output buffer
@(export)
lazyrow_decode :: proc "c" (id: i32, input_len: i32) -> i32 {
    context = runtime.default_context()
    
    d, ok := lazyrow_decoders[id]
    if !ok do return 0
    
    input := input_buffer[:input_len]
    csv.lazyrow_decoder_reset(d)
    csv.lazyrow_decode(d, input)
    
    // Copy decoder output to output_buffer
    out_len := len(d.output)
    resize(&output_buffer, out_len)
    if out_len > 0 {
        copy(output_buffer[:], d.output[:])
    }
    
    return i32(out_len)
}

// Decode binary lazyrow format directly to delimited output.
// Input: binary lazyrow in input buffer
// Output: delimited text in output buffer (with custom separators)
@(export)
lazyrow_decode_delimited :: proc "c" (id: i32, input_len: i32, field_sep: i32, record_sep: i32) -> i32 {
    context = runtime.default_context()
    
    d, ok := lazyrow_decoders[id]
    if !ok do return 0
    
    input := input_buffer[:input_len]
    csv.lazyrow_decoder_reset(d)
    csv.lazyrow_decode_delimited(d, input, u8(field_sep), u8(record_sep))
    
    // Copy decoder output to output_buffer
    out_len := len(d.output)
    resize(&output_buffer, out_len)
    if out_len > 0 {
        copy(output_buffer[:], d.output[:])
    }
    
    return i32(out_len)
}

// Get how many input bytes were consumed by the last decode call
@(export)
lazyrow_get_consumed :: proc "c" (id: i32) -> i32 {
    context = runtime.default_context()
    
    d, ok := lazyrow_decoders[id]
    if !ok do return 0
    
    return i32(d.consumed)
}

// Convert binary lazyrow format directly to CSV.
// Input: binary lazyrow in input buffer
// Output: CSV in output buffer
// Returns: number of bytes written to output buffer, or -1 on error
@(export)
lazyrow_to_csv :: proc "c" (
    input_ptr: i32,
    input_len: i32,
    output_ptr: i32,
    output_capacity: i32,
    separator: i32,
    crlf: i32,
) -> i32 {
    context = runtime.default_context()
    
    input := ([^]u8)(uintptr(input_ptr))[:input_len]
    output := ([^]u8)(uintptr(output_ptr))[:output_capacity]
    
    result := csv.lazyrow_to_csv(input, output, u8(separator), crlf != 0)
    
    return i32(result)
}


/*
Direct CSV-to-LazyRow Parser
============================
Parses CSV and outputs binary lazyrow format directly in one pass.
Uses fixed-size buffers to avoid dynamic allocations during parsing.
*/

MAX_FIELDS :: 1024  // Max fields per row
MAX_ROW_DATA :: 4194304  // Max data bytes per row (4MB)

LazyRowDirectParser :: struct {
    state: csv.CsvState,
    row: u32,
    opts: csv.CsvOptions,
    error: csv.CsvError,
    row_started: bool,
    input_record_sep: u8,
    // Current row being built (fixed-size buffers)
    field_data: [MAX_ROW_DATA]u8,
    field_lengths: [MAX_FIELDS]u32,
    data_len: int,
    field_count: int,
    current_field_start: int,
    // Carry buffer for incomplete rows
    carry: [dynamic]u8,
}

lazyrow_direct_parsers: map[i32]^LazyRowDirectParser

// Create a direct CSV-to-lazyrow parser. Returns parser ID.
@(export)
create_lazyrow_direct_parser :: proc "c" (separator: i32, input_record_sep: i32) -> i32 {
    context = runtime.default_context()
    
    p := new(LazyRowDirectParser)
    p.opts = csv.CsvOptions{
        separator = u8(separator) if separator > 0 else ',',
    }
    p.state = .FieldStart
    p.input_record_sep = u8(input_record_sep) if input_record_sep > 0 else '\n'
    p.carry = make([dynamic]u8)
    
    id := next_id
    next_id += 1
    lazyrow_direct_parsers[id] = p
    return id
}

// Destroy a direct lazyrow parser
@(export)
destroy_lazyrow_direct_parser :: proc "c" (id: i32) {
    context = runtime.default_context()
    if p, ok := lazyrow_direct_parsers[id]; ok {
        delete(p.carry)
        free(p)
        delete_key(&lazyrow_direct_parsers, id)
    }
}

// Reset row state for next row
@(private)
lazyrow_direct_reset_row :: proc(p: ^LazyRowDirectParser) {
    p.data_len = 0
    p.field_count = 0
    p.current_field_start = 0
    p.row_started = false
    p.row += 1
}

// Emit current row to output buffer. Returns bytes written, or 0 if buffer full.
@(private)
lazyrow_direct_emit :: proc(p: ^LazyRowDirectParser) {
    // Finalize current field
    if p.field_count < MAX_FIELDS {
        p.field_lengths[p.field_count] = u32(p.data_len - p.current_field_start)
        p.field_count += 1
    }
    
    field_count := u32(p.field_count)
    header_size := 4 + int(field_count) * 4
    row_length := u32(header_size + p.data_len)
    total_size := 4 + header_size + p.data_len
    
    // Reserve space in output buffer
    old_len := len(output_buffer)
    resize(&output_buffer, old_len + total_size)
    
    out_pos := old_len
    
    // Write row_length (little-endian u32)
    output_buffer[out_pos] = u8(row_length)
    output_buffer[out_pos + 1] = u8(row_length >> 8)
    output_buffer[out_pos + 2] = u8(row_length >> 16)
    output_buffer[out_pos + 3] = u8(row_length >> 24)
    out_pos += 4
    
    // Write field_count (little-endian u32)
    output_buffer[out_pos] = u8(field_count)
    output_buffer[out_pos + 1] = u8(field_count >> 8)
    output_buffer[out_pos + 2] = u8(field_count >> 16)
    output_buffer[out_pos + 3] = u8(field_count >> 24)
    out_pos += 4
    
    // Write field lengths
    for i := 0; i < p.field_count; i += 1 {
        flen := p.field_lengths[i]
        output_buffer[out_pos] = u8(flen)
        output_buffer[out_pos + 1] = u8(flen >> 8)
        output_buffer[out_pos + 2] = u8(flen >> 16)
        output_buffer[out_pos + 3] = u8(flen >> 24)
        out_pos += 4
    }
    
    // Write field data
    for i := 0; i < p.data_len; i += 1 {
        output_buffer[out_pos] = p.field_data[i]
        out_pos += 1
    }
    
    lazyrow_direct_reset_row(p)
}

// Parse CSV from input buffer, output lazyrow binary to output buffer.
// Returns: number of bytes written to output buffer.
@(export)
parse_to_lazyrow :: proc "c" (id: i32, input_len: i32) -> i32 {
    context = runtime.default_context()
    
    p, ok := lazyrow_direct_parsers[id]
    if !ok do return 0
    if p.error.kind != .None do return 0
    
    input := input_buffer[:input_len]
    clear(&output_buffer)
    
    sep := p.opts.separator
    rec_sep := p.input_record_sep
    
    for i := 0; i < int(input_len); i += 1 {
        c := input[i]
        
        switch p.state {
        case .FieldStart:
            if c == '"' {
                p.row_started = true
                p.state = .Quoted
            } else if c == sep {
                if p.field_count < MAX_FIELDS {
                    p.field_lengths[p.field_count] = u32(p.data_len - p.current_field_start)
                    p.field_count += 1
                }
                p.current_field_start = p.data_len
                p.row_started = true
            } else if c == '\r' {
                // Skip \r - will be handled by next state if needed
                // Don't transition to RecordEnd from FieldStart
            } else if c == rec_sep {
                if p.row_started {
                    lazyrow_direct_emit(p)
                }
                p.state = .FieldStart
            } else {
                if p.data_len < MAX_ROW_DATA {
                    p.field_data[p.data_len] = c
                    p.data_len += 1
                }
                p.row_started = true
                p.state = .Unquoted
            }
            
        case .Unquoted:
            if c == sep {
                if p.field_count < MAX_FIELDS {
                    p.field_lengths[p.field_count] = u32(p.data_len - p.current_field_start)
                    p.field_count += 1
                }
                p.current_field_start = p.data_len
                p.state = .FieldStart
            } else if c == '\r' {
                // Don't increment field_count here - RecordEnd will handle it
                p.state = .RecordEnd
            } else if c == rec_sep {
                lazyrow_direct_emit(p)
                p.state = .FieldStart
            } else {
                if p.data_len < MAX_ROW_DATA {
                    p.field_data[p.data_len] = c
                    p.data_len += 1
                }
            }
            
        case .Quoted:
            if c == '"' {
                p.state = .QuoteInQuoted
            } else {
                if p.data_len < MAX_ROW_DATA {
                    p.field_data[p.data_len] = c
                    p.data_len += 1
                }
            }
            
        case .QuoteInQuoted:
            if c == '"' {
                if p.data_len < MAX_ROW_DATA {
                    p.field_data[p.data_len] = '"'
                    p.data_len += 1
                }
                p.state = .Quoted
            } else if c == sep {
                if p.field_count < MAX_FIELDS {
                    p.field_lengths[p.field_count] = u32(p.data_len - p.current_field_start)
                    p.field_count += 1
                }
                p.current_field_start = p.data_len
                p.state = .FieldStart
            } else if c == '\r' {
                // Don't increment field_count here - RecordEnd will handle it
                p.state = .RecordEnd
            } else if c == rec_sep {
                lazyrow_direct_emit(p)
                p.state = .FieldStart
            } else {
                p.error = csv.CsvError{.InvalidCharAfterQuote, p.row, 0}
                return 0
            }
            
        case .RecordEnd:
            // We're here because we saw \r - now check if \n follows
            if c == rec_sep {
                // \r\n - proper CRLF line ending
                // Don't end field here - lazyrow_direct_emit will do it
                lazyrow_direct_emit(p)
                p.state = .FieldStart
            } else {
                // Standalone \r (not followed by \n) - treat as line ending
                // Don't end field here - lazyrow_direct_emit will do it
                lazyrow_direct_emit(p)
                p.state = .FieldStart
                i -= 1  // Reprocess current character
            }
        }
    }
    
    return i32(len(output_buffer))
}

// Finalize parsing - flush any remaining row.
@(export)
finish_lazyrow_direct :: proc "c" (id: i32) -> i32 {
    context = runtime.default_context()
    
    p, ok := lazyrow_direct_parsers[id]
    if !ok do return 0
    
    clear(&output_buffer)
    
    if p.row_started || p.data_len > 0 || p.field_count > 0 {
        lazyrow_direct_emit(p)
    }
    
    return i32(len(output_buffer))
}

// Encode record format directly to lazyrow binary (no dynamic allocations).
// Input: record format in input buffer (\x1F/\x1E delimited)
// Output: lazyrow binary in output buffer
// Returns: number of bytes written to output buffer
@(export)
record_to_lazyrow :: proc "c" (input_len: i32) -> i32 {
    context = runtime.default_context()
    
    input := input_buffer[:input_len]
    output := output_buffer[:]
    output_capacity := len(output)
    
    FIELD_SEP :: 0x1F
    RECORD_SEP :: 0x1E
    
    out_pos := 0
    field_start := 0
    field_count := 0
    field_starts: [1024]int
    field_ends: [1024]int
    
    for i := 0; i <= int(input_len); i += 1 {
        is_field_sep := i < int(input_len) && input[i] == FIELD_SEP
        is_record_sep := i < int(input_len) && input[i] == RECORD_SEP
        is_end := i == int(input_len)
        
        if is_field_sep || is_record_sep || is_end {
            // Skip if we're at end and field_start is beyond input
            if is_end && field_start >= int(input_len) {
                break
            }
            
            // Record field boundaries
            field_starts[field_count] = field_start
            field_ends[field_count] = i
            field_count += 1
            
            // End of row - encode to lazyrow
            if is_record_sep || (is_end && field_count > 0) {
                // Calculate field lengths
                field_lens: [1024]int
                data_size := 0
                for k := 0; k < field_count; k += 1 {
                    field_len := field_ends[k] - field_starts[k]
                    field_lens[k] = field_len
                    data_size += field_len
                }
                
                // Row format: [row_length: u32][field_count: u32][field_lengths: u32[]...][field_data: bytes...]
                row_length := u32(4 + 4 * field_count + data_size)
                header_size := 4 + 4 + 4 * field_count
                
                if out_pos + header_size + data_size > output_capacity {
                    return -1
                }
                
                // Write row_length
                output[out_pos] = u8(row_length)
                output[out_pos + 1] = u8(row_length >> 8)
                output[out_pos + 2] = u8(row_length >> 16)
                output[out_pos + 3] = u8(row_length >> 24)
                out_pos += 4
                
                // Write field_count
                fc := u32(field_count)
                output[out_pos] = u8(fc)
                output[out_pos + 1] = u8(fc >> 8)
                output[out_pos + 2] = u8(fc >> 16)
                output[out_pos + 3] = u8(fc >> 24)
                out_pos += 4
                
                // Write field lengths
                for k := 0; k < field_count; k += 1 {
                    fl := u32(field_lens[k])
                    output[out_pos] = u8(fl)
                    output[out_pos + 1] = u8(fl >> 8)
                    output[out_pos + 2] = u8(fl >> 16)
                    output[out_pos + 3] = u8(fl >> 24)
                    out_pos += 4
                }
                
                // Write field data
                for k := 0; k < field_count; k += 1 {
                    for j := field_starts[k]; j < field_ends[k]; j += 1 {
                        output[out_pos] = input[j]
                        out_pos += 1
                    }
                }
                
                field_count = 0
            }
            
            field_start = i + 1
        }
    }
    
    return i32(out_pos)
}


/*
Streaming LazyRow Decoder
=========================
High-performance streaming decoder for lazyrow binary → delimited text.
- Accepts arbitrary input chunks (buffers incomplete rows internally)
- Accumulates output until threshold before signaling ready
- Reuses field_lengths array (no per-row allocations)
*/

streaming_lazyrow_decoders: map[i32]^csv.StreamingLazyRowDecoder

// Create a streaming lazyrow decoder. Returns decoder ID.
// Parameters:
//   field_sep: output field separator (e.g., ',' for CSV, '\t' for TSV, 0x1F for record)
//   record_sep: output record separator (e.g., '\n' for CSV/TSV, 0x1E for record)
@(export)
create_streaming_lazyrow_decoder :: proc "c" (field_sep: i32, record_sep: i32) -> i32 {
    context = runtime.default_context()
    
    d := new(csv.StreamingLazyRowDecoder)
    d^ = csv.streaming_lazyrow_decoder_init(u8(field_sep), u8(record_sep))
    
    id := next_id
    next_id += 1
    streaming_lazyrow_decoders[id] = d
    return id
}

// Destroy a streaming lazyrow decoder
@(export)
destroy_streaming_lazyrow_decoder :: proc "c" (id: i32) {
    context = runtime.default_context()
    if d, ok := streaming_lazyrow_decoders[id]; ok {
        csv.streaming_lazyrow_decoder_destroy(d)
        free(d)
        delete_key(&streaming_lazyrow_decoders, id)
    }
}

// Decode a chunk of lazyrow binary data from input buffer.
// Buffers incomplete rows internally. Output accumulates in decoder.
// Returns: 1 if output >= threshold (ready to read), 0 otherwise
@(export)
streaming_lazyrow_decode :: proc "c" (id: i32, input_len: i32) -> i32 {
    context = runtime.default_context()
    
    d, ok := streaming_lazyrow_decoders[id]
    if !ok do return 0
    
    input := input_buffer[:input_len]
    csv.streaming_lazyrow_decode(d, input)
    
    return 1 if csv.streaming_lazyrow_has_output(d) else 0
}

// Get output from streaming decoder. Copies to output_buffer.
// Returns: number of bytes written to output buffer
@(export)
get_streaming_lazyrow_output :: proc "c" (id: i32) -> i32 {
    context = runtime.default_context()
    
    d, ok := streaming_lazyrow_decoders[id]
    if !ok do return 0
    
    out_len := csv.streaming_lazyrow_output_len(d)
    if out_len == 0 do return 0
    
    resize(&output_buffer, out_len)
    copy(output_buffer[:], d.output[:])
    
    return i32(out_len)
}

// Clear decoder's output buffer after reading
@(export)
clear_streaming_lazyrow_output :: proc "c" (id: i32) {
    context = runtime.default_context()
    if d, ok := streaming_lazyrow_decoders[id]; ok {
        csv.streaming_lazyrow_clear_output(d)
    }
}

// Finalize decoding - flush any remaining buffered data.
// Returns: number of bytes in output buffer (call get_streaming_lazyrow_output to read)
@(export)
finish_streaming_lazyrow :: proc "c" (id: i32) -> i32 {
    context = runtime.default_context()
    
    d, ok := streaming_lazyrow_decoders[id]
    if !ok do return 0
    
    csv.streaming_lazyrow_finish(d)
    return i32(csv.streaming_lazyrow_output_len(d))
}


/*
Streaming Record Stringifier
============================
High-performance streaming converter from record format to delimited output.
- Accepts arbitrary input chunks (buffers incomplete records internally)
- Accumulates output until threshold before returning
- Handles proper CSV quoting when needed
*/

streaming_record_stringifiers: map[i32]^csv.StreamingRecordStringifier

// Create a streaming record stringifier. Returns stringifier ID.
// Parameters:
//   out_sep: output field separator (e.g., ',' for CSV, '\t' for TSV)
//   field_sep: input field separator (0 = default \x1F)
//   record_sep: input record separator (0 = default \x1E)
//   crlf: 1 = use \r\n line endings, 0 = use \n
//   always_quote: 1 = quote all fields, 0 = quote only when needed
@(export)
create_streaming_record_stringifier :: proc "c" (out_sep: i32, field_sep: i32, record_sep: i32, crlf: i32, always_quote: i32) -> i32 {
    context = runtime.default_context()
    
    s := new(csv.StreamingRecordStringifier)
    s^ = csv.streaming_record_stringifier_init(u8(out_sep), u8(field_sep), u8(record_sep), crlf != 0, always_quote != 0)
    
    id := next_id
    next_id += 1
    streaming_record_stringifiers[id] = s
    return id
}

// Destroy a streaming record stringifier
@(export)
destroy_streaming_record_stringifier :: proc "c" (id: i32) {
    context = runtime.default_context()
    if s, ok := streaming_record_stringifiers[id]; ok {
        csv.streaming_record_stringifier_destroy(s)
        free(s)
        delete_key(&streaming_record_stringifiers, id)
    }
}

// Stringify a chunk of record format data from input buffer.
// Buffers incomplete records internally. Output accumulates in stringifier.
// Returns: 1 if output >= threshold (ready to read), 0 otherwise
@(export)
streaming_record_stringify :: proc "c" (id: i32, input_len: i32) -> i32 {
    context = runtime.default_context()
    
    s, ok := streaming_record_stringifiers[id]
    if !ok do return 0
    
    input := input_buffer[:input_len]
    csv.streaming_record_stringify(s, input)
    
    return 1 if csv.streaming_record_has_output(s) else 0
}

// Get output from streaming stringifier. Copies to output_buffer.
// Returns: number of bytes written to output buffer
@(export)
get_streaming_record_output :: proc "c" (id: i32) -> i32 {
    context = runtime.default_context()
    
    s, ok := streaming_record_stringifiers[id]
    if !ok do return 0
    
    out_len := csv.streaming_record_output_len(s)
    if out_len == 0 do return 0
    
    resize(&output_buffer, out_len)
    copy(output_buffer[:], s.output[:])
    
    return i32(out_len)
}

// Clear stringifier's output buffer after reading
@(export)
clear_streaming_record_output :: proc "c" (id: i32) {
    context = runtime.default_context()
    if s, ok := streaming_record_stringifiers[id]; ok {
        csv.streaming_record_clear_output(s)
    }
}

// Finalize stringifying - flush any remaining buffered data.
// Returns: number of bytes in output buffer (call get_streaming_record_output to read)
@(export)
finish_streaming_record :: proc "c" (id: i32) -> i32 {
    context = runtime.default_context()
    
    s, ok := streaming_record_stringifiers[id]
    if !ok do return 0
    
    csv.streaming_record_finish(s)
    return i32(csv.streaming_record_output_len(s))
}


// Record2TSV exports are in record2tsv.odin with conditional SIMD/scalar implementation

