package csv_wasm

import "base:runtime"

// Lazy CSV parser
// Output per row: [total_len:u32] [num_cols:u32] [end_0:u32]...[end_n-1:u32] [utf8 data]

FieldSpan :: struct { start, end: int, unescape: bool }

LazyParser :: struct {
    options: ParseOptions,
    pending: GrowBuffer,
    output: FastBuffer,
    row_count: int,
    allocator: runtime.Allocator,
}

make_lazy_parser :: proc(options: ParseOptions, allocator := context.allocator) -> LazyParser {
    return LazyParser{
        options = options,
        pending = make_grow_buffer(1024, allocator),
        output = make_fast_buffer(65536, allocator),
        row_count = 0,
        allocator = allocator,
    }
}

destroy_lazy_parser :: proc(p: ^LazyParser) {
    destroy_buffer(&p.pending)
    destroy_fast_buffer(&p.output)
}

process_chunk_lazy :: proc(p: ^LazyParser, input: []u8) -> int {
    work_data: string
    combined: []u8 = nil
    defer if combined != nil { delete(combined, p.allocator) }
    
    if len(p.pending.data) > 0 {
        combined = make([]u8, len(p.pending.data) + len(input), p.allocator)
        copy(combined[:len(p.pending.data)], p.pending.data[:])
        copy(combined[len(p.pending.data):], input)
        work_data = string(combined)
        clear_buffer(&p.pending)
    } else {
        work_data = string(input)
    }
    
    clear_fast_buffer(&p.output)
    ensure_fast_capacity(&p.output, len(work_data) * 2)
    p.row_count = 0
    
    pos := 0
    sep := p.options.separator
    spans: [256]FieldSpan
    
    // Out parameters for parse_field
    f_end, f_start, f_field_end: int
    f_needs_unescape: bool
    
    for pos < len(work_data) {
        row_start := pos
        row_output_start := p.output.len
        
        // Parse row - collect spans
        n := 0
        complete := true
        
        for {
            ok := parse_field_out(work_data, pos, sep, &f_end, &f_start, &f_field_end, &f_needs_unescape)
            if !ok { complete = false; break }
            
            if n < 256 {
                spans[n] = FieldSpan{f_start, f_field_end, f_needs_unescape}
            }
            n += 1
            
            trailing := f_end > f_field_end && f_field_end < len(work_data) && work_data[f_field_end] == sep
            pos = f_end
            
            if pos >= len(work_data) || work_data[pos] == '\r' || work_data[pos] == '\n' {
                if trailing && n < 256 { spans[n] = FieldSpan{0, 0, false}; n += 1 }
                break
            }
        }
        
        if !complete {
            p.output.len = row_output_start
            append_bytes(&p.pending, transmute([]u8)work_data[row_start:])
            break
        }
        
        if pos >= len(work_data) && !(pos > 0 && (work_data[pos-1] == '\n' || work_data[pos-1] == '\r')) {
            p.output.len = row_output_start
            append_bytes(&p.pending, transmute([]u8)work_data[row_start:])
            break
        }
        
        // Write header: total_len placeholder, num_cols, offset placeholders
        total_pos := p.output.len
        p.output.len += 4
        write_u32(&p.output, u32(n))
        offsets_pos := p.output.len
        p.output.len += n * 4
        
        // Write data and fill in offsets
        cum: u32 = 0
        for i := 0; i < n; i += 1 {
            s := spans[i]
            data_start := p.output.len
            if s.unescape {
                write_unescaped_fast(&p.output, work_data[s.start:s.end])
            } else {
                // Inline copy
                out_pos := p.output.len
                for j := s.start; j < s.end; j += 1 {
                    p.output.data[out_pos] = work_data[j]
                    out_pos += 1
                }
                p.output.len = out_pos
            }
            cum += u32(p.output.len - data_start)
            write_u32_at(&p.output, offsets_pos + i*4, cum)
        }
        write_u32_at(&p.output, total_pos, u32(p.output.len - total_pos - 4))
        
        p.row_count += 1
        if pos < len(work_data) && work_data[pos] == '\r' { pos += 1 }
        if pos < len(work_data) && work_data[pos] == '\n' { pos += 1 }
    }
    
    return p.row_count
}

write_u32 :: #force_inline proc(buf: ^FastBuffer, val: u32) {
    buf.data[buf.len] = u8(val)
    buf.data[buf.len+1] = u8(val >> 8)
    buf.data[buf.len+2] = u8(val >> 16)
    buf.data[buf.len+3] = u8(val >> 24)
    buf.len += 4
}

write_u32_at :: #force_inline proc(buf: ^FastBuffer, pos: int, val: u32) {
    buf.data[pos] = u8(val)
    buf.data[pos+1] = u8(val >> 8)
    buf.data[pos+2] = u8(val >> 16)
    buf.data[pos+3] = u8(val >> 24)
}

get_lazy_output :: proc(p: ^LazyParser) -> []u8 {
    return p.output.data[:p.output.len]
}
