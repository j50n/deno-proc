package simple_slices

import "core:mem"
import "core:slice"

@(export)
process_lines :: proc "c" (input_ptr: rawptr, input_len: u32, 
                          output_ptr: rawptr, output_size: u32,
                          leftover_ptr: rawptr, leftover_len: u32, leftover_capacity: u32) -> u32 {
    
    // Odin just gets slices - doesn't care where they are in memory
    input := slice.from_ptr(cast(^u8)input_ptr, int(input_len))
    output := slice.from_ptr(cast(^u8)output_ptr, int(output_size))
    leftover := slice.from_ptr(cast(^u8)leftover_ptr, int(leftover_capacity))
    
    // Use leftover buffer as working space
    total_len := leftover_len + input_len
    working := leftover[leftover_capacity - total_len:]
    
    // Copy leftover + input
    if leftover_len > 0 {
        mem.copy(raw_data(working), raw_data(leftover[:leftover_len]), int(leftover_len))
    }
    mem.copy(&working[leftover_len], raw_data(input), int(input_len))
    
    // Process lines
    output_pos: u32 = 0
    line_start: u32 = 0
    
    for i in 0..<total_len {
        if working[i] == '\n' {
            line_end := i
            if line_end > line_start && working[line_end-1] == '\r' do line_end -= 1
            
            line_len := line_end - line_start
            if output_pos + 4 + line_len > output_size do return 0
            
            // Write length + data
            length_bytes := transmute([4]u8)line_len
            output[output_pos] = length_bytes[0]
            output[output_pos+1] = length_bytes[1] 
            output[output_pos+2] = length_bytes[2]
            output[output_pos+3] = length_bytes[3]
            output_pos += 4
            
            if line_len > 0 {
                mem.copy(&output[output_pos], &working[line_start], int(line_len))
                output_pos += line_len
            }
            
            line_start = i + 1
        }
    }
    
    // Save new leftover
    new_leftover_len := total_len - line_start
    if new_leftover_len > 0 && new_leftover_len <= leftover_capacity {
        mem.copy(raw_data(leftover), &working[line_start], int(new_leftover_len))
        return output_pos | (new_leftover_len << 24) // Pack leftover len in high bits
    }
    
    return output_pos
}
