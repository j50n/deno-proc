package line_processor_external

import "core:mem"
import "core:slice"

// No internal buffers - everything managed externally
leftover_len: u32

@(export)
process_lines :: proc "c" (input_ptr: rawptr, input_len: u32, 
                          output_ptr: rawptr, output_size: u32,
                          leftover_ptr: rawptr, leftover_size: u32) -> u32 {
    
    // Get slices from external memory
    input_data := slice.from_ptr(cast(^u8)input_ptr, int(input_len))
    output_data := slice.from_ptr(cast(^u8)output_ptr, int(output_size))
    leftover_data := slice.from_ptr(cast(^u8)leftover_ptr, int(leftover_size))
    
    // Combine leftover + input
    total_len := leftover_len + input_len
    
    // Check if we have enough working space (use end of leftover buffer)
    if total_len > leftover_size {
        return 0 // Not enough space
    }
    
    // Use leftover buffer as working space
    working_start := leftover_size - total_len
    working_data := leftover_data[working_start:]
    
    // Copy leftover + input to working area
    if leftover_len > 0 {
        mem.copy(raw_data(working_data), raw_data(leftover_data[:leftover_len]), int(leftover_len))
    }
    if input_len > 0 {
        mem.copy(&working_data[leftover_len], raw_data(input_data), int(input_len))
    }
    
    // Process lines
    output_pos: u32 = 0
    line_start: u32 = 0
    
    for i in 0..<total_len {
        if working_data[i] == '\n' {
            line_end := i
            
            if line_end > line_start && working_data[line_end-1] == '\r' {
                line_end -= 1
            }
            
            line_len := line_end - line_start
            
            if output_pos + 4 + line_len > output_size {
                return 0 // Not enough output space
            }
            
            // Write length + data
            length_bytes := transmute([4]u8)line_len
            output_data[output_pos] = length_bytes[0]
            output_data[output_pos+1] = length_bytes[1]
            output_data[output_pos+2] = length_bytes[2]
            output_data[output_pos+3] = length_bytes[3]
            output_pos += 4
            
            if line_len > 0 {
                mem.copy(&output_data[output_pos], &working_data[line_start], int(line_len))
                output_pos += line_len
            }
            
            line_start = i + 1
        }
    }
    
    // Handle leftover
    leftover_len = 0
    if line_start < total_len {
        new_leftover_len := total_len - line_start
        if new_leftover_len <= leftover_size {
            leftover_len = new_leftover_len
            mem.copy(raw_data(leftover_data[:leftover_len]), &working_data[line_start], int(leftover_len))
        }
    }
    
    return output_pos
}

@(export)
get_leftover_len :: proc "c" () -> u32 {
    return leftover_len
}

@(export)
reset_leftover :: proc "c" () {
    leftover_len = 0
}
