package string_row

import "core:slice"
import "core:unicode/utf8"
import "core:strings"

// Serialize array of strings to StringRow binary format
serialize :: proc(columns: []string, allocator := context.allocator) -> []u8 {
    column_count := cast(i32)len(columns)
    if column_count == 0 {
        // Fast path for empty
        buffer := make([]u8, 8, allocator)
        (cast(^i32)raw_data(buffer))^ = 0
        (cast(^i32)raw_data(buffer[4:]))^ = 0
        return buffer
    }
    
    // Calculate total text length without concatenating
    total_text_len := 0
    for col in columns {
        total_text_len += len(col)
    }
    
    // Use stack array for typical column counts, heap for large ones
    MAX_STACK_COLUMNS :: 32
    utf16_lengths_stack: [MAX_STACK_COLUMNS]i32
    utf16_lengths_heap: []i32
    utf16_lengths: []i32
    
    if len(columns) <= MAX_STACK_COLUMNS {
        utf16_lengths = utf16_lengths_stack[:len(columns)]
    } else {
        utf16_lengths_heap = make([]i32, len(columns), allocator)
        // Don't defer delete when using temp allocator - it will be bulk freed
        if allocator != context.temp_allocator {
            defer delete(utf16_lengths_heap)
        }
        utf16_lengths = utf16_lengths_heap
    }
    
    // Calculate UTF-16 lengths in separate pass to enable vectorization
    for col, i in columns {
        char_count: i32 = 0
        // Simple loop for UTF-16 counting - compiler can potentially vectorize
        for r in col {
            char_count += r <= 0xFFFF ? 1 : 2
        }
        utf16_lengths[i] = char_count
    }
    
    // Calculate buffer size
    header_size := 4
    positions_size := cast(int)(column_count + 1) * 4
    total_size := header_size + positions_size + total_text_len
    
    // Allocate buffer once
    buffer := make([]u8, total_size, allocator)
    
    // Write column count
    (cast(^i32)raw_data(buffer))^ = column_count
    
    // Write UTF-16 positions using bulk operations
    positions := slice.reinterpret([]i32, buffer[4:4 + positions_size])
    
    // Calculate cumulative positions (vectorizable prefix sum)
    positions[0] = 0
    for i in 1..=column_count {
        positions[i] = positions[i-1] + utf16_lengths[i-1]
    }
    
    // Direct copy text data without concatenation (highly vectorizable)
    text_offset := header_size + positions_size
    text_dest := buffer[text_offset:]
    current_pos := 0
    for col in columns {
        col_bytes := transmute([]u8)col
        copy_slice(text_dest[current_pos:current_pos + len(col_bytes)], col_bytes)
        current_pos += len(col_bytes)
    }
    
    return buffer
}

// Deserialize StringRow binary format to array of strings  
// Returns (result, success) - check success before using result
deserialize :: proc(buffer: []u8, allocator := context.allocator) -> (result: []string, ok: bool) {
    // Validate minimum buffer size
    if len(buffer) < 4 do return nil, false
    
    column_count := (cast(^i32)raw_data(buffer))^
    if column_count < 0 do return nil, false  // Negative count is invalid
    if column_count == 0 {
        empty_result, alloc_err := make([]string, 0, allocator)
        if alloc_err != nil do return nil, false
        return empty_result, true
    }
    
    // Validate header size
    header_size := 4 + cast(int)(column_count + 1) * 4
    if len(buffer) < header_size do return nil, false
    
    // Extract UTF-16 positions and text (bulk operations)
    positions := slice.reinterpret([]i32, buffer[4:header_size])
    text_data := string(buffer[header_size:])
    text_len := cast(i32)len(text_data)
    
    // Validate positions array integrity
    if positions[0] != 0 do return nil, false  // First position must be 0
    for i in 1..=cast(int)column_count {
        // Positions must be monotonic and within text bounds
        if positions[i] < positions[i-1] do return nil, false
        if positions[i] > text_len do return nil, false
    }
    
    // Pre-calculate all byte positions in vectorizable loops
    byte_positions, alloc_err := make([]int, column_count + 1, allocator)
    if alloc_err != nil do return nil, false
    defer delete(byte_positions)
    
    // Convert all UTF-16 positions to byte positions in bulk
    byte_positions[0] = 0
    if len(text_data) > 0 {
        current_byte := 0
        current_char: i32 = 0
        pos_index := 1
        
        // Single pass through text, filling byte_positions array
        for r, byte_offset in text_data {
            // Update current position tracking
            rune_char_count: i32 = r <= 0xFFFF ? 1 : 2
            next_char := current_char + rune_char_count
            next_byte := byte_offset + utf8.rune_size(r)
            
            // Fill any positions that fall at this character boundary
            for pos_index <= cast(int)column_count && positions[pos_index] <= next_char {
                if positions[pos_index] == current_char {
                    byte_positions[pos_index] = current_byte
                } else if positions[pos_index] == next_char {
                    byte_positions[pos_index] = next_byte
                } else {
                    // Position falls within a multi-unit character - use start
                    byte_positions[pos_index] = current_byte
                }
                pos_index += 1
            }
            
            current_char = next_char
            current_byte = next_byte
        }
        
        // Handle any remaining positions at end
        for pos_index <= cast(int)column_count {
            byte_positions[pos_index] = len(text_data)
            pos_index += 1
        }
    } else {
        // Empty text - all positions are 0
        for i in 1..=cast(int)column_count {
            byte_positions[i] = 0
        }
    }
    
    // Build result using bulk string slicing (vectorizable)
    final_result, alloc_err2 := make([]string, column_count, allocator)
    if alloc_err2 != nil do return nil, false
    
    for i in 0..<column_count {
        start_byte := byte_positions[i]
        end_byte := byte_positions[i + 1]
        // Additional bounds check for safety
        if start_byte > len(text_data) || end_byte > len(text_data) || start_byte > end_byte {
            delete(final_result)
            return nil, false
        }
        final_result[i] = text_data[start_byte:end_byte]
    }
    
    return final_result, true
}
