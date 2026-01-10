package line_processor_js_wasm

import "core:mem"
import "core:strings"
import "base:runtime"

// Entry point required for js_wasm32
main :: proc() {}

// Simple line processor that uses make/delete internally
lines: [dynamic]string

@(export)
init_processor :: proc "c" () {
    context = runtime.default_context()
    
    // Clean up existing lines
    for line in lines {
        delete(line)
    }
    delete(lines)
    
    // Initialize fresh
    lines = make([dynamic]string)
}

@(export)
add_line :: proc "c" (text_ptr: rawptr, text_len: u32) -> u32 {
    context = runtime.default_context()
    
    if text_ptr == nil || text_len == 0 {
        return u32(len(lines))
    }
    
    // Convert to slice and clone as string
    text_bytes := mem.slice_ptr(cast(^u8)text_ptr, int(text_len))
    line_str := strings.clone_from_bytes(text_bytes)
    
    // Add to our dynamic array
    append(&lines, line_str)
    
    return u32(len(lines))
}

@(export)
get_line_count :: proc "c" () -> u32 {
    return u32(len(lines))
}

@(export)
get_line :: proc "c" (index: u32) -> rawptr {
    if int(index) >= len(lines) {
        return nil
    }
    return raw_data(lines[index])
}

@(export)
get_line_length :: proc "c" (index: u32) -> u32 {
    if int(index) >= len(lines) {
        return 0
    }
    return u32(len(lines[index]))
}

@(export)
clear_lines :: proc "c" () {
    context = runtime.default_context()
    
    for line in lines {
        delete(line)
    }
    clear(&lines)
}

@(export)
get_memory_usage :: proc "c" () -> u64 {
    total: u64 = 0
    for line in lines {
        total += u64(len(line))
    }
    total += u64(cap(lines) * size_of(string))
    return total
}
