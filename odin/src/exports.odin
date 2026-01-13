package csv_wasm

import "base:runtime"
import "core:slice"
import "csv"

// WASM exports for RFC 4180 CSV parser

// Parser instance storage
delimited_parsers: map[i32]^csv.DelimitedParser
span_parsers: map[i32]^csv.SpanParser
delimited_stringifiers: map[i32]^csv.DelimitedStringifier
next_id: i32 = 1

// Shared memory buffers
input_buffer: rawptr
input_capacity: int
output_buffer: rawptr
output_capacity: int

// Error reporting area (10 bytes at start of output buffer)
// [0]: error_kind, [1]: reserved, [2-5]: row (u32 LE), [6-9]: col (u32 LE)

main :: proc() {}

// =============================================================================
// Buffer Management
// =============================================================================

@(export)
alloc_input_buffer :: proc "c" (size: i32) -> rawptr {
    context = runtime.default_context()
    if input_buffer != nil do free(input_buffer)
    data := make([]u8, int(size))
    input_buffer = raw_data(data)
    input_capacity = int(size)
    return input_buffer
}

@(export)
alloc_output_buffer :: proc "c" (size: i32) -> rawptr {
    context = runtime.default_context()
    if output_buffer != nil do free(output_buffer)
    data := make([]u8, int(size))
    output_buffer = raw_data(data)
    output_capacity = int(size)
    return output_buffer
}

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

// =============================================================================
// Delimited Parser (outputs \x1F/\x1E separated text)
// =============================================================================

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

@(export)
destroy_delimited_parser :: proc "c" (id: i32) {
    context = runtime.default_context()
    if p, ok := delimited_parsers[id]; ok {
        csv.delimited_destroy(p)
        free(p)
        delete_key(&delimited_parsers, id)
    }
}

// Parse chunk. Returns: high 32 bits = rows, low 32 bits = error (0 = ok)
// Output written to parser's internal buffer
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

// Finish parsing. Returns same format as parse_delimited
@(export)
finish_delimited :: proc "c" (id: i32) -> i64 {
    context = runtime.default_context()
    
    p, ok := delimited_parsers[id]
    if !ok do return -1
    
    rows, success := csv.delimited_finish(p)
    
    err: i32 = 0 if success else i32(p.error.kind)
    return (i64(rows) << 32) | i64(err)
}

// Copy parser output to output buffer. Returns bytes written.
// Only returns complete records (those ending with \x1E)
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

// Clear parser output buffer (call after reading output)
@(export)
clear_delimited_output :: proc "c" (id: i32) {
    context = runtime.default_context()
    if p, ok := delimited_parsers[id]; ok {
        csv.delimited_reset_output(p)
    }
}

// Get error details. Returns: high 32 = row, low 32 = col
@(export)
get_delimited_error :: proc "c" (id: i32) -> i64 {
    context = runtime.default_context()
    
    p, ok := delimited_parsers[id]
    if !ok do return 0
    
    return (i64(p.error.row) << 32) | i64(p.error.col)
}

// =============================================================================
// Direct Buffer Parser (zero-copy output)
// =============================================================================

// Streaming parser state for direct buffer output
DirectParser :: struct {
    state: csv.CsvState,
    row: u32,
    fields_in_row: u32,
    opts: csv.CsvOptions,
    error: csv.CsvError,
    row_started: bool,
    // Carry buffer for incomplete records
    carry: [dynamic]u8,
}

direct_parsers: map[i32]^DirectParser

@(export)
create_direct_parser :: proc "c" (separator: i32, strict: i32) -> i32 {
    context = runtime.default_context()
    
    p := new(DirectParser)
    p.opts = csv.CsvOptions{
        separator = u8(separator) if separator > 0 else ',',
        strict = strict != 0,
    }
    p.state = .FieldStart
    p.carry = make([dynamic]u8)
    
    id := next_id
    next_id += 1
    direct_parsers[id] = p
    return id
}

@(export)
destroy_direct_parser :: proc "c" (id: i32) {
    context = runtime.default_context()
    if p, ok := direct_parsers[id]; ok {
        delete(p.carry)
        free(p)
        delete_key(&direct_parsers, id)
    }
}

// Parse input and write directly to output buffer
// Returns: bytes written to output (complete records only)
// Incomplete record data is carried to next call
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
                if p.row_started && out_len < out_cap { out[out_len] = csv.FIELD_SEP; out_len += 1 }
                p.row_started = true
                p.state = .Quoted
            } else if c == sep {
                if p.row_started && out_len < out_cap { out[out_len] = csv.FIELD_SEP; out_len += 1 }
                p.row_started = true
                p.fields_in_row += 1
            } else if c == '\r' {
                if p.row_started {
                    if out_len < out_cap { out[out_len] = csv.FIELD_SEP; out_len += 1 }
                    p.fields_in_row += 1
                }
                p.state = .RecordEnd
            } else if c == '\n' {
                if p.row_started {
                    if out_len < out_cap { out[out_len] = csv.FIELD_SEP; out_len += 1 }
                    p.fields_in_row += 1
                    if out_len < out_cap { out[out_len] = csv.RECORD_SEP; out_len += 1 }
                }
                p.row += 1
                p.fields_in_row = 0
                p.row_started = false
                record_start = out_len
            } else {
                if p.row_started && out_len < out_cap { out[out_len] = csv.FIELD_SEP; out_len += 1 }
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
            } else if c == '\n' {
                p.fields_in_row += 1
                if out_len < out_cap { out[out_len] = csv.RECORD_SEP; out_len += 1 }
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
            } else if c == '\n' {
                p.fields_in_row += 1
                if out_len < out_cap { out[out_len] = csv.RECORD_SEP; out_len += 1 }
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
            if c == '\n' {
                if out_len < out_cap { out[out_len] = csv.RECORD_SEP; out_len += 1 }
                p.row += 1
                p.fields_in_row = 0
                p.row_started = false
                p.state = .FieldStart
                record_start = out_len
            } else {
                if out_len < out_cap { out[out_len] = csv.RECORD_SEP; out_len += 1 }
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
        for j := record_start - carry_len; j < out_len; j += 1 {
            append(&p.carry, out[j])
        }
        out_len = record_start
    }
    
    return i32(out_len)
}

// Finish parsing - flush any remaining data
@(export)
finish_direct :: proc "c" (id: i32) -> i32 {
    context = runtime.default_context()
    
    p, ok := direct_parsers[id]
    if !ok do return 0
    
    out := ([^]u8)(output_buffer)
    out_len := 0
    
    // Flush carry buffer
    for b in p.carry {
        out[out_len] = b
        out_len += 1
    }
    
    // Add final record separator if there's data
    if p.row_started && out_len > 0 {
        out[out_len] = csv.RECORD_SEP
        out_len += 1
    }
    
    clear(&p.carry)
    return i32(out_len)
}

// =============================================================================
// Span Parser (outputs offset tuples)
// =============================================================================

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

@(export)
destroy_span_parser :: proc "c" (id: i32) {
    context = runtime.default_context()
    if p, ok := span_parsers[id]; ok {
        csv.span_destroy(p)
        free(p)
        delete_key(&span_parsers, id)
    }
}

// Parse chunk. Returns: high 32 bits = rows, low 32 bits = error (0 = ok)
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

// Finish parsing
@(export)
finish_span :: proc "c" (id: i32, input_len: i32) -> i64 {
    context = runtime.default_context()
    
    p, ok := span_parsers[id]
    if !ok do return -1
    
    rows, success := csv.span_finish(p, u32(input_len))
    
    err: i32 = 0 if success else i32(p.error.kind)
    return (i64(rows) << 32) | i64(err)
}

// Get span count
@(export)
get_span_count :: proc "c" (id: i32) -> i32 {
    context = runtime.default_context()
    p, ok := span_parsers[id]
    if !ok do return 0
    return i32(len(p.spans))
}

// Get row count
@(export)
get_span_row_count :: proc "c" (id: i32) -> i32 {
    context = runtime.default_context()
    p, ok := span_parsers[id]
    if !ok do return 0
    return i32(len(p.row_ends))
}

// Copy spans to output buffer. Format: [start:u32, end:u32, flags:u32] per span
// Returns number of spans written
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

// Copy row_ends to output buffer
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

// Clear span parser output
@(export)
clear_span_output :: proc "c" (id: i32) {
    context = runtime.default_context()
    if p, ok := span_parsers[id]; ok {
        csv.span_reset_output(p)
    }
}

// =============================================================================
// Delimited Stringifier
// =============================================================================

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

@(export)
destroy_delimited_stringifier :: proc "c" (id: i32) {
    context = runtime.default_context()
    if s, ok := delimited_stringifiers[id]; ok {
        csv.delimited_stringify_destroy(s)
        free(s)
        delete_key(&delimited_stringifiers, id)
    }
}

// Stringify delimited input. Returns 1 on success, 0 on error
@(export)
stringify_delimited :: proc "c" (id: i32, input_len: i32) -> i32 {
    context = runtime.default_context()
    
    s, ok := delimited_stringifiers[id]
    if !ok do return 0
    
    input := slice.from_ptr(cast(^u8)input_buffer, int(input_len))
    success := csv.delimited_stringify(s, input)
    
    return 1 if success else 0
}

// Get stringifier output
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

// Clear stringifier output
@(export)
clear_stringify_output :: proc "c" (id: i32) {
    context = runtime.default_context()
    if s, ok := delimited_stringifiers[id]; ok {
        csv.delimited_stringify_reset(s)
    }
}
