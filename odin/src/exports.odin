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

// Shared memory buffers for WASM ↔ JS data transfer
input_buffer: rawptr
input_capacity: int
output_buffer: rawptr
output_capacity: int

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
// Caller writes CSV data here before calling parse functions.
@(export)
alloc_input_buffer :: proc "c" (size: i32) -> rawptr {
    context = runtime.default_context()
    if input_buffer != nil do free(input_buffer)
    data := make([]u8, int(size))
    input_buffer = raw_data(data)
    input_capacity = int(size)
    return input_buffer
}

// Allocate output buffer. Returns pointer to buffer start.
// Parser writes results here; caller reads after parse calls.
@(export)
alloc_output_buffer :: proc "c" (size: i32) -> rawptr {
    context = runtime.default_context()
    if output_buffer != nil do free(output_buffer)
    data := make([]u8, int(size))
    output_buffer = raw_data(data)
    output_capacity = int(size)
    return output_buffer
}

// Free a previously allocated buffer
@(export)
free_buffer :: proc "c" (ptr: rawptr) {
    context = runtime.default_context()
    if ptr == nil do return
    if ptr == input_buffer {
        input_buffer = nil
        input_capacity = 0
    } else if ptr == output_buffer {
        output_buffer = nil
        output_capacity = 0
    }
    free(ptr)
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
    
    input := slice.from_ptr(cast(^u8)input_buffer, int(input_len))
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
    
    out_slice := slice.from_ptr(cast(^u8)output_buffer, output_capacity)
    copy_len := min(len(output), output_capacity)
    copy(out_slice[:copy_len], output[:copy_len])
    
    return i32(copy_len)
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
// Returns: number of bytes written (complete records only).
// Incomplete record data is carried to the next call automatically.
@(export)
parse_direct :: proc "c" (id: i32, input_len: i32) -> i32 {
    context = runtime.default_context()
    
    p, ok := direct_parsers[id]
    if !ok do return 0
    if p.error.kind != .None do return 0
    
    input := slice.from_ptr(cast(^u8)input_buffer, int(input_len))
    out := ([^]u8)(output_buffer)
    out_len := 0
    out_cap := output_capacity
    
    sep := p.opts.separator
    field_sep := p.field_sep
    record_sep := p.record_sep
    input_rec_sep := p.input_record_sep
    
    // First, flush any carried data
    for b in p.carry {
        if out_len < out_cap {
            out[out_len] = b
            out_len += 1
        }
    }
    carry_len := len(p.carry)
    clear(&p.carry)
    
    record_start := 0  // Start of current record in output
    
    for i := 0; i < len(input); i += 1 {
        c := input[i]
        
        switch p.state {
        case .FieldStart:
            if c == '"' {
                if p.row_started && out_len < out_cap { out[out_len] = field_sep; out_len += 1 }
                p.row_started = true
                p.state = .Quoted
            } else if c == sep {
                if p.row_started && out_len < out_cap { out[out_len] = field_sep; out_len += 1 }
                p.row_started = true
                p.fields_in_row += 1
            } else if c == '\r' {
                if p.row_started {
                    if out_len < out_cap { out[out_len] = field_sep; out_len += 1 }
                    p.fields_in_row += 1
                }
                p.state = .RecordEnd
            } else if c == input_rec_sep {
                if p.row_started {
                    if out_len < out_cap { out[out_len] = field_sep; out_len += 1 }
                    p.fields_in_row += 1
                    if out_len < out_cap { out[out_len] = record_sep; out_len += 1 }
                }
                p.row += 1
                p.fields_in_row = 0
                p.row_started = false
                record_start = out_len
            } else {
                if p.row_started && out_len < out_cap { out[out_len] = field_sep; out_len += 1 }
                p.row_started = true
                if out_len < out_cap { out[out_len] = c; out_len += 1 }
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
                if out_len < out_cap { out[out_len] = record_sep; out_len += 1 }
                p.row += 1
                p.fields_in_row = 0
                p.row_started = false
                p.state = .FieldStart
                record_start = out_len
            } else {
                if out_len < out_cap { out[out_len] = c; out_len += 1 }
            }
            
        case .Quoted:
            if c == '"' {
                p.state = .QuoteInQuoted
            } else {
                if out_len < out_cap { out[out_len] = c; out_len += 1 }
            }
            
        case .QuoteInQuoted:
            if c == '"' {
                if out_len < out_cap { out[out_len] = '"'; out_len += 1 }
                p.state = .Quoted
            } else if c == sep {
                p.fields_in_row += 1
                p.state = .FieldStart
            } else if c == '\r' {
                p.fields_in_row += 1
                p.state = .RecordEnd
            } else if c == input_rec_sep {
                p.fields_in_row += 1
                if out_len < out_cap { out[out_len] = record_sep; out_len += 1 }
                p.row += 1
                p.fields_in_row = 0
                p.row_started = false
                p.state = .FieldStart
                record_start = out_len
            } else {
                p.error = csv.CsvError{.InvalidCharAfterQuote, p.row, 0}
                return 0
            }
            
        case .RecordEnd:
            if c == input_rec_sep {
                if out_len < out_cap { out[out_len] = record_sep; out_len += 1 }
                p.row += 1
                p.fields_in_row = 0
                p.row_started = false
                p.state = .FieldStart
                record_start = out_len
            } else {
                if out_len < out_cap { out[out_len] = record_sep; out_len += 1 }
                p.row += 1
                p.fields_in_row = 0
                p.row_started = false
                p.state = .FieldStart
                record_start = out_len
                i -= 1
            }
        }
    }
    
    // Carry incomplete record to next call
    if record_start < out_len {
        for j := record_start; j < out_len; j += 1 {
            append(&p.carry, out[j])
        }
        out_len = record_start
    }
    
    return i32(out_len)
}

// Finalize parsing - flush any remaining buffered data to output.
// Returns: number of bytes written to output buffer.
@(export)
finish_direct :: proc "c" (id: i32) -> i32 {
    context = runtime.default_context()
    
    p, ok := direct_parsers[id]
    if !ok do return 0
    
    out := ([^]u8)(output_buffer)
    out_len := 0
    out_cap := output_capacity
    
    // Flush carry buffer
    for b in p.carry {
        if out_len < out_cap {
            out[out_len] = b
            out_len += 1
        }
    }
    
    // Add final record separator if there's data
    if p.row_started && out_len > 0 && out_len < out_cap {
        out[out_len] = p.record_sep
        out_len += 1
    }
    
    clear(&p.carry)
    return i32(out_len)
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
    
    input := slice.from_ptr(cast(^u8)input_buffer, int(input_len))
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
    max_spans := output_capacity / 12
    copy_count := min(len(spans), max_spans)
    
    out := slice.from_ptr(cast(^u32)output_buffer, copy_count * 3)
    for i := 0; i < copy_count; i += 1 {
        out[i*3 + 0] = spans[i].start
        out[i*3 + 1] = spans[i].end
        out[i*3 + 2] = u32(spans[i].flags)
    }
    
    return i32(copy_count)
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
    
    max_rows := output_capacity / 4
    copy_count := min(len(row_ends), max_rows)
    
    out := slice.from_ptr(cast(^u32)output_buffer, copy_count)
    copy(out[:copy_count], row_ends[:copy_count])
    
    return i32(copy_count)
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
    
    input := slice.from_ptr(cast(^u8)input_buffer, int(input_len))
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
    
    out_slice := slice.from_ptr(cast(^u8)output_buffer, output_capacity)
    copy_len := min(len(output), output_capacity)
    copy(out_slice[:copy_len], output[:copy_len])
    
    return i32(copy_len)
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
    
    input := slice.from_ptr(cast(^u8)input_buffer, int(input_len))
    out := ([^]u8)(output_buffer)
    out_len := 0
    out_cap := output_capacity
    
    field_sep := s.field_sep
    record_sep := s.record_sep
    out_sep := s.opts.separator
    always_quote := s.opts.always_quote
    line_ending := s.opts.line_ending
    
    field_start := 0
    in_field := false
    first_field_in_row := true
    
    for i := 0; i < len(input); i += 1 {
        c := input[i]
        
        if c == field_sep || c == record_sep {
            // End of field
            field := input[field_start:i]
            
            // Add separator before field (except first in row)
            if !first_field_in_row && out_len < out_cap {
                out[out_len] = out_sep
                out_len += 1
            }
            first_field_in_row = false
            
            // Check if field needs quoting
            needs_quote := always_quote
            if !needs_quote {
                for b in field {
                    if b == out_sep || b == '"' || b == '\n' || b == '\r' {
                        needs_quote = true
                        break
                    }
                }
            }
            
            // Write field
            if needs_quote {
                if out_len < out_cap { out[out_len] = '"'; out_len += 1 }
                for b in field {
                    if b == '"' {
                        if out_len < out_cap { out[out_len] = '"'; out_len += 1 }
                        if out_len < out_cap { out[out_len] = '"'; out_len += 1 }
                    } else {
                        if out_len < out_cap { out[out_len] = b; out_len += 1 }
                    }
                }
                if out_len < out_cap { out[out_len] = '"'; out_len += 1 }
            } else {
                for b in field {
                    if out_len < out_cap { out[out_len] = b; out_len += 1 }
                }
            }
            
            // End of record
            if c == record_sep {
                if line_ending == .CRLF && out_len < out_cap {
                    out[out_len] = '\r'
                    out_len += 1
                }
                if out_len < out_cap {
                    out[out_len] = '\n'
                    out_len += 1
                }
                first_field_in_row = true
            }
            
            field_start = i + 1
        }
    }
    
    return i32(out_len)
}
