package line_processor_adaptive

import "core:mem"

// Large fixed buffers - JavaScript can grow WASM memory to make these bigger
MAX_INPUT_SIZE :: 1024 * 1024     // 1MB 
MAX_OUTPUT_SIZE :: 2 * 1024 * 1024 // 2MB  
MAX_LEFTOVER_SIZE :: 1024 * 1024   // 1MB

input_buffer: [MAX_INPUT_SIZE]u8
output_buffer: [MAX_OUTPUT_SIZE]u8
leftover_buffer: [MAX_LEFTOVER_SIZE]u8
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
get_max_sizes :: proc "c" () -> u32 {
    // Return max input size for JavaScript to know the limit
    return MAX_INPUT_SIZE
}

@(export)
process_lines :: proc "c" (input_len: u32) -> u32 {
    if input_len > MAX_INPUT_SIZE {
        return 0 // Input too large
    }
    
    total_len := leftover_len + input_len
    
    // Check if we need more space for a huge line
    if total_len > MAX_LEFTOVER_SIZE {
        return 0 // Signal JavaScript to grow memory and recompile
    }
    
    // Use end of leftover buffer as working space
    working_start := MAX_LEFTOVER_SIZE - total_len
    working_data := leftover_buffer[working_start:]
    
    // Copy data
    if leftover_len > 0 {
        mem.copy(raw_data(working_data), raw_data(leftover_buffer[:leftover_len]), int(leftover_len))
    }
    if input_len > 0 {
        mem.copy(&working_data[leftover_len], raw_data(input_buffer[:input_len]), int(input_len))
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
            
            if output_pos + 4 + line_len > MAX_OUTPUT_SIZE {
                return 0 // Need more output space
            }
            
            // Write length + data
            length_bytes := transmute([4]u8)line_len
            output_buffer[output_pos] = length_bytes[0]
            output_buffer[output_pos+1] = length_bytes[1]
            output_buffer[output_pos+2] = length_bytes[2]
            output_buffer[output_pos+3] = length_bytes[3]
            output_pos += 4
            
            if line_len > 0 {
                mem.copy(&output_buffer[output_pos], &working_data[line_start], int(line_len))
                output_pos += line_len
            }
            
            line_start = i + 1
        }
    }
    
    // Handle leftover
    leftover_len = 0
    if line_start < total_len {
        new_leftover_len := total_len - line_start
        if new_leftover_len <= MAX_LEFTOVER_SIZE {
            leftover_len = new_leftover_len
            mem.copy(raw_data(leftover_buffer[:leftover_len]), &working_data[line_start], int(leftover_len))
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
