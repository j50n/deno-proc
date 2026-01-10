package line_processor_configurable

import "core:mem"

// Configurable buffer sizes (can be changed per call)
current_input_size: u32
current_output_size: u32
current_leftover_size: u32

// Dynamic buffer pointers
input_buffer: []u8
output_buffer: []u8
leftover_buffer: []u8
leftover_len: u32

@(export)
configure_buffers :: proc "c" (input_size: u32, output_size: u32, leftover_size: u32) -> bool {
    // Free existing buffers if they exist
    if len(input_buffer) > 0 {
        delete(input_buffer)
    }
    if len(output_buffer) > 0 {
        delete(output_buffer)
    }
    if len(leftover_buffer) > 0 {
        delete(leftover_buffer)
    }
    
    // Allocate new buffers with requested sizes
    input_buffer = make([]u8, input_size)
    output_buffer = make([]u8, output_size)
    leftover_buffer = make([]u8, leftover_size)
    
    if len(input_buffer) != int(input_size) || 
       len(output_buffer) != int(output_size) || 
       len(leftover_buffer) != int(leftover_size) {
        return false // Allocation failed
    }
    
    current_input_size = input_size
    current_output_size = output_size
    current_leftover_size = leftover_size
    leftover_len = 0
    
    return true
}

@(export)
get_input_buffer :: proc "c" () -> rawptr {
    return raw_data(input_buffer)
}

@(export)
get_output_buffer :: proc "c" () -> rawptr {
    return raw_data(output_buffer)
}

@(export)
get_buffer_sizes :: proc "c" () -> u32 {
    // Pack sizes into a single u32: input(12bits) | output(12bits) | leftover(8bits)
    return (current_input_size & 0xFFF) << 20 | 
           (current_output_size & 0xFFF) << 8 | 
           (current_leftover_size & 0xFF)
}

@(export)
process_lines :: proc "c" (input_len: u32) -> u32 {
    if input_len > current_input_size {
        return 0 // Input too large for current buffer
    }
    
    // Create working buffer with leftover + new input
    working_data := make([]u8, leftover_len + input_len)
    defer delete(working_data)
    
    // Copy leftover data first
    if leftover_len > 0 {
        mem.copy(raw_data(working_data), raw_data(leftover_buffer), int(leftover_len))
    }
    
    // Copy new input data after leftover
    if input_len > 0 {
        mem.copy(&working_data[leftover_len], raw_data(input_buffer), int(input_len))
    }
    
    total_len := leftover_len + input_len
    
    // Process lines
    output_pos: u32 = 0
    line_start: u32 = 0
    
    for i in 0..<total_len {
        if working_data[i] == '\n' {
            line_end := i
            
            // Remove trailing \r if present
            if line_end > line_start && working_data[line_end-1] == '\r' {
                line_end -= 1
            }
            
            line_len := line_end - line_start
            
            // Check if we have space for length + data
            if output_pos + 4 + line_len > current_output_size {
                break // Output buffer full
            }
            
            // Write 32-bit length (little-endian)
            length_bytes := transmute([4]u8)line_len
            output_buffer[output_pos] = length_bytes[0]
            output_buffer[output_pos+1] = length_bytes[1]
            output_buffer[output_pos+2] = length_bytes[2]
            output_buffer[output_pos+3] = length_bytes[3]
            output_pos += 4
            
            // Write line data
            if line_len > 0 {
                mem.copy(&output_buffer[output_pos], &working_data[line_start], int(line_len))
                output_pos += line_len
            }
            
            line_start = i + 1
        }
    }
    
    // Handle leftover data
    leftover_len = 0
    if line_start < total_len {
        new_leftover_len := total_len - line_start
        if new_leftover_len <= current_leftover_size {
            leftover_len = new_leftover_len
            mem.copy(raw_data(leftover_buffer), &working_data[line_start], int(leftover_len))
        }
        // If leftover is too big, we discard it (could return error instead)
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
