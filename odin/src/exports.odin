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
// Returns: number of bytes written to output buffer
@(export)
lazyrow_encode :: proc "c" (id: i32, input_len: i32) -> i32 {
    context = runtime.default_context()
    
    e, ok := lazyrow_encoders[id]
    if !ok do return 0
    
    input := slice.from_ptr(cast(^u8)input_buffer, int(input_len))
    csv.lazyrow_encoder_reset(e)
    csv.lazyrow_encode(e, input)
    
    // Copy to output buffer
    out_len := min(len(e.output), output_capacity)
    if out_len > 0 {
        out := slice.from_ptr(cast(^u8)output_buffer, out_len)
        copy(out, e.output[:out_len])
    }
    
    return i32(out_len)
}

// Encode record format to binary lazyrow format (from output buffer).
// Input: record format in output buffer
// Output: binary lazyrow in input buffer (swapped to avoid copy)
// Returns: number of bytes written to input buffer
@(export)
lazyrow_encode_from_output :: proc "c" (id: i32, input_len: i32) -> i32 {
    context = runtime.default_context()
    
    e, ok := lazyrow_encoders[id]
    if !ok do return 0
    
    input := slice.from_ptr(cast(^u8)output_buffer, int(input_len))
    csv.lazyrow_encoder_reset(e)
    csv.lazyrow_encode(e, input)
    
    // Copy to input buffer (swapped)
    out_len := min(len(e.output), input_capacity)
    if out_len > 0 {
        out := slice.from_ptr(cast(^u8)input_buffer, out_len)
        copy(out, e.output[:out_len])
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
// Returns: number of bytes written to output buffer
@(export)
lazyrow_decode :: proc "c" (id: i32, input_len: i32) -> i32 {
    context = runtime.default_context()
    
    d, ok := lazyrow_decoders[id]
    if !ok do return 0
    
    input := slice.from_ptr(cast(^u8)input_buffer, int(input_len))
    csv.lazyrow_decoder_reset(d)
    csv.lazyrow_decode(d, input)
    
    // Copy to output buffer
    out_len := min(len(d.output), output_capacity)
    if out_len > 0 {
        out := slice.from_ptr(cast(^u8)output_buffer, out_len)
        copy(out, d.output[:out_len])
    }
    
    return i32(out_len)
}

// Decode binary lazyrow format directly to delimited output.
// Input: binary lazyrow in input buffer
// Output: delimited text in output buffer (with custom separators)
// Returns: number of bytes written to output buffer
@(export)
lazyrow_decode_delimited :: proc "c" (id: i32, input_len: i32, field_sep: i32, record_sep: i32) -> i32 {
    context = runtime.default_context()
    
    d, ok := lazyrow_decoders[id]
    if !ok do return 0
    
    input := slice.from_ptr(cast(^u8)input_buffer, int(input_len))
    csv.lazyrow_decoder_reset(d)
    csv.lazyrow_decode_delimited(d, input, u8(field_sep), u8(record_sep))
    
    // Copy to output buffer
    out_len := min(len(d.output), output_capacity)
    if out_len > 0 {
        out := slice.from_ptr(cast(^u8)output_buffer, out_len)
        copy(out, d.output[:out_len])
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

/*
Direct CSV-to-LazyRow Parser
============================
Parses CSV and outputs binary lazyrow format directly in one pass.
Uses fixed-size buffers to avoid dynamic allocations during parsing.
*/

MAX_FIELDS :: 1024  // Max fields per row
MAX_ROW_DATA :: 262144  // Max data bytes per row (256KB)

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
lazyrow_direct_emit :: proc(p: ^LazyRowDirectParser, out: [^]u8, out_len: ^int, out_cap: int) -> bool {
    // Finalize current field
    if p.field_count < MAX_FIELDS {
        p.field_lengths[p.field_count] = u32(p.data_len - p.current_field_start)
        p.field_count += 1
    }
    
    field_count := u32(p.field_count)
    header_size := 4 + int(field_count) * 4
    row_length := u32(header_size + p.data_len)
    
    // Check space
    if out_len^ + int(row_length) + 4 > out_cap do return false
    
    // Write row_length
    out[out_len^] = u8(row_length); out_len^ += 1
    out[out_len^] = u8(row_length >> 8); out_len^ += 1
    out[out_len^] = u8(row_length >> 16); out_len^ += 1
    out[out_len^] = u8(row_length >> 24); out_len^ += 1
    
    // Write field_count
    out[out_len^] = u8(field_count); out_len^ += 1
    out[out_len^] = u8(field_count >> 8); out_len^ += 1
    out[out_len^] = u8(field_count >> 16); out_len^ += 1
    out[out_len^] = u8(field_count >> 24); out_len^ += 1
    
    // Write field lengths
    for i := 0; i < p.field_count; i += 1 {
        flen := p.field_lengths[i]
        out[out_len^] = u8(flen); out_len^ += 1
        out[out_len^] = u8(flen >> 8); out_len^ += 1
        out[out_len^] = u8(flen >> 16); out_len^ += 1
        out[out_len^] = u8(flen >> 24); out_len^ += 1
    }
    
    // Write field data
    for i := 0; i < p.data_len; i += 1 {
        out[out_len^] = p.field_data[i]; out_len^ += 1
    }
    
    lazyrow_direct_reset_row(p)
    return true
}

// Parse CSV from input buffer, output lazyrow binary to output buffer.
// Returns: number of bytes written to output buffer.
@(export)
parse_to_lazyrow :: proc "c" (id: i32, input_len: i32) -> i32 {
    context = runtime.default_context()
    
    p, ok := lazyrow_direct_parsers[id]
    if !ok do return 0
    if p.error.kind != .None do return 0
    
    input := slice.from_ptr(cast(^u8)input_buffer, int(input_len))
    out := ([^]u8)(output_buffer)
    out_len := 0
    out_cap := output_capacity
    
    sep := p.opts.separator
    rec_sep := p.input_record_sep
    
    for i := 0; i < len(input); i += 1 {
        c := input[i]
        
        switch p.state {
        case .FieldStart:
            if c == '"' {
                p.row_started = true
                p.state = .Quoted
            } else if c == sep {
                // End current field, start new one
                if p.field_count < MAX_FIELDS {
                    p.field_lengths[p.field_count] = u32(p.data_len - p.current_field_start)
                    p.field_count += 1
                }
                p.current_field_start = p.data_len
                p.row_started = true
            } else if c == '\r' {
                if p.row_started && p.field_count < MAX_FIELDS {
                    p.field_lengths[p.field_count] = u32(p.data_len - p.current_field_start)
                    p.field_count += 1
                }
                p.state = .RecordEnd
            } else if c == rec_sep {
                if p.row_started {
                    if !lazyrow_direct_emit(p, out, &out_len, out_cap) {
                        append(&p.carry, ..input[i+1:])
                        return i32(out_len)
                    }
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
                if p.field_count < MAX_FIELDS {
                    p.field_lengths[p.field_count] = u32(p.data_len - p.current_field_start)
                    p.field_count += 1
                }
                p.state = .RecordEnd
            } else if c == rec_sep {
                if !lazyrow_direct_emit(p, out, &out_len, out_cap) {
                    append(&p.carry, ..input[i+1:])
                    return i32(out_len)
                }
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
                if p.field_count < MAX_FIELDS {
                    p.field_lengths[p.field_count] = u32(p.data_len - p.current_field_start)
                    p.field_count += 1
                }
                p.state = .RecordEnd
            } else if c == rec_sep {
                if !lazyrow_direct_emit(p, out, &out_len, out_cap) {
                    append(&p.carry, ..input[i+1:])
                    return i32(out_len)
                }
                p.state = .FieldStart
            } else {
                p.error = csv.CsvError{.InvalidCharAfterQuote, p.row, 0}
                return 0
            }
            
        case .RecordEnd:
            if c == rec_sep {
                if !lazyrow_direct_emit(p, out, &out_len, out_cap) {
                    append(&p.carry, ..input[i+1:])
                    return i32(out_len)
                }
                p.state = .FieldStart
            } else {
                if !lazyrow_direct_emit(p, out, &out_len, out_cap) {
                    append(&p.carry, ..input[i:])
                    return i32(out_len)
                }
                p.state = .FieldStart
                i -= 1
            }
        }
    }
    
    return i32(out_len)
}

// Finalize parsing - flush any remaining row.
@(export)
finish_lazyrow_direct :: proc "c" (id: i32) -> i32 {
    context = runtime.default_context()
    
    p, ok := lazyrow_direct_parsers[id]
    if !ok do return 0
    
    out := ([^]u8)(output_buffer)
    out_len := 0
    out_cap := output_capacity
    
    if p.row_started || p.data_len > 0 || p.field_count > 0 {
        lazyrow_direct_emit(p, out, &out_len, out_cap)
    }
    
    return i32(out_len)
}

// Encode record format directly to lazyrow binary (no dynamic allocations).
// Input: record format in input buffer (\x1F/\x1E delimited)
// Output: lazyrow binary in output buffer
// Returns: number of bytes written to output buffer
@(export)
record_to_lazyrow :: proc "c" (input_len: i32) -> i32 {
    context = runtime.default_context()
    
    input := slice.from_ptr(cast(^u8)input_buffer, int(input_len))
    out := ([^]u8)(output_buffer)
    out_len := 0
    out_cap := output_capacity
    
    // Fixed-size buffers for current row
    field_offsets: [MAX_FIELDS]int  // Start offset of each field in input
    field_lengths: [MAX_FIELDS]int  // Length of each field
    field_count := 0
    field_start := 0
    
    for i := 0; i < len(input); i += 1 {
        c := input[i]
        
        if c == csv.FIELD_SEP {
            if field_count < MAX_FIELDS {
                field_offsets[field_count] = field_start
                field_lengths[field_count] = i - field_start
                field_count += 1
            }
            field_start = i + 1
        } else if c == csv.RECORD_SEP {
            // Add final field
            if field_count < MAX_FIELDS {
                field_offsets[field_count] = field_start
                field_lengths[field_count] = i - field_start
                field_count += 1
            }
            
            // Calculate row size
            data_size := 0
            for j := 0; j < field_count; j += 1 {
                data_size += field_lengths[j]
            }
            header_size := 4 + field_count * 4
            row_length := u32(header_size + data_size)
            
            // Check space
            if out_len + int(row_length) + 4 > out_cap do break
            
            // Write row_length
            out[out_len] = u8(row_length); out_len += 1
            out[out_len] = u8(row_length >> 8); out_len += 1
            out[out_len] = u8(row_length >> 16); out_len += 1
            out[out_len] = u8(row_length >> 24); out_len += 1
            
            // Write field_count
            fc := u32(field_count)
            out[out_len] = u8(fc); out_len += 1
            out[out_len] = u8(fc >> 8); out_len += 1
            out[out_len] = u8(fc >> 16); out_len += 1
            out[out_len] = u8(fc >> 24); out_len += 1
            
            // Write field lengths
            for j := 0; j < field_count; j += 1 {
                flen := u32(field_lengths[j])
                out[out_len] = u8(flen); out_len += 1
                out[out_len] = u8(flen >> 8); out_len += 1
                out[out_len] = u8(flen >> 16); out_len += 1
                out[out_len] = u8(flen >> 24); out_len += 1
            }
            
            // Write field data
            for j := 0; j < field_count; j += 1 {
                for k := 0; k < field_lengths[j]; k += 1 {
                    out[out_len] = input[field_offsets[j] + k]
                    out_len += 1
                }
            }
            
            // Reset for next row
            field_count = 0
            field_start = i + 1
        }
    }
    
    return i32(out_len)
}
