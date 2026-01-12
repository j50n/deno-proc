package csv_wasm

import "base:runtime"
import "core:slice"

// WASM exports - all functions use "c" calling convention

// Parser instance storage
parsers: map[i32]^Parser
lazy_parsers: map[i32]^LazyParser
next_parser_id: i32 = 1

// Shared memory buffers (managed by JS)
input_buffer: rawptr
input_capacity: int
output_buffer: rawptr
output_capacity: int

// Required entry point for WASM
main :: proc() {}

@(export)
alloc_input_buffer :: proc "c" (size: i32) -> rawptr {
    context = runtime.default_context()
    if input_buffer != nil {
        free(input_buffer)
    }
    data := make([]u8, int(size))
    input_buffer = raw_data(data)
    input_capacity = int(size)
    return input_buffer
}

@(export)
alloc_output_buffer :: proc "c" (size: i32) -> rawptr {
    context = runtime.default_context()
    if output_buffer != nil {
        free(output_buffer)
    }
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

@(export)
create_csv_parser :: proc "c" (separator: i32, comment: i32, trim: i32, lazy: i32) -> i32 {
    context = runtime.default_context()
    
    opts := default_parse_options()
    if separator > 0 do opts.separator = u8(separator)
    if comment > 0 do opts.comment = u8(comment)
    opts.trim_leading_space = trim != 0
    opts.lazy_quotes = lazy != 0
    
    parser := new(Parser)
    parser^ = make_parser(opts)
    
    id := next_parser_id
    next_parser_id += 1
    parsers[id] = parser
    
    return id
}

@(export)
destroy_csv_parser :: proc "c" (parser_id: i32) {
    context = runtime.default_context()
    
    if parser, ok := parsers[parser_id]; ok {
        destroy_parser(parser)
        free(parser)
        delete_key(&parsers, parser_id)
    }
}

// Process CSV chunk
// Returns: high 32 bits = rows parsed, low 32 bits = bytes written
@(export)
process_csv_chunk :: proc "c" (parser_id: i32, input_len: i32) -> i64 {
    context = runtime.default_context()
    
    parser, ok := parsers[parser_id]
    if !ok do return 0
    
    input_data := slice.from_ptr(cast(^u8)input_buffer, int(input_len))
    rows, bytes := process_chunk(parser, input_data)
    
    // Copy output to output buffer
    output := get_output(parser)
    if len(output) > 0 && output_buffer != nil {
        out_slice := slice.from_ptr(cast(^u8)output_buffer, output_capacity)
        copy_len := min(len(output), output_capacity)
        copy(out_slice[:copy_len], output[:copy_len])
    }
    
    return (i64(rows) << 32) | i64(bytes)
}

// Flush remaining data
@(export)
flush_csv_parser :: proc "c" (parser_id: i32) -> i64 {
    context = runtime.default_context()
    
    parser, ok := parsers[parser_id]
    if !ok do return 0
    
    rows, bytes := flush_parser(parser)
    
    // Copy output to output buffer
    output := get_output(parser)
    if len(output) > 0 && output_buffer != nil {
        out_slice := slice.from_ptr(cast(^u8)output_buffer, output_capacity)
        copy_len := min(len(output), output_capacity)
        copy(out_slice[:copy_len], output[:copy_len])
    }
    
    return (i64(rows) << 32) | i64(bytes)
}

// Get recommended output buffer size
@(export)
get_recommended_output_size :: proc "c" (input_size: i32) -> i32 {
    // CSV output is typically similar size to input, add 50% margin
    return input_size + (input_size >> 1) + 1024
}

// Count rows only - no output generation (for benchmarking)
@(export)
count_csv_rows :: proc "c" (parser_id: i32, input_len: i32) -> i32 {
    context = runtime.default_context()
    
    parser, ok := parsers[parser_id]
    if !ok do return 0
    
    input_data := slice.from_ptr(cast(^u8)input_buffer, int(input_len))
    work_data := string(input_data)
    
    row_count: i32 = 0
    pos := 0
    
    for pos < len(work_data) {
        // Skip to end of row
        in_quote := false
        for pos < len(work_data) {
            c := work_data[pos]
            if c == '"' {
                in_quote = !in_quote
            } else if !in_quote && (c == '\n' || c == '\r') {
                break
            }
            pos += 1
        }
        
        row_count += 1
        
        // Skip line ending
        if pos < len(work_data) && work_data[pos] == '\r' {
            pos += 1
        }
        if pos < len(work_data) && work_data[pos] == '\n' {
            pos += 1
        }
    }
    
    return row_count
}


// === Lazy Parser Exports ===

@(export)
create_lazy_parser :: proc "c" (separator: i32) -> i32 {
    context = runtime.default_context()
    
    opts := default_parse_options()
    if separator > 0 do opts.separator = u8(separator)
    
    parser := new(LazyParser)
    parser^ = make_lazy_parser(opts)
    
    id := next_parser_id
    next_parser_id += 1
    lazy_parsers[id] = parser
    
    return id
}

@(export)
destroy_lazy_parser_export :: proc "c" (parser_id: i32) {
    context = runtime.default_context()
    
    if parser, ok := lazy_parsers[parser_id]; ok {
        destroy_lazy_parser(parser)
        free(parser)
        delete_key(&lazy_parsers, parser_id)
    }
}

// Process chunk, return rows parsed. Output written to output buffer.
// Returns: high 32 bits = rows, low 32 bits = bytes written
@(export)
process_chunk_lazy_export :: proc "c" (parser_id: i32, input_len: i32) -> i64 {
    context = runtime.default_context()
    
    parser, ok := lazy_parsers[parser_id]
    if !ok do return 0
    
    input_data := slice.from_ptr(cast(^u8)input_buffer, int(input_len))
    rows := process_chunk_lazy(parser, input_data)
    
    // Copy output to output buffer
    output := get_lazy_output(parser)
    bytes_written := 0
    if len(output) > 0 && output_buffer != nil {
        bytes_written = min(len(output), output_capacity)
        out_slice := slice.from_ptr(cast(^u8)output_buffer, bytes_written)
        copy(out_slice, output[:bytes_written])
    }
    
    return (i64(rows) << 32) | i64(bytes_written)
}


// Parse fields only - no output, returns field count to prevent optimization
@(export)
parse_fields_only :: proc "c" (input_len: i32, separator: i32) -> i64 {
    context = runtime.default_context()
    
    input_data := slice.from_ptr(cast(^u8)input_buffer, int(input_len))
    work_data := string(input_data)
    sep := u8(separator) if separator > 0 else u8(',')
    
    row_count: i64 = 0
    field_count: i64 = 0
    total_field_len: i64 = 0
    pos := 0
    
    f_end, f_start, f_field_end: int
    f_needs_unescape: bool
    
    for pos < len(work_data) {
        for {
            ok := parse_field_out(work_data, pos, sep, &f_end, &f_start, &f_field_end, &f_needs_unescape)
            if !ok do break
            
            field_count += 1
            total_field_len += i64(f_field_end - f_start)
            pos = f_end
            
            if pos >= len(work_data) do break
            c := work_data[pos]
            if c == '\r' || c == '\n' do break
        }
        
        row_count += 1
        if pos < len(work_data) && work_data[pos] == '\r' do pos += 1
        if pos < len(work_data) && work_data[pos] == '\n' do pos += 1
    }
    
    return (row_count << 32) | (field_count + total_field_len)
}
