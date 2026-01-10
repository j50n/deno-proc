package line_processor

import "core:mem"

// Fixed memory areas for line processing
BUFFER_SIZE :: 64 * 1024  // 64KB input buffer
OUTPUT_SIZE :: 128 * 1024 // 128KB output buffer
LEFTOVER_SIZE :: 4096     // 4KB leftover buffer

// Memory layout
input_buffer: [BUFFER_SIZE]u8
output_buffer: [OUTPUT_SIZE]u8
leftover_buffer: [LEFTOVER_SIZE]u8
leftover_len: u32

@(export)
get_input_buffer :: proc "c" () -> rawptr {
    return raw_data(input_buffer[:])
}

@(export)
get_output_buffer :: proc "c" () -> rawptr {
    return raw_data(output_buffer[:])
}

@(export)
process_lines :: proc "c" (input_len: u32) -> u32 {
    // Handle empty input (flush leftover data)
    if input_len == 0 && leftover_len == 0 {
        return 0 // Nothing to process
    }
    
    if input_len > BUFFER_SIZE {
        return 0 // Error: input too large
    }
    
    // Create working buffer with leftover + new input
    working_data: [BUFFER_SIZE]u8
    total_len := leftover_len + input_len
    
    if total_len > BUFFER_SIZE {
        return 0 // Error: combined data too large
    }
    
    // Copy leftover data first
    if leftover_len > 0 {
        mem.copy(raw_data(working_data[:]), raw_data(leftover_buffer[:]), int(leftover_len))
    }
    
    // Copy new input data after leftover
    if input_len > 0 {
        mem.copy(&working_data[leftover_len], raw_data(input_buffer[:]), int(input_len))
    }
    
    // Process combined data
    output_pos: u32 = 0
    line_start: u32 = 0
    
    for i in 0..<total_len {
        if working_data[i] == '\n' {
            // Found line ending
            line_end := i
            
            // Remove trailing \r if present
            if line_end > line_start && working_data[line_end-1] == '\r' {
                line_end -= 1
            }
            
            line_len := line_end - line_start
            
            // Check if we have space for length + data
            if output_pos + 4 + line_len > OUTPUT_SIZE {
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
    
    // Handle leftover data or flush final line if input_len == 0
    if input_len == 0 && line_start < total_len {
        // Flush remaining data as final line
        line_len := total_len - line_start
        
        if output_pos + 4 + line_len <= OUTPUT_SIZE {
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
        }
        leftover_len = 0
    } else {
        // Normal leftover handling
        leftover_len = 0
        if line_start < total_len {
            leftover_len = total_len - line_start
            if leftover_len <= LEFTOVER_SIZE {
                mem.copy(raw_data(leftover_buffer[:]), &working_data[line_start], int(leftover_len))
            } else {
                leftover_len = 0 // Discard if too large
            }
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
