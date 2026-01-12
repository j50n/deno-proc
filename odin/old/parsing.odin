package csv_wasm

// Core parsing utilities - allocation-free inner loops

// Parse a single field - uses out parameters to avoid struct copy overhead in WASM
parse_field_out :: #force_inline proc(input: string, start: int, sep: u8, 
    out_end: ^int, out_field_start: ^int, out_field_end: ^int, out_needs_unescape: ^bool) -> bool {
    n := len(input)
    if start >= n {
        out_end^ = start
        out_field_start^ = start
        out_field_end^ = start
        out_needs_unescape^ = false
        return true
    }
    
    pos := start
    c := input[pos]
    
    // Quoted field
    if c == '"' {
        field_start := pos + 1
        pos += 1
        needs_unescape := false
        
        for pos < n {
            c = input[pos]
            if c == '"' {
                pos += 1
                if pos >= n {
                    out_end^ = pos
                    out_field_start^ = field_start
                    out_field_end^ = pos - 1
                    out_needs_unescape^ = needs_unescape
                    return true
                }
                c = input[pos]
                if c == '"' {
                    needs_unescape = true
                    pos += 1
                    continue
                }
                field_end := pos - 1
                if c == sep {
                    out_end^ = pos + 1
                    out_field_start^ = field_start
                    out_field_end^ = field_end
                    out_needs_unescape^ = needs_unescape
                    return true
                }
                if c == '\r' || c == '\n' {
                    out_end^ = pos
                    out_field_start^ = field_start
                    out_field_end^ = field_end
                    out_needs_unescape^ = needs_unescape
                    return true
                }
                pos += 1
            } else {
                pos += 1
            }
        }
        return false  // incomplete
    }
    
    // Unquoted field
    field_start := pos
    for pos < n {
        c = input[pos]
        if c == sep {
            out_end^ = pos + 1
            out_field_start^ = field_start
            out_field_end^ = pos
            out_needs_unescape^ = false
            return true
        }
        if c == '\r' || c == '\n' {
            out_end^ = pos
            out_field_start^ = field_start
            out_field_end^ = pos
            out_needs_unescape^ = false
            return true
        }
        pos += 1
    }
    out_end^ = pos
    out_field_start^ = field_start
    out_field_end^ = pos
    out_needs_unescape^ = false
    return true
}
