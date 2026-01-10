package line_processor_js_wasm

import "core:mem"
import "core:strings"
import "base:runtime"

// Entry point required for js_wasm32
main :: proc() {}

// Line processor state - uses dynamic allocation internally
LineProcessor :: struct {
    leftover_buffer: []u8,  // Dynamically allocated
    output_lines: [dynamic]string,  // Dynamic array of lines
}

// Global processor instance
processor: LineProcessor

@(export)
init_processor :: proc "c" () {
    context = runtime.default_context()
    
    // Clean up any existing state
    if len(processor.leftover_buffer) > 0 {
        delete(processor.leftover_buffer)
    }
    for line in processor.output_lines {
        delete(line)
    }
    delete(processor.output_lines)
    
    // Initialize fresh
    processor.leftover_buffer = make([]u8, 0)
    processor.output_lines = make([dynamic]string)
}

@(export)
process_chunk :: proc "c" (input_ptr: rawptr, input_len: u32) -> u32 {
    context = runtime.default_context()
    
    if input_ptr == nil || input_len == 0 {
        return u32(len(processor.output_lines))
    }
    
    // Convert input to slice
    input_data := mem.slice_ptr(cast(^u8)input_ptr, int(input_len))
    
    // Debug: check what we received
    newline_count := 0
    for b in input_data {
        if b == '\n' {
            newline_count += 1
        }
    }
    
    // Combine leftover + new input into working buffer
    working_buffer := make([]u8, len(processor.leftover_buffer) + len(input_data))
    defer delete(working_buffer)
    
    copy(working_buffer[:len(processor.leftover_buffer)], processor.leftover_buffer)
    copy(working_buffer[len(processor.leftover_buffer):], input_data)
    
    // Clear old leftover buffer
    delete(processor.leftover_buffer)
    processor.leftover_buffer = make([]u8, 0)
    
    // Process lines
    start := 0
    lines_found := 0
    for i in 0..<len(working_buffer) {
        if working_buffer[i] == 10 { // ASCII 10 is \n
            // Found complete line
            line_data := working_buffer[start:i]
            
            // Remove \r if present
            end := len(line_data)
            if end > 0 && line_data[end-1] == 13 { // ASCII 13 is \r
                end -= 1
            }
            
            // Create new string (allocated)
            line_str := strings.clone_from_bytes(line_data[:end])
            append(&processor.output_lines, line_str)
            lines_found += 1
            
            start = i + 1
        }
    }
    
    // Save leftover data
    if start < len(working_buffer) {
        leftover_data := working_buffer[start:]
        processor.leftover_buffer = make([]u8, len(leftover_data))
        copy(processor.leftover_buffer, leftover_data)
    }
    
    return u32(len(processor.output_lines))
}

@(export)
get_line_count :: proc "c" () -> u32 {
    return u32(len(processor.output_lines))
}

@(export)
get_line :: proc "c" (index: u32) -> rawptr {
    context = runtime.default_context()
    
    if int(index) >= len(processor.output_lines) {
        return nil
    }
    
    return raw_data(processor.output_lines[index])
}

@(export)
get_line_length :: proc "c" (index: u32) -> u32 {
    if int(index) >= len(processor.output_lines) {
        return 0
    }
    
    return u32(len(processor.output_lines[index]))
}

@(export)
clear_output :: proc "c" () {
    context = runtime.default_context()
    
    // Free all line strings
    for line in processor.output_lines {
        delete(line)
    }
    clear(&processor.output_lines)
}

@(export)
flush_leftover :: proc "c" () -> u32 {
    context = runtime.default_context()
    
    if len(processor.leftover_buffer) > 0 {
        // Convert leftover to final line
        line_str := strings.clone_from_bytes(processor.leftover_buffer)
        append(&processor.output_lines, line_str)
        
        // Clear leftover
        delete(processor.leftover_buffer)
        processor.leftover_buffer = make([]u8, 0)
    }
    
    return u32(len(processor.output_lines))
}

@(export)
get_memory_usage :: proc "c" () -> u64 {
    context = runtime.default_context()
    
    total: u64 = 0
    
    // Count leftover buffer
    total += u64(len(processor.leftover_buffer))
    
    // Count output lines
    for line in processor.output_lines {
        total += u64(len(line))
    }
    
    // Add dynamic array overhead (rough estimate)
    total += u64(cap(processor.output_lines) * size_of(string))
    
    return total
}

// Helper for JavaScript to allocate temporary buffers
@(export)
simple_alloc_test :: proc "c" (size: u32) -> rawptr {
    context = runtime.default_context()
    
    buffer := make([]u8, size)
    return raw_data(buffer)
}

@(export)
debug_input :: proc "c" (input_ptr: rawptr, input_len: u32) -> u32 {
    context = runtime.default_context()
    
    if input_ptr == nil || input_len == 0 {
        return 999 // Special return for null/empty
    }
    
    if input_len == 0 {
        return 998 // Special return for zero length
    }
    
    // Get first byte
    first_byte_ptr := cast(^u8)input_ptr
    first_byte := first_byte_ptr^
    
    // Return first byte value for debugging
    return u32(first_byte)
}
